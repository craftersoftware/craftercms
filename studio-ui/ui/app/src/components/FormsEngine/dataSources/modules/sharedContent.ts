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
	capabilitiesFromActions,
	createBrowseAction,
	createCreateAction,
	createSearchAction,
	type CreateTarget,
	propBoolean,
	propString
} from '../moduleHelpers';

export const sharedContentDataSourceModule: DataSourceModule = defineDataSourceModule({
	apiVersion: DATA_SOURCE_API_VERSION,
	type: 'shared-content',
	interfaces: ['item'],
	capabilities: ['browse', 'search', 'create'],
	create({ record }) {
		// Legacy defaults when the enable* properties are absent from older form-definitions.
		const enableCreateNew = propBoolean(record, 'enableCreateNew', true);
		const enableBrowseExisting = propBoolean(record, 'enableBrowseExisting', true);
		const enableSearchExisting = propBoolean(record, 'enableSearchExisting', false);
		const repoPath = propString(record, 'repoPath', '/site/');
		const browsePath = propString(record, 'browsePath') || repoPath;
		const contentTypeId = propString(record, 'type').trim();

		const advertised: DataSourceAction[] = [];
		if (enableBrowseExisting) advertised.push({ id: 'browse', kind: 'browse', label: 'Browse' });
		if (enableSearchExisting) advertised.push({ id: 'search', kind: 'search', label: 'Search' });
		if (enableCreateNew) advertised.push({ id: 'create', kind: 'create', label: 'Create' });

		return createInstanceFromRecord(record, sharedContentDataSourceModule, {
			capabilities: capabilitiesFromActions(advertised),
			flags: { contentReference: true },
			getActions() {
				const actions: DataSourceAction[] = [];
				const contentTypes = contentTypeId ? [contentTypeId] : [];

				if (enableBrowseExisting) {
					actions.push(
						createBrowseAction({
							label: `Browse - ${record.title}`,
							path: browsePath,
							contentTypes,
							selection: 'item'
						})
					);
				}
				if (enableSearchExisting) {
					actions.push(
						createSearchAction({
							label: `Search - ${record.title}`,
							path: browsePath,
							contentTypes,
							selection: 'item'
						})
					);
				}
				if (enableCreateNew) {
					if (contentTypeId) {
						actions.push(
							createCreateAction({
								label: `Create - ${record.title}`,
								createTargets: [{ contentTypeId, path: repoPath, strategy: 'shared' }]
							})
						);
					} else {
						// No default type: advertise createPaths for the control to resolve allowed types.
						actions.push({
							id: 'create',
							kind: 'create',
							label: `Create - ${record.title}`,
							meta: { createTargets: [] as CreateTarget[], createPaths: [repoPath] },
							async run(ctx, options) {
								if (options?.target?.type !== 'create') {
									throw new Error(
										`Data source "${record.id}" (shared-content) has no default type; pick a content type before creating.`
									);
								}
								return ctx.services.createContent({
									path: ctx.expandPath?.(options.target.path ?? repoPath) ?? options.target.path ?? repoPath,
									contentTypeId: options.target.contentTypeId,
									embedded: options.target.strategy === 'embedded'
								});
							}
						});
					}
				}
				return actions;
			}
		});
	}
});

export default sharedContentDataSourceModule;
