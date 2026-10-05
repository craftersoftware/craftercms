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

import { forkJoin, Observable, Observer } from 'rxjs';
import { get, postJSON } from '../utils/ajax';
import { map } from 'rxjs/operators';
import { fetchContentItem } from './content';
import TranslationConfig from '../models/TranslationConfig';

export function fetchItemLocales(site: string, path: string): Observable<any> {
	return forkJoin({
		item: fetchContentItem(site, path),
		locales: fetchTargetLocales(site, path)
	}).pipe(
		map(({ item, locales }) => ({
			item,
			locales: locales.items
		}))
	);
}

export function fetchTargetLocales(site: string, path: string): Observable<any> {
	// /studio/api/2/translation/list_target_locales
	const response = {
		response: {},
		items: [
			{
				id: '1',
				status: 'Edited by me',
				localeCode: 'en',
				path: 'path'
			},
			{
				id: '2',
				status: 'Machine translations complete',
				localeCode: 'es',
				path: 'path'
			},
			{
				id: '3',
				status: 'Published',
				localeCode: 'en',
				path: 'path'
			},
			{
				id: '4',
				status: 'Not translated',
				localeCode: 'es',
				path: 'path'
			}
		]
	};

	return new Observable((observer: Observer<any>) => {
		observer.next(response);
		observer.complete();
	});
}

export function markForTranslation(site: string, path: string, locale: string) {
	return postJSON('/studio/api/2/translation/mark_for_translation_by_path', {
		siteId: site,
		path: [path],
		locales: [locale]
	});
}

export function fetchSiteLocales(site: string): Observable<TranslationConfig> {
	return get(`/studio/api/2/configuration/${site}/translation`).pipe(map((response) => response?.response?.config));
}
