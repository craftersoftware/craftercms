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
import { propString, unsupportedRemoteError } from '../moduleHelpers';

/**
 * Transcoded-video interface: upload+transcode via S3 profiles.
 * When wired, run() should return `{ kind: 'variants', items: [{ url }, ...] }`.
 * Platform services do not yet wrap uploadS3Asset(transcode:true); run() throws clearly.
 */
export const videoS3TranscodingDataSourceModule: DataSourceModule = defineDataSourceModule({
	apiVersion: DATA_SOURCE_API_VERSION,
	type: 'video-S3-transcoding',
	interfaces: ['transcoded-video'],
	capabilities: ['upload'],
	create({ record }) {
		const inputProfileId = propString(record, 'inputProfileId');
		const outputProfileId = propString(record, 'outputProfileId');
		const path = propString(record, 'repoPath') || propString(record, 'path');
		return createInstanceFromRecord(record, videoS3TranscodingDataSourceModule, {
			capabilities: ['upload'],
			getActions() {
				return [
					{
						id: 'upload',
						kind: 'upload',
						label: `Transcode - ${record.title}`,
						meta: {
							path,
							inputProfileId,
							outputProfileId,
							selectionKind: 'variants'
						},
						async run() {
							unsupportedRemoteError('video-S3-transcoding', 'transcode/upload');
						}
					}
				];
			}
		});
	}
});

export default videoS3TranscodingDataSourceModule;
