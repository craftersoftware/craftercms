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

import { Observable } from 'rxjs';
import StandardAction from '@craftercms/studio-ui/models/StandardAction';
import { getGlobalHeaders } from '@craftercms/studio-ui/utils/ajax';
import { getRequestForgeryToken } from '@craftercms/studio-ui/utils/auth';
import { toQueryString } from '@craftercms/studio-ui/utils/object';
import { dataUriToBlob, ensureSingleSlash } from '@craftercms/studio-ui/utils/string';

/** XHR upload for EB guests — avoids importing Uppy-backed studio-ui/services/contentUpload. */
export function uploadDataUrl(
	site: string,
	file: { name: string; type: string; dataUrl?: string | ArrayBuffer; blob?: Blob },
	path: string,
	xsrfArgumentName: string
): Observable<StandardAction> {
	const blob = file.blob ?? dataUriToBlob(String(file.dataUrl));
	const qs = toQueryString({ [xsrfArgumentName]: getRequestForgeryToken() });
	const fullPath = ensureSingleSlash(`${path}/${file.name}`);

	return new Observable((subscriber) => {
		const xhr = new XMLHttpRequest();
		const formData = new FormData();
		formData.append('site', site);
		formData.append('name', file.name);
		formData.append('type', file.type);
		formData.append('path', fullPath);
		formData.append('file', blob, file.name);

		xhr.upload.onprogress = (event) => {
			if (!event.lengthComputable) return;
			subscriber.next({
				type: 'progress',
				payload: {
					file,
					progress: { bytesUploaded: event.loaded, bytesTotal: event.total }
				}
			});
		};

		xhr.onload = () => {
			let body: unknown = xhr.responseText;
			try {
				body = JSON.parse(xhr.responseText);
			} catch {
				// keep raw text
			}
			const response = { status: xhr.status, body, bytesUploaded: blob.size };
			if (xhr.status >= 200 && xhr.status < 300) {
				subscriber.next({ type: 'complete', payload: response });
				subscriber.complete();
			} else {
				subscriber.error(Object.assign({}, response, { error: response }));
			}
		};

		xhr.onerror = () => {
			const response = { status: xhr.status, body: xhr.responseText };
			subscriber.error(Object.assign({}, response, { error: response }));
		};

		xhr.open('PUT', `/studio/api/2/content/${site}${qs}`);
		Object.entries(getGlobalHeaders() ?? {}).forEach(([key, value]) => {
			if (value != null) xhr.setRequestHeader(key, String(value));
		});
		xhr.send(formData);

		return () => xhr.abort();
	});
}
