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

import { errorSelectorApi1, post, postJSON } from '../utils/ajax';
import { catchError, map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { LegacyItem, LightItem } from '../models/Item';
import { toQueryString } from '../utils/object';

export interface FetchDependenciesResponse {
	hardDependencies: string[];
	softDependencies: string[];
}

export function fetchDependencies(siteId: string, paths: string[]): Observable<FetchDependenciesResponse> {
	return postJSON(`/studio/api/2/dependency/${siteId}/publish_dependencies`, { paths }).pipe(
		map((response) => response?.response?.items)
	);
}

export function fetchSimpleDependencies(site: string, path: string): Observable<LightItem[]> {
	return post(`/studio/api/2/dependency/${site}/dependencies`, { path }).pipe(
		map((response) => response?.response?.items),
		catchError(errorSelectorApi1)
	);
}

export function fetchDependant(site: string, path: string): Observable<LightItem[]> {
	return post(`/studio/api/2/dependency/${site}/dependent_items`, { path }).pipe(
		map((response) => response?.response?.items),
		catchError(errorSelectorApi1)
	);
}

export interface FetchDeleteDependenciesResponse {
	childItems: LightItem[];
	dependentItems: LightItem[];
}

export function fetchDeleteDependencies(siteId: string, paths: string[]): Observable<FetchDeleteDependenciesResponse> {
	return postJSON(`/studio/api/2/content/${siteId}/get_delete_package`, {
		paths
	}).pipe(map((response) => response?.response?.items));
}
