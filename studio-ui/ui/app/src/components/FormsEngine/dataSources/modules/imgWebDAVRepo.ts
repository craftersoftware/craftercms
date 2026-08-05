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
import { createExternalBrowseAction, IMAGE_MIME_TYPES, propString } from '../moduleHelpers';

export const imgWebDAVRepoDataSourceModule: DataSourceModule = defineDataSourceModule({
	apiVersion: DATA_SOURCE_API_VERSION,
	type: 'img-WebDAV-repo',
	interfaces: ['image'],
	capabilities: ['browse'],
	create({ record }) {
		const path = propString(record, 'repoPath');
		const profileId = propString(record, 'profileId');

		return createInstanceFromRecord(record, imgWebDAVRepoDataSourceModule, {
			capabilities: ['browse'],
			getActions() {
				return [
					createExternalBrowseAction({
						label: `Browse - ${record.title}`,
						path,
						profileId,
						profileType: 'webdav',
						type: 'image',
						mimeTypes: IMAGE_MIME_TYPES,
						selection: 'asset',
						meta: { path, profileId, mimeTypes: IMAGE_MIME_TYPES }
					})
				];
			}
		});
	}
});

export default imgWebDAVRepoDataSourceModule;
