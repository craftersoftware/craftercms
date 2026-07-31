/*
 * Copyright (C) 2007-2026 Crafter Software Corporation. All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as published by
 * the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import { useEffect, useMemo, useState } from 'react';
import useUpdateRefs from '../../../hooks/useUpdateRefs';
import type { ContentType, ContentTypeField } from '../../../models/ContentType';
import type LookupTable from '../../../models/LookupTable';
import { resolveFieldDataSourceRecords } from './bindings';
import { loadDataSourceModule } from './loader';
import { contentTypesToArray } from './moduleHelpers';
import type {
	DataSourceBinding,
	DataSourceFieldContext,
	DataSourceInstance,
	DataSourceModule,
	DataSourceResolutionError,
	DataSourceServices,
	ResolvedDataSource,
	ResolvedDataSourceAction,
	ResolvedDataSources
} from './types';

export interface ResolveFieldDataSourcesOptions {
	siteId: string;
	contentType: ContentType;
	field: ContentTypeField;
	/** Bindings drive which field properties hold DS ids and which interfaces they require. */
	bindings: readonly DataSourceBinding[];
	value: unknown;
	readonly: boolean;
	remainingCapacity?: number;
	/** Host bridge for browse/search/upload/create dialogs. */
	services: DataSourceServices;
	expandPath?(path: string): string;
	/** Enables `contentTypes: '*'` expansion inside modules while building actions. */
	contentTypes?: ContentType[] | LookupTable<ContentType>;
}

function hasMatchingInterface(
	module: DataSourceModule,
	instance: DataSourceInstance,
	persistedInterface: string,
	binding: DataSourceBinding
): boolean {
	const interfaces = new Set([...module.interfaces, ...instance.interfaces, persistedInterface].filter(Boolean));
	return binding.interfaces.some((candidate) => interfaces.has(candidate));
}

function validateInstance(instance: DataSourceInstance, expectedType: string): void {
	if (!instance || typeof instance !== 'object') throw new TypeError('create() did not return a data-source instance.');
	if (instance.type !== expectedType) {
		throw new TypeError(`Data-source instance type "${instance.type}" does not match module type "${expectedType}".`);
	}
	if (!Array.isArray(instance.interfaces) || !Array.isArray(instance.capabilities)) {
		throw new TypeError(`Data-source instance "${instance.id}" must declare interfaces and capabilities.`);
	}
	if (typeof instance.getActions !== 'function') {
		throw new TypeError(`Data-source instance "${instance.id}" must implement getActions().`);
	}
	(['list', 'edit', 'refreshItem'] as const).forEach((capability) => {
		const implemented = typeof instance[capability] === 'function';
		const advertised = instance.capabilities.includes(capability);
		if (implemented !== advertised) {
			throw new TypeError(
				`Data-source instance "${instance.id}" must advertise and implement "${capability}" together.`
			);
		}
	});
}

/**
 * End-to-end resolve: field property DS ids → load modules → `create()` → interface check → collect
 * actions.
 *
 * Soft-fails per DS into `errors` so one bad plugin does not blank the whole field. Interface match
 * unions module, instance, and persisted `record.interface`. Does not group or present actions —
 * pair with {@link buildActionGroups} / {@link consolidateItemActions}.
 */
export async function resolveFieldDataSources(
	options: ResolveFieldDataSourcesOptions
): Promise<Omit<ResolvedDataSources, 'status'>> {
	const {
		siteId,
		contentType,
		field,
		bindings,
		value,
		readonly,
		remainingCapacity,
		services,
		expandPath,
		contentTypes
	} = options;
	const extracted = resolveFieldDataSourceRecords(contentType, field, bindings);
	const instances: ResolvedDataSource[] = [];
	const actions: ResolvedDataSourceAction[] = [];
	const errors: DataSourceResolutionError[] = extracted.errors.concat();
	const fieldContext: DataSourceFieldContext = {
		siteId,
		contentType,
		field,
		value,
		readonly,
		remainingCapacity,
		services,
		expandPath,
		contentTypes
	};

	for (const [index, record] of extracted.records.entries()) {
		const binding = extracted.recordBindings[index];
		try {
			const module = await loadDataSourceModule(siteId, record);
			let instance: DataSourceInstance;
			try {
				instance = await module.create({ siteId, record, services });
				validateInstance(instance, module.type);
			} catch (cause) {
				errors.push({
					code: 'create-failed',
					dataSourceId: record.id,
					message: `Unable to create data source "${record.title}" (${record.id}).`,
					cause
				});
				continue;
			}
			if (!hasMatchingInterface(module, instance, record.interface, binding)) {
				errors.push({
					code: 'interface-mismatch',
					dataSourceId: record.id,
					message: `Data source "${record.title}" (${record.id}) does not support the interfaces required by "${binding.propertyName}".`
				});
				continue;
			}
			const resolved = { record, module, instance, binding };
			instances.push(resolved);
			try {
				const instanceActions = await instance.getActions(fieldContext);
				if (!Array.isArray(instanceActions)) {
					throw new TypeError(`Data-source instance "${instance.id}" getActions() must return an array.`);
				}
				const actionIds = new Set<string>();
				instanceActions.forEach((action) => {
					if (!action.id || (!action.run && !action.MenuItem && !action.Dialog)) {
						throw new TypeError(
							`Data-source instance "${instance.id}" returned an invalid action; actions need an id and executable behavior.`
						);
					}
					if (actionIds.has(action.id)) {
						throw new TypeError(`Data-source instance "${instance.id}" returned duplicate action id "${action.id}".`);
					}
					actionIds.add(action.id);
				});
				instanceActions.forEach((action) => {
					actions.push({
						...action,
						actionKey: `${record.id}::${action.id}`,
						dataSourceId: record.id,
						dataSourceTitle: record.title,
						binding
					});
				});
			} catch (cause) {
				errors.push({
					code: 'actions-failed',
					dataSourceId: record.id,
					message: `Unable to obtain actions for data source "${record.title}" (${record.id}).`,
					cause
				});
			}
		} catch (cause) {
			errors.push({
				code: record.plugin ? 'plugin-load' : 'unknown-type',
				dataSourceId: record.id,
				message: record.plugin
					? `Unable to load data-source plugin for "${record.title}" (${record.id}).`
					: `No data-source module is registered for type "${record.type}".`,
				cause
			});
		}
	}

	return { context: fieldContext, records: extracted.records, instances, actions, errors };
}

const emptyResult: ResolvedDataSources = {
	context: null,
	records: [],
	instances: [],
	actions: [],
	errors: [],
	status: 'idle'
};

/**
 * React wrapper around {@link resolveFieldDataSources}.
 *
 * Re-runs when bindings / content type / services change, but **not** on every value or
 * `expandPath` identity change (those are read through a ref). Re-keys when the content-type
 * id:type list changes so `contentTypes: '*'` actions appear once types load. Returns an idle empty
 * result when bindings are empty.
 */
export function useFieldDataSources(options: ResolveFieldDataSourcesOptions): ResolvedDataSources {
	const [result, setResult] = useState<ResolvedDataSources>({ ...emptyResult, status: 'loading' });
	const {
		siteId,
		contentType,
		field,
		bindings,
		value,
		readonly,
		remainingCapacity,
		services,
		expandPath,
		contentTypes
	} = options;

	// The field value changes as the user edits, and callers commonly rebuild `expandPath`/`contentTypes`
	// on unrelated re-renders. Re-resolving modules on any of those would reload lists, flash loading
	// states, and (for equal-by-value-but-new-identity inputs) loop. Resolution reads the latest values
	// through a ref so identity churn alone doesn't re-trigger it.
	const latest = useUpdateRefs({ value, remainingCapacity, expandPath, contentTypes });

	// Modules resolve wildcard content-type properties (e.g. `contentTypes: '*'`) while building their
	// actions, and the content type list arrives asynchronously, so resolution must re-run once it
	// loads or those actions (e.g. create) would be permanently missing. Keying on the ids/types
	// instead of the collection identity keeps that without re-resolving on identity churn.
	const contentTypesKey = useMemo(
		() =>
			contentTypesToArray(contentTypes)
				.map((type) => `${type.id}:${type.type}`)
				.join(','),
		[contentTypes]
	);

	useEffect(() => {
		let active = true;
		if (bindings.length === 0) {
			return () => {
				active = false;
			};
		}
		resolveFieldDataSources({
			siteId,
			contentType,
			field,
			bindings,
			value: latest.current.value,
			readonly,
			remainingCapacity: latest.current.remainingCapacity,
			services,
			expandPath: latest.current.expandPath,
			contentTypes: latest.current.contentTypes
		}).then(
			(next) => {
				if (active) {
					// Partial failures keep usable actions/instances as `ready` (errors stay on the
					// result for soft UI like NodeSelector). Only hard-fail when nothing usable resolved.
					const hasUsableResults = next.actions.length > 0 || next.instances.length > 0;
					setResult({
						...next,
						status: next.errors.length && !hasUsableResults ? 'error' : 'ready'
					});
				}
			},
			(cause) => {
				if (active) {
					setResult({
						context: null,
						records: [],
						instances: [],
						actions: [],
						status: 'error',
						errors: [{ code: 'create-failed', message: 'Unable to resolve field data sources.', cause }]
					});
				}
			}
		);
		return () => {
			active = false;
		};
	}, [bindings, contentType, contentTypesKey, field, latest, readonly, services, siteId]);

	// Actions receive the context at run time, so it must carry the current value. It's memoized to
	// keep a stable identity for consumers that key effects on it.
	const context = useMemo<DataSourceFieldContext>(
		() => ({
			siteId,
			contentType,
			field,
			value,
			readonly,
			remainingCapacity,
			services,
			expandPath,
			contentTypes
		}),
		[contentType, contentTypes, expandPath, field, readonly, remainingCapacity, services, siteId, value]
	);

	return useMemo(
		() => (bindings.length === 0 ? emptyResult : { ...result, context }),
		[bindings.length, context, result]
	);
}
