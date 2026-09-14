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

import { Descriptor, Item, NavigationItem } from '@craftercms/models';
import { createAction } from '@reduxjs/toolkit';
import { internal_getNav, internal_getNavBreadcrumb } from './content_internal';

export const getItem = /*#__PURE__*/ createAction<string>('GET_ITEM');

export const getItemComplete = /*#__PURE__*/ createAction<{ url: string; item?: Item }>('GET_ITEM_COMPLETE');

export const getDescriptor = /*#__PURE__*/ createAction<string>('GET_DESCRIPTOR');

export const getDescriptorComplete = /*#__PURE__*/ createAction<{ url: string; descriptor?: Descriptor }>(
	'GET_DESCRIPTOR_COMPLETE'
);

export const getChildren = /*#__PURE__*/ createAction<string>('GET_CHILDREN');

export const getChildrenComplete = /*#__PURE__*/ createAction<{ url: string; children?: Array<Item> }>(
	'GET_CHILDREN_COMPLETE'
);

export const getTree = /*#__PURE__*/ createAction<{ url: string; depth?: Number }>('GET_TREE');

export const getTreeComplete = /*#__PURE__*/ createAction<{ url: string; tree?: Item }>('GET_TREE_COMPLETE');

interface GetNavAction {
	type: string;
	payload: {
		url: string;
		depth?: Number;
		currentPageUrl?: string;
	};
}

export function getNav(url: string): GetNavAction;
export function getNav(url: string, depth: Number): GetNavAction;
export function getNav(url: string, depth: Number, currentPageUrl: string): GetNavAction;
export function getNav(payload: { url: string; depth?: Number; currentPageUrl?: string }): GetNavAction;
export function getNav(
	payloadOrUrl: string | { url: string; depth?: Number; currentPageUrl?: string },
	depth: Number = 1,
	currentPageUrl: string = ''
): GetNavAction {
	if (typeof payloadOrUrl === 'string') {
		console.warn(
			'Warning: This signature is deprecated, adjust to use the object signature instead ({ url, depth?, currentPageUrl? }).'
		);
		return internal_getNav({ url: payloadOrUrl, depth, currentPageUrl });
	} else {
		return internal_getNav(payloadOrUrl);
	}
}

export const getNavComplete = /*#__PURE__*/ createAction<{ url: string; nav?: NavigationItem }>('GET_NAV_COMPLETE');

export interface GetNavBreadcrumbAction {
	type: string;
	payload: {
		url: string;
		root?: string;
	};
}

export function getNavBreadcrumb(url: string): GetNavBreadcrumbAction;
export function getNavBreadcrumb(url: string, root: string): GetNavBreadcrumbAction;
export function getNavBreadcrumb(payload: { url: string; root?: string }): GetNavBreadcrumbAction;
export function getNavBreadcrumb(
	payloadOrUrl: string | { url: string; root?: string },
	root: string = ''
): GetNavBreadcrumbAction {
	if (typeof payloadOrUrl === 'string') {
		console.warn('Warning: This signature is deprecated, adjust to use the object signature instead ({ url, root? }).');
		return internal_getNavBreadcrumb({ url: payloadOrUrl, root });
	} else {
		return internal_getNavBreadcrumb(payloadOrUrl);
	}
}

export const getNavBreadcrumbComplete = /*#__PURE__*/ createAction<{ url: string; breadcrumb?: Array<NavigationItem> }>(
	'GET_NAV_BREADCRUMB_COMPLETE'
);
