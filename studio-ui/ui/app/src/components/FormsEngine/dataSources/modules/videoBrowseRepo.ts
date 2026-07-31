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
import { createBrowseAction, propString, VIDEO_MIME_TYPES } from '../moduleHelpers';

export const videoBrowseRepoDataSourceModule: DataSourceModule = defineDataSourceModule({
	apiVersion: DATA_SOURCE_API_VERSION,
	type: 'video-browse-repo',
	interfaces: ['video'],
	capabilities: ['browse'],
	create({ record }) {
		const path = propString(record, 'repoPath') || propString(record, 'path', '/static-assets/');
		return createInstanceFromRecord(record, videoBrowseRepoDataSourceModule, {
			capabilities: ['browse'],
			getActions() {
				return [
					createBrowseAction({
						label: `Browse - ${record.title}`,
						path,
						mimeTypes: VIDEO_MIME_TYPES,
						selection: 'asset'
					})
				];
			}
		});
	}
});

export default videoBrowseRepoDataSourceModule;
