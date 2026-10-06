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

import { del, get, postJSON } from '../utils/ajax';
import {
	Action,
	BackendSite,
	ContentValidationResult,
	CreateSiteMeta,
	DetailedSite,
	DuplicateSiteMeta,
	Site
} from '../models/Site';
import { map, pluck } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { PagedArray } from '../models/PagedArray';
import { PaginationOptions } from '../models/PaginationOptions';
import { MarketplacePlugin } from '../models/MarketplacePlugin';
import { underscore } from '../utils/string';
import { Api2BulkResponseFormat, Api2ResponseFormat } from '../models/ApiResponse';
import { FetchPublishingTargetsResponse } from './publishing';
import { reversePluckProps } from '../utils/object';

interface BuiltInBlueprint {
	descriptorVersion: string;
	plugin: MarketplacePlugin;
}

export function fetchBlueprints(): Observable<BuiltInBlueprint[]> {
	return get<
		Api2ResponseFormat<{
			blueprints: BuiltInBlueprint[];
		}>
	>('/studio/api/2/sites/available_blueprints').pipe(map((response) => response?.response?.blueprints));
}

export function fetchAll(paginationOptions?: PaginationOptions): Observable<PagedArray<Site>> {
	const options: PaginationOptions = Object.assign(
		{
			limit: 100,
			offset: 0
		},
		paginationOptions || {}
	);
	return get<
		Api2BulkResponseFormat<{
			sites: BackendSite[];
		}>
	>(`/studio/api/2/users/me/sites?limit=${options.limit}&offset=${options.offset}`).pipe(
		map(({ response }) =>
			Object.assign(
				response.sites.map((site) => ({
					id: site.siteId,
					uuid: site.uuid,
					name: site.name ?? site.siteId,
					description: site.desc,
					state: site.state
				})),
				{
					limit: response.limit,
					offset: response.offset,
					total: response.total
				}
			)
		)
	);
}

export function create(site: CreateSiteMeta) {
	return postJSON('/studio/api/2/sites', site).pipe(
		map(() => ({
			id: site.siteId,
			name: site.name,
			description: site.description ?? '',
			uuid: null,
			imageUrl: `/.crafter/screenshots/default.png?crafterSite=${site.siteId}`
		}))
	);
}

export function duplicate(site: DuplicateSiteMeta): Observable<Site> {
	return postJSON(`/studio/api/2/sites/${site.sourceSiteId}/duplicate`, reversePluckProps(site, 'sourceSiteId')).pipe(
		map(() => ({
			id: site.siteId,
			name: site.siteName,
			description: site.description ?? '',
			uuid: null,
			imageUrl: `/.crafter/screenshots/default.png?crafterSite=${site.siteId}`
		}))
	);
}

export function trash(id: string): Observable<boolean> {
	return del(`/studio/api/2/sites/${id}`).pipe(map(() => true));
}

export function update(site: Omit<Site, 'uuid' | 'imageUrl'>): Observable<Api2ResponseFormat<{}>> {
	return postJSON<Api2ResponseFormat<{}>>(`/studio/api/2/sites/${site.id}`, {
		name: site.name,
		description: site.description
	}).pipe(map((response) => response?.response));
}

export function exists(siteId: string): Observable<boolean> {
	return get(`/studio/api/2/sites/${siteId}/exists`).pipe(map(({ response }) => response?.exists));
}

export function validateActionPolicy(site: string, action: Action): Observable<ContentValidationResult>;
export function validateActionPolicy(site: string, actions: Action[]): Observable<ContentValidationResult[]>;
export function validateActionPolicy(
	site: string,
	action: Action | Action[]
): Observable<ContentValidationResult | ContentValidationResult[]> {
	const multi = Array.isArray(action);
	const actions = multi ? action : [action];
	const toPluck = ['response', 'results', !multi && '0'].filter(Boolean) as ['response', 'results', 0?];
	return postJSON<Api2ResponseFormat<{ results: ContentValidationResult[] }>>(
		`/studio/api/2/sites/${site}/policy/validate`,
		{
			actions
		}
	).pipe(pluck(...toPluck));
}

export function fetchSite(siteId: string): Observable<DetailedSite> {
	return get(`/studio/api/2/sites/${siteId}`).pipe(map(({ response }) => response?.site));
}

export function hasInitialPublish(siteId: string): Observable<boolean> {
	return get<FetchPublishingTargetsResponse>(`/studio/api/2/publish/${siteId}/available_targets`).pipe(
		map((response) => response?.response?.published)
	);
}
