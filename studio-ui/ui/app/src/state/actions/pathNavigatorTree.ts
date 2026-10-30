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

import { createAction } from '@reduxjs/toolkit';
import { ContentItem } from '../../models/Item';
import { AjaxError } from 'rxjs/ajax';
import { GetChildrenResponse } from '../../models/GetChildrenResponse';
import { GetChildrenOptions } from '../../models/GetChildrenOptions';
import LookupTable from '../../models/LookupTable';
import SystemType from '../../models/SystemType';
import SimpleAjaxError from '../../models/SimpleAjaxError';

type PayloadWithId<P> = P & { id: string };

export const pathNavigatorTreeInit = /*#__PURE__*/ createAction<
	PayloadWithId<{
		rootPath: string;
		collapsed?: boolean;
		excludes?: string[];
		limit: number;
		expanded?: string[];
		systemTypes?: SystemType[];
		sortStrategy?: GetChildrenOptions['sortStrategy'];
		order?: GetChildrenOptions['order'];
		keywordByPath: LookupTable<string>;
		seedFilteredChildTotals?: boolean;
	}>
>('PATH_NAV_TREE_INIT');

export const pathNavigatorTreeRefresh = /*#__PURE__*/ createAction<{ id: string }>('PATH_NAV_TREE_REFRESH');

export const pathNavigatorTreeBackgroundRefresh = /*#__PURE__*/ createAction<{ id: string }>(
	'PATH_NAV_TREE_BACKGROUND_REFRESH'
);

export const pathNavigatorTreeBulkRefresh = /*#__PURE__*/ createAction<{
	requests: PayloadWithId<{ backgroundRefresh?: boolean }>[];
}>('PATH_NAV_TREE_BULK_REFRESH');

export const pathNavigatorTreeRestore = /*#__PURE__*/ createAction<PayloadWithId<{}>>('PATH_NAV_TREE_RESTORE');

export type PathNavigatorTreeRestoreCompletePayload = PayloadWithId<{
	expanded: string[];
	collapsed: boolean;
	items: ContentItem[];
	children: LookupTable<GetChildrenResponse>;
}>;

export const pathNavigatorTreeRestoreComplete = /*#__PURE__*/ createAction<PathNavigatorTreeRestoreCompletePayload>(
	'PATH_NAV_TREE_RESTORE_COMPLETE'
);

export const pathNavigatorTreeBulkRestoreComplete = /*#__PURE__*/ createAction<{
	trees: PathNavigatorTreeRestoreCompletePayload[];
}>('PATH_NAV_TREE_BULK_RESTORE_COMPLETE');

export const pathNavigatorTreeRestoreFailed = /*#__PURE__*/ createAction<{
	id: string;
	error: Omit<AjaxError, 'request' | 'xhr'>;
}>('PATH_NAV_TREE_RESTORE_FAILED');

export const pathNavigatorTreeBulkRestoreFailed = /*#__PURE__*/ createAction<{
	ids: string[];
	error: Omit<AjaxError, 'request' | 'xhr'>;
}>('PATH_NAV_TREE_RESTORE_FAILED');

export const pathNavigatorTreeExpandPath =
	/*#__PURE__*/ createAction<PayloadWithId<{ path: string }>>('PATH_NAV_TREE_EXPAND_PATH');

export const pathNavigatorTreeCollapsePath =
	/*#__PURE__*/ createAction<PayloadWithId<{ path: string }>>('PATH_NAV_TREE_COLLAPSE_PATH');

export const pathNavigatorTreeSetKeyword =
	/*#__PURE__*/ createAction<PayloadWithId<{ keyword: string; path: string }>>('PATH_NAV_TREE_SET_KEYWORD');

export const pathNavigatorTreeToggleCollapsed = /*#__PURE__*/ createAction<PayloadWithId<{ collapsed: boolean }>>(
	'PATH_NAV_TREE_TOGGLE_EXPANDED'
);

export const pathNavigatorTreeFetchPathPage = /*#__PURE__*/ createAction<
	PayloadWithId<{ path: string; options?: Partial<GetChildrenOptions> }>
>('PATH_NAV_TREE_FETCH_PATH_PAGE');

export const pathNavigatorTreeFetchPathPageComplete = /*#__PURE__*/ createAction<
	PayloadWithId<{
		children: GetChildrenResponse;
		parentPath: string;
		options?: Partial<GetChildrenOptions>;
		childTotals?: LookupTable<number>;
	}>
>('PATH_NAV_TREE_FETCH_PATH_PAGE_COMPLETE');

export const pathNavigatorTreeFetchPathPageFailed = /*#__PURE__*/ createAction<{
	id: string;
	error: Omit<AjaxError, 'request' | 'xhr'>;
}>('PATH_NAV_TREE_FETCH_PATH_PAGE_FAILED');

export type PathNavTreeFetchPathChildrenPayload = PayloadWithId<{
	path: string;
	options?: Partial<GetChildrenOptions>;
	expand?: boolean;
}>;

export const pathNavigatorTreeFetchPathChildren = /*#__PURE__*/ createAction<PathNavTreeFetchPathChildrenPayload>(
	'PATH_NAV_TREE_FETCH_PATH_CHILDREN'
);

export type PathNavTreeBulkFetchPathChildrenPayload = { requests: Array<PathNavTreeFetchPathChildrenPayload> };

export const pathNavigatorTreeBulkFetchPathChildren =
	/*#__PURE__*/ createAction<PathNavTreeBulkFetchPathChildrenPayload>('PATH_NAV_TREE_BULK_FETCH_PATH_CHILDREN');

export const pathNavigatorTreeFetchPathChildrenComplete = /*#__PURE__*/ createAction<
	PayloadWithId<{
		children: GetChildrenResponse;
		parentPath: string;
		options?: Partial<GetChildrenOptions>;
		childTotals?: LookupTable<number>;
	}>
>('PATH_NAV_TREE_FETCH_PATH_CHILDREN_COMPLETE');

export type PathNavTreeBulkFetchPathChildrenCompletePayload = {
	paths: PayloadWithId<{
		children: GetChildrenResponse;
		parentPath: string;
		options?: Partial<GetChildrenOptions>;
		childTotals?: LookupTable<number>;
	}>[];
};

export const pathNavigatorTreeBulkFetchPathChildrenComplete =
	/*#__PURE__*/ createAction<PathNavTreeBulkFetchPathChildrenCompletePayload>(
		'PATH_NAV_BULK_TREE_FETCH_PATH_CHILDREN_COMPLETE'
	);

export const pathNavigatorTreeFetchPathChildrenFailed = /*#__PURE__*/ createAction<{
	id: string;
	path: string;
	error: SimpleAjaxError;
}>('PATH_NAV_TREE_FETCH_PATH_CHILDREN_FAILED');

export const pathNavigatorTreeBulkFetchPathChildrenFailed = /*#__PURE__*/ createAction<{
	ids: string[];
	error: Omit<AjaxError, 'request' | 'xhr'>;
}>('PATH_NAV_TREE_BULK_FETCH_PATH_CHILDREN_FAILED');

export const pathNavigatorTreeUpdate = /*#__PURE__*/ createAction<
	PayloadWithId<{
		expanded?: string[];
		collapsed?: boolean;
		items?: ContentItem[];
		data?: LookupTable<GetChildrenResponse>;
		sortStrategy?: GetChildrenOptions['sortStrategy'];
		order?: GetChildrenOptions['order'];
	}>
>('PATH_NAV_TREE_UPDATE');

export const pathNavigatorTreeRootMissing = /*#__PURE__*/ createAction<PayloadWithId<{}>>('PATH_NAV_TREE_ROOT_MISSING');
