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

import type { ContentType, ContentTypeField, DataSource } from '../../../models/ContentType';
import type { BuiltInControlType } from '../lib/controlMap';
import type { DataSourceBinding, DataSourceResolutionError } from './types';

/**
 * Built-in control → DS binding metadata. Plugin controls do not belong here;
 * they declare `dataSourceBindings` on `PluginDescriptor.controls[type]`
 * and/or register via {@link registerControlDataSourceBindings}.
 *
 * `selection` is field-value cardinality (one selected option vs many checked
 * options). It does not encode how many data sources TB may bind; that is a
 * separate descriptor-property concern (`datasource:item` vs
 * `datasource:item:singleSelection`).
 */
export const controlDataSourceBindings: Partial<Record<BuiltInControlType, readonly DataSourceBinding[]>> = {
	'node-selector': [{ propertyName: 'itemManager', interfaces: ['item'], selection: 'multi' }],
	'image-picker': [{ propertyName: 'imageManager', interfaces: ['image'], selection: 'single' }],
	'video-picker': [{ propertyName: 'videoManager', interfaces: ['video'], selection: 'single' }],
	'transcoded-video-picker': [{ propertyName: 'videoManager', interfaces: ['transcoded-video'], selection: 'single' }],
	dropdown: [{ propertyName: 'datasource', interfaces: ['item', 'options'], selection: 'single' }],
	'checkbox-group': [{ propertyName: 'datasource', interfaces: ['item', 'options'], selection: 'multi' }],
	'linked-dropdown': [{ propertyName: 'datasource', interfaces: ['item', 'options'], selection: 'single' }],
	rte: [
		{ propertyName: 'imageManager', interfaces: ['image'], selection: 'single' },
		{ propertyName: 'videoManager', interfaces: ['video', 'transcoded-video'], selection: 'single' },
		{ propertyName: 'audioManager', interfaces: ['audio'], selection: 'single' },
		{ propertyName: 'fileManager', interfaces: ['item'], selection: 'single' }
	]
};

/** Runtime registrations for plugin / dynamically discovered control types. */
const registeredControlDataSourceBindings = new Map<string, readonly DataSourceBinding[]>();

// Controls without bindings are the common case. A shared instance keeps the identity stable so
// callers keying effects on the result don't re-run on every render.
const noBindings: readonly DataSourceBinding[] = Object.freeze([]);

/** Type guard for plugin/control binding contributions before registry install. */
export function isDataSourceBinding(value: unknown): value is DataSourceBinding {
	if (!value || typeof value !== 'object') return false;
	const candidate = value as Partial<DataSourceBinding>;
	return (
		typeof candidate.propertyName === 'string' &&
		candidate.propertyName.length > 0 &&
		Array.isArray(candidate.interfaces) &&
		candidate.interfaces.length > 0 &&
		candidate.interfaces.every((item) => typeof item === 'string' && item.length > 0) &&
		(candidate.selection === 'single' || candidate.selection === 'multi')
	);
}

/**
 * Validates and normalizes binding contributions from plugins or control modules.
 *
 * Accepts one binding or an array; `null` / `undefined` → `[]`. Rejects partial objects so a typo’d
 * binding does not silently become “no data sources”.
 */
export function normalizeDataSourceBindings(value: unknown): readonly DataSourceBinding[] {
	if (value == null) return [];
	const candidates = Array.isArray(value) ? value : [value];
	const bindings = candidates.filter(isDataSourceBinding);
	if (bindings.length !== candidates.length) {
		throw new TypeError(
			'Control dataSourceBindings must be a DataSourceBinding or DataSourceBinding[] with propertyName, interfaces, and selection.'
		);
	}
	return bindings;
}

/**
 * Reads binding metadata from a control plugin module.
 * Supported shapes:
 * - named export `dataSourceBindings` / `dataSourceBinding`
 * - static on the default component: `Component.dataSourceBindings`
 */
export function extractDataSourceBindingsFromControlModule(module: unknown): readonly DataSourceBinding[] {
	const imported = module as {
		dataSourceBindings?: unknown;
		dataSourceBinding?: unknown;
		default?: {
			dataSourceBindings?: unknown;
			dataSourceBinding?: unknown;
		};
	};
	const raw =
		imported.dataSourceBindings ??
		imported.dataSourceBinding ??
		imported.default?.dataSourceBindings ??
		imported.default?.dataSourceBinding;
	return normalizeDataSourceBindings(raw);
}

/**
 * Registers DS binding metadata for a control type (plugins / dynamic types).
 *
 * Built-ins live in {@link controlDataSourceBindings}; this map is for types not in that table.
 * `registerPlugin` already calls this from `controls[type].dataSourceBindings`.
 */
export function registerControlDataSourceBindings(
	controlType: string,
	bindings: readonly DataSourceBinding[] | DataSourceBinding
): void {
	if (!controlType) {
		throw new TypeError('registerControlDataSourceBindings requires a non-empty control type.');
	}
	registeredControlDataSourceBindings.set(controlType, normalizeDataSourceBindings(bindings));
}

/**
 * Lookup order: runtime plugin registrations → built-in {@link controlDataSourceBindings} → shared
 * empty array. The empty result is a stable frozen `[]` so effect deps do not thrash.
 *
 * Binding metadata tells FE which field properties hold DS ids and which interfaces they require.
 */
export function getControlDataSourceBindings(controlType: string): readonly DataSourceBinding[] {
	return (
		registeredControlDataSourceBindings.get(controlType) ??
		controlDataSourceBindings[controlType as BuiltInControlType] ??
		noBindings
	);
}

/**
 * Parses comma-separated DS ids from `field.properties[binding.propertyName].value`.
 * Order is authoring order; empty or non-string → `[]`.
 */
export function getFieldDataSourceIds(field: ContentTypeField, binding: DataSourceBinding): string[] {
	const value = field.properties?.[binding.propertyName]?.value;
	if (typeof value !== 'string') return [];
	return value
		.split(',')
		.map((id) => id.trim())
		.filter(Boolean);
}

/**
 * Resolves records in the exact order authored on the field. Unknown ids are
 * returned as errors instead of being silently dropped.
 */
export function resolveFieldDataSourceRecords(
	contentType: ContentType,
	field: ContentTypeField,
	bindings: readonly DataSourceBinding[]
): { records: DataSource[]; recordBindings: DataSourceBinding[]; errors: DataSourceResolutionError[] } {
	const records: DataSource[] = [];
	const recordBindings: DataSourceBinding[] = [];
	const errors: DataSourceResolutionError[] = [];
	const byId = new Map((contentType.dataSources ?? []).map((dataSource) => [dataSource.id, dataSource]));

	bindings.forEach((binding) => {
		getFieldDataSourceIds(field, binding).forEach((id) => {
			const record = byId.get(id);
			if (!record) {
				errors.push({
					code: 'unknown-id',
					dataSourceId: id,
					message: `Field "${field.id}" references unknown data source "${id}" through "${binding.propertyName}".`
				});
				return;
			}
			records.push(record);
			recordBindings.push(binding);
		});
	});

	return { records, recordBindings, errors };
}
