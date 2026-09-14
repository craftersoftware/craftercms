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
import { AUDIO_MIME_TYPES, createUploadAction, resolveRepoPath } from '../moduleHelpers';

export const audioDesktopUploadDataSourceModule: DataSourceModule = defineDataSourceModule({
	apiVersion: DATA_SOURCE_API_VERSION,
	type: 'audio-desktop-upload',
	interfaces: ['audio'],
	capabilities: ['upload'],
	create({ record }) {
		const path = resolveRepoPath(record, '/static-assets/');
		return createInstanceFromRecord(record, audioDesktopUploadDataSourceModule, {
			capabilities: ['upload'],
			getActions() {
				return [
					createUploadAction({
						label: `Upload - ${record.title}`,
						path,
						fileTypes: AUDIO_MIME_TYPES,
						selection: 'asset'
					})
				];
			}
		});
	}
});

export default audioDesktopUploadDataSourceModule;
