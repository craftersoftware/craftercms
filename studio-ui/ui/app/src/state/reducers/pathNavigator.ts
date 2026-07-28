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

import { createReducer } from '@reduxjs/toolkit';
import { getIndividualPaths, getParentPath, withoutIndex } from '../../utils/path';
import {
	pathNavigatorBulkFetchPathComplete,
	pathNavigatorBulkFetchPathFailed,
	pathNavigatorBulkRefresh,
	pathNavigatorChangeLimit,
	pathNavigatorChangePage,
	pathNavigatorClearChecked,
	pathNavigatorConditionallySetPath,
	pathNavigatorConditionallySetPathComplete,
	pathNavigatorConditionallySetPathFailed,
	pathNavigatorFetchParentItems,
	pathNavigatorFetchParentItemsComplete,
	pathNavigatorFetchPath,
	pathNavigatorFetchPathComplete,
	pathNavigatorFetchPathFailed,
	pathNavigatorInit,
	pathNavigatorItemChecked,
	pathNavigatorItemUnchecked,
	pathNavigatorRefresh,
	pathNavigatorSetCollapsed,
	pathNavigatorSetCurrentPath,
	pathNavigatorSetKeyword,
	pathNavigatorSetLocaleCode,
	pathNavigatorUpdate,
	PathNavInitPayload,
	pathNavRootPathMissing
} from '../actions/pathNavigator';
import { changeSiteComplete } from '../actions/sites';
import { fetchSiteUiConfig } from '../actions/configuration';
import { contentEvent, deleteContentEvent, deleteContentEvents, moveContentEvent } from '../actions/system';
import SocketEvent, { MoveContentEventPayload } from '../../models/SocketEvent';
import StandardAction from '../../models/StandardAction';
import { CaseReducer } from '@reduxjs/toolkit/src/createReducer';
import GlobalState from '../../models/GlobalState';

const updatePath = (state, payload) => {
	const { id, parent, children } = payload;
	if (
		// If it's not the first page, and the fetched data has no children, stay on the previous page.
		!(children.offset >= children.limit && children.length === 0)
	) {
		const chunk = state[id];
		const path = parent?.path ?? state[id].currentPath;
		chunk.currentPath = path;
		chunk.breadcrumb = getIndividualPaths(withoutIndex(path), withoutIndex(state[id].rootPath));
		chunk.itemsInPath = children.length === 0 ? [] : children.map((item) => item.path);
		chunk.levelDescriptor = children.levelDescriptor?.path;
		chunk.total = children.total;
		chunk.offset = children.offset;
		chunk.limit = children.limit;
		chunk.isFetching = false;
		chunk.error = null;
	}
};

const deleteContentEventReducer: CaseReducer<GlobalState['pathNavigator'], StandardAction<SocketEvent>> = (
	state,
	{ payload: { targetPath } }: StandardAction<SocketEvent>
) => {
	Object.values(state).forEach((navigator) => {
		const parentPath = getParentPath(targetPath);
		if (targetPath === navigator.rootPath || navigator.rootPath.startsWith(targetPath)) {
			navigator.isRootPathMissing = true;
		} else if (parentPath === navigator.currentPath) {
			if (!navigator.excludes?.includes(targetPath)) {
				navigator.total = navigator.total - 1;
			}
			navigator.itemsInPath = navigator.itemsInPath.filter((path) => path !== targetPath);
			navigator.selectedItems = navigator.selectedItems.filter((path) => path !== targetPath);
		} else if (navigator.levelDescriptor === targetPath) {
			navigator.levelDescriptor = null;
		}
	});
};

const reducer = createReducer<GlobalState['pathNavigator']>({}, (builder) => {
	builder
		.addCase(pathNavigatorInit, (state, action: StandardAction<PathNavInitPayload>) => {
			const {
				id,
				rootPath,
				currentPath = rootPath,
				locale = 'en_US',
				collapsed = true,
				limit = 10,
				keyword = '',
				offset = 0,
				excludes,
				sortStrategy = null,
				order = null
			} = action.payload;
			state[id] = {
				id,
				rootPath,
				currentPath: currentPath,
				localeCode: locale,
				keyword: keyword,
				isSelectMode: false,
				hasClipboard: false,
				levelDescriptor: null,
				itemsInPath: null,
				breadcrumb: [],
				selectedItems: [],
				limit,
				offset,
				total: 0,
				collapsed,
				isFetching: true,
				error: null,
				excludes,
				isRootPathMissing: false,
				sortStrategy,
				order
			};
		})
		.addCase(pathNavigatorSetLocaleCode, (state, { payload: { id, locale } }) => {
			state[id].localeCode = locale;
		})
		.addCase(pathNavigatorSetCurrentPath, (state, { payload: { id, path } }) => {
			state[id].keyword = '';
			state[id].currentPath = path;
			state[id].error = null;
		})
		.addCase(pathNavigatorConditionallySetPath, (state, { payload }) => {
			state[payload.id].isFetching = true;
			state[payload.id].error = null;
		})
		.addCase(pathNavigatorConditionallySetPathComplete, (state, { payload: { id, path, parent, children } }) => {
			const chunk = state[id];
			chunk.isFetching = false;
			chunk.error = null;
			if (parent.childrenCount > 0) {
				chunk.currentPath = path;
				chunk.offset = 0;
				chunk.breadcrumb = getIndividualPaths(withoutIndex(path), withoutIndex(state[id].rootPath));
				chunk.itemsInPath = children.map((item) => item.path);
				chunk.levelDescriptor = children.levelDescriptor?.path;
				chunk.total = children.total;
			}
		})
		.addCase(pathNavigatorConditionallySetPathFailed, (state, { payload }) => {
			state[payload.id].isFetching = false;
			state[payload.id].error = payload.error;
		})
		.addCase(pathNavigatorFetchPath, (state, { payload: { id, path } }) => {
			const chunk = state[id];
			// Set the path navigation revert state, so we can revert to it if the request fails.
			if (!chunk.pathNavigationRevert) {
				chunk.pathNavigationRevert = {
					currentPath: chunk.currentPath,
					breadcrumb: chunk.breadcrumb,
					offset: chunk.offset
				};
			}
			chunk.isFetching = true;
			chunk.error = null;
			chunk.currentPath = path;
			chunk.offset = 0;
			chunk.breadcrumb = getIndividualPaths(withoutIndex(path), withoutIndex(chunk.rootPath));
		})
		.addCase(pathNavigatorFetchPathComplete, (state, { payload }) => {
			const chunk = state[payload.id];
			if (!chunk) {
				return;
			}
			const fetchedPath = payload.parent?.path ?? chunk.currentPath;
			if (withoutIndex(fetchedPath) !== withoutIndex(chunk.currentPath)) {
				return;
			}
			delete chunk.pathNavigationRevert;
			updatePath(state, payload);
		})
		.addCase(pathNavigatorBulkFetchPathComplete, (state, { payload: { paths } }) => {
			paths.forEach((pathPayload) => {
				const chunk = state[pathPayload.id];
				if (!chunk) {
					return;
				}
				const requestedPath = pathPayload.path ?? pathPayload.parent?.path ?? chunk.currentPath;
				if (withoutIndex(requestedPath) !== withoutIndex(chunk.currentPath)) {
					return;
				}
				updatePath(state, pathPayload);
			});
		})
		.addCase(pathNavigatorFetchPathFailed, (state, { payload: { id, error, path } }) => {
			const chunk = state[id];
			if (!chunk) {
				return;
			}
			if (!path || withoutIndex(path) !== withoutIndex(chunk.currentPath)) {
				return;
			}
			const revert = chunk.pathNavigationRevert;
			if (revert) {
				chunk.currentPath = revert.currentPath;
				chunk.breadcrumb = revert.breadcrumb;
				chunk.offset = revert.offset;
				delete chunk.pathNavigationRevert;
			}
			chunk.isFetching = false;
			chunk.error = error;
		})
		.addCase(pathNavigatorBulkFetchPathFailed, (state, { payload: { requests, error } }) => {
			requests.forEach(({ id, path }) => {
				const chunk = state[id];
				if (!chunk) {
					return;
				}
				if (withoutIndex(path) !== withoutIndex(chunk.currentPath)) {
					return;
				}
				chunk.isFetching = false;
				chunk.error = error;
			});
		})
		.addCase(pathNavigatorFetchParentItems, (state, { payload: { id, path } }) => {
			state[id].isFetching = true;
			state[id].currentPath = path;
			state[id].error = null;
		})
		.addCase(pathNavigatorFetchParentItemsComplete, (state, { payload: { id, children } }) => {
			const chunk = state[id];
			const { currentPath, rootPath } = chunk;
			chunk.itemsInPath = children.map((item) => item.path);
			chunk.levelDescriptor = children.levelDescriptor?.path ?? null;
			chunk.breadcrumb = getIndividualPaths(withoutIndex(currentPath), withoutIndex(rootPath));
			chunk.limit = children.limit;
			chunk.total = children.total;
			chunk.offset = children.offset;
			chunk.isFetching = false;
		})
		.addCase(pathNavigatorSetCollapsed, (state, { payload: { id, collapsed } }) => {
			state[id].collapsed = collapsed;
		})
		.addCase(pathNavigatorSetKeyword, (state, { payload: { id, keyword } }) => {
			if (keyword !== (state.keyword as unknown as string)) {
				state[id].keyword = keyword;
				state[id].isFetching = true;
			}
		})
		.addCase(pathNavigatorItemChecked, (state, { payload: { id, item } }) => {
			state[id].itemsInPath.push(item.path);
		})
		.addCase(pathNavigatorItemUnchecked, (state, { payload: { id, item } }) => {
			const chunk = state[id];
			chunk.selectedItems.splice(chunk.selectedItems.indexOf(item.path), 1);
		})
		.addCase(pathNavigatorClearChecked, (state, { payload: { id } }) => {
			state[id].selectedItems = [];
		})
		.addCase(pathNavigatorUpdate, (state, { payload }) => {
			Object.assign(state[payload.id], payload);
		})
		.addCase(pathNavigatorRefresh, (state, { payload: { id } }) => {
			state[id].isFetching = true;
		})
		.addCase(pathNavigatorBulkRefresh, (state, { payload: { requests } }) => {
			requests.forEach(({ id, backgroundRefresh }) => {
				!backgroundRefresh && (state[id].isFetching = true);
				state[id].error = null;
			});
		})
		.addCase(pathNavigatorChangePage, (state, { payload: { id } }) => {
			state[id].isFetching = true;
		})
		.addCase(pathNavigatorChangeLimit, (state, { payload: { id, limit } }) => {
			state[id].limit = limit;
			state[id].isFetching = true;
		})
		.addCase(changeSiteComplete, () => ({}))
		.addCase(fetchSiteUiConfig, () => ({}))
		.addCase(pathNavRootPathMissing, (state, { payload: { id } }) => {
			state[id].isRootPathMissing = true;
			state[id].isFetching = false;
		})
		.addCase(contentEvent, (state, { payload: { targetPath } }: StandardAction<SocketEvent>) => {
			Object.values(state).forEach((navigator) => {
				if (navigator.isRootPathMissing && targetPath === navigator.rootPath) {
					navigator.isRootPathMissing = false;
				}
			});
		})
		.addCase(moveContentEvent, (state, action: StandardAction<MoveContentEventPayload>) => {
			const {
				payload: { targetPath, sourcePath }
			} = action;
			Object.values(state).forEach((navigator) => {
				if (sourcePath === navigator.rootPath) {
					navigator.isRootPathMissing = true;
				} else if (navigator.isRootPathMissing && targetPath === navigator.rootPath) {
					navigator.isRootPathMissing = false;
				}
			});
		})
		.addCase(deleteContentEvent, deleteContentEventReducer)
		.addCase(deleteContentEvents, (state, action) => {
			const auxAction = deleteContentEvent({ ...action.payload, targetPath: '' });
			action.payload.targetPaths.forEach((targetPath) => {
				auxAction.payload.targetPath = targetPath;
				deleteContentEventReducer(state, auxAction);
			});
		});
});

export default reducer;
