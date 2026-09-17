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
import { crafterConf, SDKService } from '@craftercms/classes';
import { CrafterConfig, Item } from '@craftercms/models';
import { composeUrl } from '@craftercms/utils';
import { map } from 'rxjs/operators';

/**
 * Returns an Item from the content store.
 * @param {string} path - The item’s path
 */
export function getItem(path: string): Observable<Item>;
export function getItem(path: string, config: Partial<CrafterConfig>): Observable<Item>;
export function getItem(path: string, config?: Partial<CrafterConfig>): Observable<Item> {
	config = crafterConf.mix(config);
	const requestURL = composeUrl(config, config.endpoints.GET_ITEM_URL);
	return SDKService.httpGet(
		requestURL,
		{ url: path, crafterSite: config.site, flatten: Boolean(config?.flatten) },
		config.headers
	);
}

export interface GetDescriptorConfig extends CrafterConfig {
	flatten: boolean;
}

/**
 * Returns the list of Items directly under a folder in the content store.
 * @param {string} path - the folder’s path
 */
export function getChildren(path: string): Observable<Item[]>;
export function getChildren(path: string, config: Partial<CrafterConfig>): Observable<Item[]>;
export function getChildren(path: string, config?: Partial<CrafterConfig>): Observable<Item[]> {
	config = crafterConf.mix(config);
	const requestURL = composeUrl(config, config.endpoints.GET_CHILDREN);
	return SDKService.httpGet(
		requestURL,
		{ url: path, crafterSite: config.site, flatten: Boolean(config?.flatten) },
		config.headers
	);
}

/**
 * Returns the complete Item hierarchy under the specified folder in the content store.
 * @param {string} path - the folder’s path
 * @param {int} depth - Amount of levels to include
 */
export function getTree(path: string): Observable<Item>;
export function getTree(path: string, depth: number): Observable<Item>;
export function getTree(path: string, depth: number, config: Partial<CrafterConfig>): Observable<Item>;
export function getTree(path: string, config: Partial<CrafterConfig>): Observable<Item>;
export function getTree(
	path: string,
	depth: number | Partial<CrafterConfig> = 1,
	config?: Partial<CrafterConfig>
): Observable<Item> {
	if (typeof depth === 'object') {
		config = depth;
		depth = 1;
	}
	config = crafterConf.mix(config);
	const requestURL = composeUrl(config, config.endpoints.GET_TREE);
	return SDKService.httpGet(
		requestURL,
		{ url: path, depth, crafterSite: config.site, flatten: Boolean(config?.flatten) },
		config.headers
	);
}

export const ContentStoreService = {
	getItem,
	getChildren,
	getTree
};

export default ContentStoreService;
