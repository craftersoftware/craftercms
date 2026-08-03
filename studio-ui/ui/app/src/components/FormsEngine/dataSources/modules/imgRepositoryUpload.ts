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

import { DATA_SOURCE_API_VERSION, type DataSourceModule } from '../types';
import { createInstanceFromRecord, defineDataSourceModule } from '../defineModule';
import {
	createBrowseAction,
	createSearchAction,
	IMAGE_MIME_TYPES,
	propBoolean,
	propString,
	resolveRepoPath
} from '../moduleHelpers';

export const imgRepositoryUploadDataSourceModule: DataSourceModule = defineDataSourceModule({
	apiVersion: DATA_SOURCE_API_VERSION,
	type: 'img-repository-upload',
	interfaces: ['image'],
	capabilities: ['browse', 'search'],
	create({ record }) {
		const path = resolveRepoPath(record, '/static-assets/');
		const useSearch = propBoolean(record, 'useSearch', false);
		const sortBy = propString(record, 'sortBy') || undefined;
		const sortOrderRaw = propString(record, 'sortOrder');
		const sortOrder = sortOrderRaw === 'asc' || sortOrderRaw === 'desc' ? sortOrderRaw : undefined;

		return createInstanceFromRecord(record, imgRepositoryUploadDataSourceModule, {
			capabilities: useSearch ? ['search'] : ['browse'],
			getActions() {
				const meta: { sortBy?: string; sortOrder?: 'asc' | 'desc'; mimeTypes: string[] } = {
					sortBy,
					sortOrder,
					mimeTypes: IMAGE_MIME_TYPES
				};
				if (useSearch) {
					return [
						createSearchAction({
							label: `Search - ${record.title}`,
							path,
							mimeTypes: IMAGE_MIME_TYPES,
							selection: 'asset',
							meta
						})
					];
				}
				return [
					createBrowseAction({
						label: `Browse - ${record.title}`,
						path,
						mimeTypes: IMAGE_MIME_TYPES,
						selection: 'asset',
						meta
					})
				];
			}
		});
	}
});

export default imgRepositoryUploadDataSourceModule;
