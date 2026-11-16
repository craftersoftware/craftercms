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
import { ContentItem, FetchContentVersion, ItemHistoryEntry } from '../../models';
import { AjaxError, AjaxResponse } from 'rxjs/ajax';

export interface HistoryConfigProps {
	item: Partial<ContentItem>;
	rootPath?: string;
	environment?: string;
	module?: string;
	isConfig?: boolean;
}

export const fetchItemVersions = /*#__PURE__*/ createAction<HistoryConfigProps>('FETCH_ITEM_VERSIONS');
export const fetchItemVersionsComplete = /*#__PURE__*/ createAction<ItemHistoryEntry[]>('FETCH_ITEM_VERSIONS_COMPLETE');
export const fetchItemVersionsFailed = /*#__PURE__*/ createAction<AjaxError>('FETCH_ITEM_VERSIONS_FAILED');
export const versionsChangePage = /*#__PURE__*/ createAction<{ page: number }>('VERSIONS_CHANGE_PAGE');
export const versionsChangeLimit = /*#__PURE__*/ createAction<{ limit: number }>('VERSIONS_CHANGE_LIMIT');
export const versionsChangeItem = /*#__PURE__*/ createAction<{ item: ContentItem }>('VERSIONS_CHANGE_ITEM');
export const compareToPreviousVersion = /*#__PURE__*/ createAction<{ id: string }>('COMPARE_TO_PREVIOUS_VERSION');
export const resetVersionsState = /*#__PURE__*/ createAction('RESET_VERSIONS_STATE');
export const compareBothVersions = /*#__PURE__*/ createAction<{ versions: string[] }>('COMPARE_BOTH_VERSIONS');
export const compareBothVersionsComplete = /*#__PURE__*/ createAction<any>('COMPARE_BOTH_VERSIONS_COMPLETE');
export const compareBothVersionsFailed = /*#__PURE__*/ createAction<any>('COMPARE_BOTH_VERSIONS_FAILED');
export const revertContent = /*#__PURE__*/ createAction<FetchContentVersion & { siteId?: string }>('REVERT_CONTENT');
export const revertContentComplete = /*#__PURE__*/ createAction<{ path: string }>('REVERT_CONTENT_COMPLETE');
export const revertContentFailed = /*#__PURE__*/ createAction<AjaxResponse<unknown>>('REVERT_CONTENT_FAILED');
export const revertToPreviousVersion = /*#__PURE__*/ createAction<{ id: string; path: string; siteId?: string }>(
	'REVERT_TO_PREVIOUS_VERSION'
);
