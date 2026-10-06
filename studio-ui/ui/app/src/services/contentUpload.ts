/*
 * Copyright (C) 2007-2022 Crafter Software Corporation. All Rights Reserved.
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

import { getGlobalHeaders } from '../utils/ajax';
import { Observable } from 'rxjs';
import { toQueryString } from '../utils/object';
import { dataUriToBlob, ensureSingleSlash } from '../utils/string';
import { Uppy as Core, XHRUpload } from 'uppy';
import { getRequestForgeryToken } from '../utils/auth';
import { StandardAction } from '../models/StandardAction';

// Kept separate from services/content so guests can import lock/fetchContentItem without Uppy.

export function createFileUpload(
	uploadUrl: string,
	file: any,
	path: string,
	uploadMeta: (Record<string, unknown> & { site: string }) | Record<string, unknown>,
	xsrfArgumentName: string = '_csrf'
): Observable<StandardAction> {
	const blob = file.blob ?? dataUriToBlob(file.dataUrl);
	return uploadBlob(
		(uploadMeta?.site ?? uploadMeta?.siteId) as string,
		path,
		{ name: file.name, type: file.type, blob },
		uploadMeta,
		uploadUrl,
		xsrfArgumentName
	);
}

// region uploadBlob
export function uploadBlob(
	site: string,
	path: string,
	fileData: {
		name: string;
		type: string;
		blob: Blob;
	}
): Observable<StandardAction>;
export function uploadBlob(
	site: string,
	path: string,
	fileData: {
		name: string;
		type: string;
		blob: Blob;
	},
	uploadMeta: Record<string, unknown>
): Observable<StandardAction>;
export function uploadBlob(
	site: string,
	path: string,
	fileData: {
		name: string;
		type: string;
		blob: Blob;
	},
	uploadMeta: Record<string, unknown>,
	uploadUrl: string
): Observable<StandardAction>;
export function uploadBlob(
	site: string,
	path: string,
	fileData: {
		name: string;
		type: string;
		blob: Blob;
	},
	uploadMeta: Record<string, unknown>,
	uploadUrl: string,
	xsrfArgumentName: string
): Observable<StandardAction>;
export function uploadBlob(
	site: string,
	path: string,
	fileData: {
		name: string;
		type: string;
		blob: Blob;
	},
	uploadMeta: Record<string, unknown> = {},
	uploadUrl: string = `/studio/api/2/content/${site}`,
	xsrfArgumentName: string = '_csrf'
): Observable<StandardAction> {
	const qs = toQueryString({ [xsrfArgumentName]: getRequestForgeryToken() });
	return new Observable((subscriber) => {
		const uppy = new Core({ autoProceed: true });

		uppy.use(XHRUpload, { endpoint: `${uploadUrl}${qs}`, method: 'PUT', headers: getGlobalHeaders() });

		const fullPath = ensureSingleSlash(`${path}/${fileData.name}`);
		uppy.setMeta({ ...uploadMeta, path: fullPath });

		uppy.on('upload-success', (file, response) => {
			subscriber.next({ type: 'complete', payload: response });
			subscriber.complete();
		});

		uppy.on('upload-progress', (file, progress) => {
			subscriber.next({ type: 'progress', payload: { file, progress } });
		});

		uppy.on('upload-error', (file, error, response) => {
			subscriber.error(Object.assign({}, response, { error: response }));
		});

		uppy.addFile({ name: fileData.name, type: fileData.type, data: fileData.blob });

		return () => {
			uppy.cancelAll();
		};
	});
}
// endregion

export function uploadDataUrl(
	site: string,
	file: any,
	path: string,
	xsrfArgumentName: string
): Observable<StandardAction> {
	return createFileUpload(
		`/studio/api/2/content/${site}`,
		file,
		path,
		{
			site,
			name: file.name,
			type: file.type,
			path
		},
		xsrfArgumentName
	);
}

export function uploadToS3(
	site: string,
	file: any,
	path: string,
	profileId: string,
	xsrfArgumentName: string
): Observable<StandardAction> {
	return createFileUpload(
		`/studio/api/2/aws/${site}/s3/upload.json`,
		file,
		path,
		{
			name: file.name,
			type: file.type,
			path,
			profileId: profileId
		},
		xsrfArgumentName
	);
}

export function uploadToWebDAV(
	site: string,
	file: any,
	path: string,
	profileId: string,
	xsrfArgumentName: string
): Observable<StandardAction> {
	return createFileUpload(
		`/studio/api/2/webdav/${site}/upload`,
		file,
		path,
		{
			name: file.name,
			type: file.type,
			path,
			profileId: profileId
		},
		xsrfArgumentName
	);
}
