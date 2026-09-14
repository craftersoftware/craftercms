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

import { DATA_SOURCE_API_VERSION, type DataSourceAction, type DataSourceModule } from '../types';
import { createInstanceFromRecord, defineDataSourceModule } from '../defineModule';
import {
	baseRepoPath,
	capabilitiesFromActions,
	createBrowseAction,
	createCreateAction,
	createSearchAction,
	type CreateTarget,
	propBoolean,
	propString,
	resolveContentTypeIds
} from '../moduleHelpers';

export function createComponentsOrPagesModule(
	type: 'components' | 'pages',
	family: 'page' | 'component',
	defaults: { browsePath: string; repoPath: string }
): DataSourceModule {
	const module: DataSourceModule = defineDataSourceModule({
		apiVersion: DATA_SOURCE_API_VERSION,
		type,
		interfaces: ['item'],
		capabilities: ['browse', 'search', 'create'],
		create({ record }) {
			const enableBrowse = propBoolean(record, 'enableBrowse', true);
			const enableSearch = propBoolean(record, 'enableSearch', false);
			const allowShared = propBoolean(record, 'allowShared', true);
			const allowEmbedded = propBoolean(record, 'allowEmbedded', true);
			const browsePath = propString(record, 'baseBrowsePath', defaults.browsePath);
			const repoPath = baseRepoPath(record, defaults.repoPath);
			const sortBy = propString(record, 'sortBy') || undefined;
			const sortOrderRaw = propString(record, 'sortOrder');
			const sortOrder = sortOrderRaw === 'asc' || sortOrderRaw === 'desc' ? sortOrderRaw : undefined;
			const rawContentTypes = propString(record, 'contentTypes') || undefined;

			const advertised: DataSourceAction[] = [];
			if (enableBrowse) advertised.push({ id: 'browse', kind: 'browse', label: 'Browse' });
			if (enableSearch) advertised.push({ id: 'search', kind: 'search', label: 'Search' });
			if (allowShared || allowEmbedded) advertised.push({ id: 'create', kind: 'create', label: 'Create' });

			return createInstanceFromRecord(record, module, {
				capabilities: capabilitiesFromActions(advertised),
				flags: { contentReference: true },
				getActions(ctx) {
					const contentTypeIds = resolveContentTypeIds(rawContentTypes, family, ctx.contentTypes);
					const actions: DataSourceAction[] = [];
					const sortMeta: { sortBy?: string; sortOrder?: 'asc' | 'desc' } = { sortBy, sortOrder };

					if (enableBrowse) {
						actions.push(
							createBrowseAction({
								label: `Browse - ${record.title}`,
								path: browsePath,
								contentTypes: contentTypeIds,
								selection: 'item',
								meta: sortMeta
							})
						);
					}
					if (enableSearch) {
						actions.push(
							createSearchAction({
								label: `Search - ${record.title}`,
								path: browsePath,
								contentTypes: contentTypeIds,
								selection: 'item',
								meta: sortMeta
							})
						);
					}

					const createTargets: CreateTarget[] = [];
					contentTypeIds.forEach((contentTypeId) => {
						if (allowShared) {
							createTargets.push({
								contentTypeId,
								path: repoPath || undefined,
								strategy: 'shared'
							});
						}
						if (allowEmbedded) {
							createTargets.push({ contentTypeId, strategy: 'embedded' });
						}
					});
					if (createTargets.length) {
						actions.push(
							createCreateAction({
								label: `Create - ${record.title}`,
								createTargets
							})
						);
					}
					return actions;
				}
			});
		}
	});
	return module;
}
