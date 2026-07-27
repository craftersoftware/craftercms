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
import { PathNavigatorStateProps } from '../../components/PathNavigator/PathNavigator';
import { GetChildrenResponse } from '../../models/GetChildrenResponse';
import { AjaxError } from 'rxjs/ajax';
import { GetChildrenOptions } from '../../models';

type PayloadWithId<P> = P & { id: string };

export type PathNavInitPayload = PayloadWithId<{
	rootPath: string;
	locale?: string;
	collapsed?: boolean;
	excludes?: string[];
	limit?: number;
	currentPath?: string;
	keyword?: string;
	offset?: number;
	sortStrategy?: GetChildrenOptions['sortStrategy'];
	order?: GetChildrenOptions['order'];
}>;

export const pathNavigatorInit = /*#__PURE__*/ createAction<PathNavInitPayload>('PATH_NAV_INIT');

export const pathNavigatorSetLocaleCode =
	/*#__PURE__*/ createAction<PayloadWithId<{ locale: string }>>('PATH_NAV_SET_LOCALE_CODE');

export const pathNavigatorUpdate =
	/*#__PURE__*/ createAction<PayloadWithId<Partial<PathNavigatorStateProps>>>('PATH_NAV_UPDATE');

export const pathNavigatorSetCollapsed =
	/*#__PURE__*/ createAction<PayloadWithId<{ collapsed: boolean }>>('PATH_NAV_SET_COLLAPSED');

export const pathNavigatorSetCurrentPath =
	/*#__PURE__*/ createAction<PayloadWithId<{ path: string }>>('PATH_NAV_SET_CURRENT_PATH');

export const pathNavigatorConditionallySetPath = /*#__PURE__*/ createAction<
	PayloadWithId<{ path: string; keyword?: string }>
>('PATH_NAV_CONDITIONALLY_SET_PATH');

export const pathNavigatorConditionallySetPathComplete = /*#__PURE__*/ createAction<
	PayloadWithId<{ path: string; parent?: ContentItem; children: GetChildrenResponse }>
>('PATH_NAV_CONDITIONALLY_SET_PATH_COMPLETE');

export const pathNavigatorConditionallySetPathFailed = /*#__PURE__*/ createAction<{
	id: string;
	error: { status: number; message: string };
}>('PATH_NAV_CONDITIONALLY_SET_PATH_FAILED');

export const pathNavigatorRefresh = /*#__PURE__*/ createAction<{ id: string }>('PATH_NAV_REFRESH');

export const pathNavigatorBackgroundRefresh = /*#__PURE__*/ createAction<{ id: string }>('PATH_NAV_BACKGROUND_REFRESH');

export const pathNavigatorBulkRefresh = /*#__PURE__*/ createAction<{
	requests: PayloadWithId<{ backgroundRefresh?: boolean }>[];
}>('PATH_NAV_BULK_REFRESH');

export const pathNavigatorItemChecked =
	/*#__PURE__*/ createAction<PayloadWithId<{ item: ContentItem }>>('PATH_NAV_ITEM_CHECKED');

export const pathNavigatorItemUnchecked =
	/*#__PURE__*/ createAction<PayloadWithId<{ item: ContentItem }>>('PATH_NAV_ITEM_UNCHECKED');

export const pathNavigatorClearChecked = /*#__PURE__*/ createAction<{ id: string }>('PATH_NAV_CLEAR_CHECKED');

export const pathNavigatorFetchParentItems = /*#__PURE__*/ createAction<
	PayloadWithId<{
		path: string;
		excludes?: string[];
		limit: number;
		offset?: number;
		keyword?: string;
		sortStrategy: string;
		order: string;
	}>
>('PATH_NAV_FETCH_PARENT_ITEMS');

export const pathNavigatorFetchPath =
	/*#__PURE__*/ createAction<PayloadWithId<{ path: string; keyword?: string }>>('PATH_NAV_FETCH_PATH');

export const pathNavigatorFetchPathComplete =
	/*#__PURE__*/ createAction<PayloadWithId<{ parent?: ContentItem; children: GetChildrenResponse }>>(
		'PATH_NAV_FETCH_PATH_COMPLETE'
	);

export const pathNavigatorBulkFetchPathComplete = /*#__PURE__*/ createAction<{
	paths: PayloadWithId<{ parent?: ContentItem; children: GetChildrenResponse }>[];
}>('PATH_NAV_BULK_FETCH_PATH_COMPLETE');

export const pathNavigatorFetchParentItemsComplete = /*#__PURE__*/ createAction<
	PayloadWithId<{ items: ContentItem[]; children: GetChildrenResponse }>
>('PATH_NAV_FETCH_PARENT_ITEMS_COMPLETE');

export const pathNavigatorFetchPathFailed = /*#__PURE__*/ createAction<{
	id: string;
	error: Omit<AjaxError, 'request' | 'xhr'>;
	/** When set, failure is ignored if it does not match the navigator's current path (stale request). */
	path?: string;
}>('PATH_NAV_FETCH_PATH_FAILED');

export const pathNavigatorBulkFetchPathFailed = /*#__PURE__*/ createAction<{
	ids: string[];
	error: Omit<AjaxError, 'request' | 'xhr'>;
}>('PATH_NAV_BULK_FETCH_PATH_FAILED');

export const pathNavigatorSetKeyword =
	/*#__PURE__*/ createAction<PayloadWithId<{ keyword: string }>>('PATH_NAV_SET_KEYWORD');

export const pathNavigatorChangePage =
	/*#__PURE__*/ createAction<PayloadWithId<{ offset: number }>>('PATH_NAV_CHANGE_PAGE');

export const pathNavigatorChangeLimit =
	/*#__PURE__*/ createAction<PayloadWithId<{ limit: number; offset: number }>>('PATH_NAV_CHANGE_LIMIT');

export const pathNavRootPathMissing = /*#__PURE__*/ createAction<PayloadWithId<{}>>('PATH_NAV_ROOT_MISSING');
