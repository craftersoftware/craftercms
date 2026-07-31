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

import type LookupTable from '../../../models/LookupTable';
import type { AllowedContentTypesDataWithDestinations, AllowedPathsData } from '../controls/NodeSelector';
import type {
	DataSourceAction,
	DataSourceActionChoice,
	DataSourceActionGroup,
	DataSourceActionKind,
	DataSourceFieldContext,
	DataSourceSelection,
	GroupedDataSourceActions,
	ResolvedDataSourceAction
} from './types';

/**
 * Legacy aggregate of create/browse/search/upload allowances for NodeSelector.
 * Prefer reading {@link ResolvedDataSourceAction}s directly for new UIs.
 */
export interface ConsolidatedItemPickerData {
	allowedCreateTypes: LookupTable<AllowedContentTypesDataWithDestinations>;
	allowedCreatePaths: string[];
	allowedBrowsePaths: AllowedPathsData[];
	allowedSearchPaths: AllowedPathsData[];
	allowedUploadPaths: AllowedPathsData[];
}

const standardActionKinds = new Set<DataSourceActionKind>(['browse', 'search', 'upload', 'create']);

function actionKindLabel(kind: DataSourceActionKind): string {
	return kind.length ? `${kind.charAt(0).toUpperCase()}${kind.slice(1)}` : kind;
}

function buildActionChoices(action: ResolvedDataSourceAction): DataSourceActionChoice[] {
	if (action.kind !== 'create') {
		return [
			{
				key: action.actionKey,
				label: action.dataSourceTitle || action.label,
				action
			}
		];
	}

	const targets = action.meta?.createTargets ?? [];
	const targetChoices = targets.map<DataSourceActionChoice>((target, index) => ({
		key: `${action.actionKey}::create::${target.contentTypeId}::${target.strategy}::${target.path ?? index}`,
		label: target.contentTypeId,
		description: action.dataSourceTitle,
		action,
		target: { type: 'create', ...target }
	}));
	const pathChoices = (action.meta?.createPaths ?? []).map<DataSourceActionChoice>((path, index) => ({
		key: `${action.actionKey}::create-path::${path || index}`,
		label: action.dataSourceTitle || path,
		description: path,
		action,
		target: { type: 'create-path', path }
	}));

	return targetChoices.length || pathChoices.length
		? [...targetChoices, ...pathChoices]
		: [{ key: action.actionKey, label: action.dataSourceTitle || action.label, action }];
}

/**
 * Collapses standard browse/search/upload/create actions across data sources into intent-level menu
 * groups keyed by binding property + kind, while keeping each concrete `run` on the choice.
 * Custom MenuItem / Dialog / kinds stay flat so UIs do not lose bespoke chrome.
 */
export function buildActionGroups(actions: readonly ResolvedDataSourceAction[]): GroupedDataSourceActions {
	const groups = new Map<string, DataSourceActionGroup>();
	const customActions: ResolvedDataSourceAction[] = [];

	actions.forEach((action) => {
		if (action.MenuItem || action.Dialog || !standardActionKinds.has(action.kind)) {
			customActions.push(action);
			return;
		}
		const key = `${action.binding.propertyName}::${action.kind}`;
		const group = groups.get(key) ?? {
			key,
			kind: action.kind,
			label: actionKindLabel(action.kind),
			icon: action.icon,
			choices: []
		};
		group.choices.push(...buildActionChoices(action));
		groups.set(key, group);
	});

	return { groups: Array.from(groups.values()), customActions };
}

/**
 * Runs `action.run` with an optional choice target (e.g. create content-type / path).
 * Throws if the action is presentation-only (MenuItem / Dialog without `run`).
 */
export async function invokeResolvedAction(
	action: ResolvedDataSourceAction,
	context: DataSourceFieldContext,
	target?: DataSourceActionChoice['target']
): Promise<DataSourceSelection | DataSourceSelection[] | null> {
	if (!action.run) {
		throw new Error(`Data-source action "${action.actionKey}" does not provide run().`);
	}
	return action.run(context, { target });
}

/** Invokes the {@link ResolvedDataSourceAction} behind a grouped choice, forwarding its target. */
export function invokeActionChoice(
	choice: DataSourceActionChoice,
	context: DataSourceFieldContext
): Promise<DataSourceSelection | DataSourceSelection[] | null> {
	return invokeResolvedAction(choice.action, context, choice.target);
}

function actionTitle(action: DataSourceAction): string {
	if (typeof action.label === 'string') return action.label;
	return action.meta?.path ? String(action.meta.path) : action.id;
}

/**
 * Builds the legacy item-picker summary shape from declarative actions so
 * NodeSelector can keep its 1-vs-N picker UX without switching on DS type ids.
 */
export function consolidateItemActions(actions: readonly ResolvedDataSourceAction[]): ConsolidatedItemPickerData {
	const allowedCreateTypes: LookupTable<AllowedContentTypesDataWithDestinations> = {};
	const allowedCreatePaths = new Set<string>();
	const allowedBrowsePaths: AllowedPathsData[] = [];
	const allowedSearchPaths: AllowedPathsData[] = [];
	const allowedUploadPaths: AllowedPathsData[] = [];

	actions.forEach((action) => {
		if (action.MenuItem || action.Dialog) return;
		const meta = action.meta ?? {};
		const title = actionTitle(action);
		const sortOptions =
			meta.sortBy || meta.sortOrder
				? { sortBy: meta.sortBy as string | undefined, sortOrder: meta.sortOrder as 'asc' | 'desc' | undefined }
				: undefined;

		switch (action.kind) {
			case 'browse':
				if (meta.path) {
					allowedBrowsePaths.push({
						title,
						path: meta.path,
						actionChoice: buildActionChoices(action)[0],
						allowedContentTypes: meta.contentTypes ?? [],
						options: sortOptions
					});
				}
				break;
			case 'search':
				if (meta.path) {
					allowedSearchPaths.push({
						title,
						path: meta.path,
						actionChoice: buildActionChoices(action)[0],
						allowedContentTypes: meta.contentTypes ?? [],
						options: sortOptions
					});
				}
				break;
			case 'upload':
				if (meta.path) {
					allowedUploadPaths.push({
						title,
						path: meta.path,
						actionChoice: buildActionChoices(action)[0]
					});
				}
				break;
			case 'create': {
				(meta.createTargets ?? []).forEach((target) => {
					const contentTypeId = target.contentTypeId;
					if (!contentTypeId) return;
					allowedCreateTypes[contentTypeId] = allowedCreateTypes[contentTypeId] ?? {};
					if (target.strategy === 'embedded') {
						allowedCreateTypes[contentTypeId].embedded = true;
					} else {
						allowedCreateTypes[contentTypeId].shared = true;
						if (target.path) {
							allowedCreateTypes[contentTypeId].createPaths = allowedCreateTypes[contentTypeId].createPaths ?? [];
							if (!allowedCreateTypes[contentTypeId].createPaths.includes(target.path)) {
								allowedCreateTypes[contentTypeId].createPaths.push(target.path);
							}
						}
					}
				});
				(meta.createPaths ?? []).forEach((path) => {
					if (path) allowedCreatePaths.add(path);
				});
				break;
			}
			default:
				break;
		}
	});

	return {
		allowedCreateTypes,
		allowedCreatePaths: Array.from(allowedCreatePaths),
		allowedBrowsePaths,
		allowedSearchPaths,
		allowedUploadPaths
	};
}
