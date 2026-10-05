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

import { post, postJSON } from '../utils/ajax';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';

export function encrypt(text: string): Observable<string>;
export function encrypt(text: string, site: string): Observable<string>;
export function encrypt(text: string, site: string = ''): Observable<string> {
	return postJSON(`/studio/api/2/security/encrypt.json`, { text, siteId: site }).pipe(
		map((response) => response?.response?.item)
	);
}

export function generatePreviewToken(siteIds: string[], expiresAt: string | Date): Observable<string> {
  return postJSON(`/studio/api/2/security/preview/generate_token.json`, {
    siteIds,
    expiresAt: expiresAt instanceof Date ? expiresAt.toISOString() : expiresAt
  }).pipe(map((response) => response?.response?.token));
}

export function previewSwitch(): Observable<true> {
	return post(`/studio/api/2/security/preview/switch`).pipe(map(() => true));
}
