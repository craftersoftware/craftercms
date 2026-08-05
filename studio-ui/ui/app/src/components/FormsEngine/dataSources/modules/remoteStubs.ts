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

import { DATA_SOURCE_API_VERSION, type DataSourceCapability, type DataSourceModule } from '../types';
import { createInstanceFromRecord, defineDataSourceModule } from '../defineModule';
import { createRemoteStubAction, propString } from '../moduleHelpers';

function remoteMediaModule(options: {
	type: string;
	interfaces: DataSourceModule['interfaces'];
	kind: 'browse' | 'upload';
	pathProp: 'path' | 'repoPath';
	defaultPath?: string;
	mimeTypes?: string[];
}): DataSourceModule {
	const capabilities: DataSourceCapability[] = [options.kind];
	const module: DataSourceModule = defineDataSourceModule({
		apiVersion: DATA_SOURCE_API_VERSION,
		type: options.type,
		interfaces: options.interfaces,
		capabilities,
		create({ record }) {
			const path = propString(record, options.pathProp, options.defaultPath ?? '');
			const profileId = propString(record, 'profileId') || undefined;
			const label = options.kind === 'browse' ? 'Browse' : 'Upload';
			return createInstanceFromRecord(record, module, {
				capabilities,
				getActions() {
					return [
						createRemoteStubAction({
							id: options.kind,
							kind: options.kind,
							label: `${label} - ${record.title}`,
							type: options.type,
							operation: options.kind,
							meta: {
								path,
								profileId,
								mimeTypes: options.mimeTypes
							}
						})
					];
				}
			});
		}
	});
	return module;
}

export const imgS3UploadDataSourceModule = remoteMediaModule({
	type: 'img-S3-upload',
	interfaces: ['image'],
	kind: 'upload',
	pathProp: 'repoPath',
	mimeTypes: ['image/*']
});

export const imgWebDAVUploadDataSourceModule = remoteMediaModule({
	type: 'img-WebDAV-upload',
	interfaces: ['image'],
	kind: 'upload',
	pathProp: 'repoPath',
	mimeTypes: ['image/*']
});

export const videoS3RepoDataSourceModule = remoteMediaModule({
	type: 'video-S3-repo',
	interfaces: ['video'],
	kind: 'browse',
	pathProp: 'path',
	mimeTypes: ['video/*']
});

export const videoS3UploadDataSourceModule = remoteMediaModule({
	type: 'video-S3-upload',
	interfaces: ['video'],
	kind: 'upload',
	pathProp: 'repoPath',
	mimeTypes: ['video/*']
});

export const videoWebDAVRepoDataSourceModule = remoteMediaModule({
	type: 'video-WebDAV-repo',
	interfaces: ['video'],
	kind: 'browse',
	pathProp: 'repoPath',
	mimeTypes: ['video/*']
});

export const videoWebDAVUploadDataSourceModule = remoteMediaModule({
	type: 'video-WebDAV-upload',
	interfaces: ['video'],
	kind: 'upload',
	pathProp: 'repoPath',
	mimeTypes: ['video/*']
});

export const s3RepoDataSourceModule = remoteMediaModule({
	type: 'S3-repo',
	interfaces: ['item'],
	kind: 'browse',
	pathProp: 'path'
});

export const s3UploadDataSourceModule = remoteMediaModule({
	type: 'S3-upload',
	interfaces: ['item'],
	kind: 'upload',
	pathProp: 'repoPath'
});

export const webDavRepoDataSourceModule = remoteMediaModule({
	type: 'WebDAV-repo',
	interfaces: ['item'],
	kind: 'browse',
	pathProp: 'repoPath'
});

export const webDavUploadDataSourceModule = remoteMediaModule({
	type: 'WebDAV-upload',
	interfaces: ['item'],
	kind: 'upload',
	pathProp: 'repoPath'
});
