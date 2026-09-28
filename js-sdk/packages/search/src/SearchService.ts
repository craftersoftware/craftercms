/*
 * Copyright (C) 2007-2021 Crafter Software Corporation. All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License version 3
 * as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see http://www.gnu.org/licenses/.
 */

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { composeUrl } from '@craftercms/utils';
import { crafterConf, SDKService } from '@craftercms/classes';
import { CrafterConfig } from '@craftercms/models';
import { Query } from './query';

import { v4 as uuid } from 'uuid';
import { SearchResult } from '@craftercms/models/src/search';

/**
 * Does a full-text search and returns a Map model.
 * @param {Query} query - the query object
 */
export function search(query: Query, config?: CrafterConfig): Observable<SearchResult>;
export function search(params: Object, config?: CrafterConfig): Observable<SearchResult>;
export function search(queryOrParams: Query | Object, config?: CrafterConfig): Observable<SearchResult> {
	config = crafterConf.mix(config);
	let requestURL;
	const params = queryOrParams instanceof Query ? queryOrParams.params : queryOrParams;

	if (queryOrParams instanceof Query) {
		requestURL = composeUrl(config, config.endpoints.SEARCH) + '?crafterSite=' + config.site;

		return SDKService.httpPost(requestURL, params).pipe(
			map((response: any) => {
				return response.hits;
			})
		);
	}
}

/**
 * Returns a new Query object
 */
export function createQuery(params?: Object): Query {
	let query = new Query();
	const queryId = params && params['uuid'] ? params['uuid'] : uuid();
	Object.assign(query.params, params);
	query.uuid = queryId;
	return query;
}

/**
 * Implementation of Search Service for ElasticSearch
 */
export const SearchService = {
	search,
	createQuery
};

export default SearchService;
