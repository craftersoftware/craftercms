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

import { LookupTable } from '@craftercms/models';

export function composeUrl(baseUrl: string, endpoint: string): string;
export function composeUrl(crafterConfig: { baseUrl? }, endpoint: string): string;
export function composeUrl(crafterConfigOrBaseUrl: string | { baseUrl? }, endpoint: string): String {
	const base =
		typeof crafterConfigOrBaseUrl === 'string'
			? crafterConfigOrBaseUrl
			: crafterConfigOrBaseUrl.baseUrl
				? `${crafterConfigOrBaseUrl.baseUrl}/`
				: '';

	return `${base}${endpoint}`.replace(/([^:]\/)\/+/g, '$1');
}

export function isPlainObject(obj) {
	return typeof obj === 'object' && obj !== null && obj.constructor == Object;
}

export function extendDeep(target, source) {
	for (let prop in source) {
		if (source.hasOwnProperty(prop)) {
			if (prop in target && isPlainObject(target[prop]) && isPlainObject(source[prop])) {
				extendDeep(target[prop], source[prop]);
			} else {
				target[prop] = source[prop];
			}
		}
	}
	return target;
}

export function extendDeepExistingProps(target, source) {
	for (let prop in source) {
		if (prop in target && source.hasOwnProperty(prop)) {
			if (isPlainObject(target[prop]) && isPlainObject(source[prop])) {
				extendDeep(target[prop], source[prop]);
			} else {
				target[prop] = source[prop];
			}
		}
	}
	return target;
}

export function nullOrUndefined(value: any) {
	return value == null;
}

export function notNullOrUndefined(value: any) {
	return !nullOrUndefined(value);
}

export function createLookupTable<T>(list: T[], idProp: string = 'id'): LookupTable<T> {
	return list.reduce((table: object, item: T) => {
		const id = item[idProp];
		table[id] = item;
		return table;
	}, {});
}
