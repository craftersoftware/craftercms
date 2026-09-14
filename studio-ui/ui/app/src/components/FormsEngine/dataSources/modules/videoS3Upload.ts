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
import { createExternalUploadAction, propString, VIDEO_MIME_TYPES } from '../moduleHelpers';

export const videoS3UploadDataSourceModule: DataSourceModule = defineDataSourceModule({
	apiVersion: DATA_SOURCE_API_VERSION,
	type: 'video-S3-upload',
	interfaces: ['video'],
	capabilities: ['upload'],
	create({ record }) {
		const path = propString(record, 'repoPath');
		const profileId = propString(record, 'profileId');

		return createInstanceFromRecord(record, videoS3UploadDataSourceModule, {
			capabilities: ['upload'],
			getActions() {
				return [
					createExternalUploadAction({
						label: `Upload - ${record.title}`,
						path,
						profileId,
						profileType: 'aws',
						fileTypes: VIDEO_MIME_TYPES,
						selection: 'asset',
						meta: { path, profileId, fileTypes: VIDEO_MIME_TYPES }
					})
				];
			}
		});
	}
});

export default videoS3UploadDataSourceModule;
