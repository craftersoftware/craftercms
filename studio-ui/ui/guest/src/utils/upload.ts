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
import { filter } from 'rxjs/operators';
import { v4 as uuid } from 'uuid';
import StandardAction from '@craftercms/studio-ui/models/StandardAction';
import {
	guestUploadComplete,
	guestUploadFailed,
	guestUploadProgress,
	requestGuestUpload
} from '@craftercms/studio-ui/state/actions/preview';
import { message$, post } from './communicator';

/**
 * Asks Studio (host) to run Uppy-backed `contentUpload.uploadDataUrl`.
 * Keeps Uppy out of the Experience Builder / Next guest module graph.
 */
export function uploadDataUrl(
	site: string,
	file: { name: string; type: string; dataUrl?: string | ArrayBuffer; blob?: Blob },
	path: string,
	xsrfArgumentName: string
): Observable<StandardAction> {
	return new Observable((subscriber) => {
		const id = uuid();
		const subscription = message$
			.pipe(
				filter(
					(action) =>
						action.payload?.id === id &&
						[guestUploadProgress.type, guestUploadComplete.type, guestUploadFailed.type].includes(action.type)
				)
			)
			.subscribe((action) => {
				if (action.type === guestUploadProgress.type) {
					subscriber.next({
						type: 'progress',
						payload: { file, progress: action.payload.progress }
					});
				} else if (action.type === guestUploadComplete.type) {
					subscriber.next({ type: 'complete', payload: action.payload.response });
					subscriber.complete();
				} else {
					subscriber.error(action.payload?.error ?? action.payload);
				}
			});

		post(requestGuestUpload({ id, site, file, path, xsrfArgumentName }));

		return () => subscription.unsubscribe();
	});
}
