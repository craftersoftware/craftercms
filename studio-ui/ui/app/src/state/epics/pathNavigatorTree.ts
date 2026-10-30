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

import { ofType } from 'redux-observable';
import {
	catchError,
	filter,
	ignoreElements,
	map,
	mergeMap,
	switchMap,
	tap,
	throttleTime,
	withLatestFrom
} from 'rxjs/operators';
import { CrafterCMSEpic } from '../store';
import {
	pathNavigatorTreeBackgroundRefresh,
	pathNavigatorTreeBulkFetchPathChildren,
	pathNavigatorTreeBulkFetchPathChildrenComplete,
	pathNavigatorTreeBulkFetchPathChildrenFailed,
	pathNavigatorTreeBulkRefresh,
	pathNavigatorTreeBulkRestoreComplete,
	pathNavigatorTreeBulkRestoreFailed,
	pathNavigatorTreeCollapsePath,
	pathNavigatorTreeExpandPath,
	pathNavigatorTreeFetchPathChildren,
	pathNavigatorTreeFetchPathChildrenComplete,
	pathNavigatorTreeFetchPathChildrenFailed,
	pathNavigatorTreeFetchPathPage,
	pathNavigatorTreeFetchPathPageComplete,
	pathNavigatorTreeFetchPathPageFailed,
	pathNavigatorTreeInit,
	pathNavigatorTreeRefresh,
	pathNavigatorTreeRestore,
	pathNavigatorTreeRestoreComplete,
	pathNavigatorTreeRestoreFailed,
	pathNavigatorTreeRootMissing,
	pathNavigatorTreeSetKeyword,
	pathNavigatorTreeToggleCollapsed,
	pathNavigatorTreeUpdate,
	PathNavigatorTreeRestoreCompletePayload,
	PathNavTreeBulkFetchPathChildrenPayload,
	PathNavTreeFetchPathChildrenPayload
} from '../actions/pathNavigatorTree';
import {
	checkPathExistence,
	fetchChildrenByPath,
	fetchChildrenByPaths,
	fetchContentItems
} from '../../services/content';
import { catchAjaxError } from '../../utils/ajax';
import { removeStoredPathNavigatorTree, setStoredPathNavigatorTree } from '../../utils/state';
import { EMPTY, forkJoin, Observable, of } from 'rxjs';
import { createPresenceTable } from '../../utils/array';
import {
	getFileExtension,
	getIndividualPaths,
	getParentPath,
	getRootPath,
	withIndex,
	withoutIndex
} from '../../utils/path';
import { batchActions } from '../actions/misc';
import { fetchContentItemComplete } from '../actions/content';
import {
	contentEvent,
	deleteContentEvent,
	deleteContentEvents,
	moveContentEvent,
	pluginInstalled,
	publishEvent,
	workflowEventApprove,
	workflowEventCancel,
	workflowEventDirectPublish,
	workflowEventReject,
	workflowEventSubmit
} from '../actions/system';
import StandardAction from '../../models/StandardAction';
import {
	GetChildrenOptions,
	GetChildrenResponse,
	LookupTable,
	MarketplacePlugin,
	MoveContentEventPayload,
	SocketEventBase
} from '../../models';
import { contentAndDeleteEventForEachApplicableTree } from '../reducers/pathNavigatorTree';
import { PathNavigatorTreeStateProps } from '../../components/PathNavigatorTree';
import { pluckProps } from '../../utils/object';

const createGetChildrenOptions: (
	chunk: PathNavigatorTreeStateProps,
	optionOverrides?: Partial<GetChildrenOptions>
) => Partial<GetChildrenOptions> = (chunk, optionOverrides) => ({
	...pluckProps(chunk, true, 'limit', 'excludes', 'systemTypes', 'sortStrategy', 'order'),
	...optionOverrides
});

/** When opted in, fetch filtered totals so caret visibility matches systemTypes. */
const fetchFilteredChildTotals = (
	siteId: string,
	chunk: PathNavigatorTreeStateProps,
	items: Array<{ path: string; childrenCount: number }>
): Observable<LookupTable<number> | undefined> => {
	// If the seedFilteredChildTotals flag is off, return immediately — no extra requests.
	if (!chunk.seedFilteredChildTotals || !items?.length) {
		return of(undefined);
	}
	const optionsByPath = createPresenceTable(
		items.map((item) => item.path),
		() => ({
			...createGetChildrenOptions(chunk),
			limit: 0
		})
	);
	// Returns totals for children matching options (including systemTypes).
	return fetchChildrenByPaths(siteId, optionsByPath).pipe(
		map((byPath) => {
			const totals: LookupTable<number> = {};
			items.forEach((item) => {
				totals[item.path] = byPath[item.path]?.total ?? item.childrenCount;
			});
			return totals;
		}),
		catchError(() => of(undefined))
	);
};

const collectItemsForFilteredTotals = (
	items: Array<{ path: string; childrenCount: number }>,
	children: LookupTable<GetChildrenResponse>
): Array<{ path: string; childrenCount: number }> => {
	const byPath: LookupTable<{ path: string; childrenCount: number }> = {};
	items.forEach((item) => {
		byPath[item.path] = item;
	});
	Object.values(children).forEach((childrenOfPath) => {
		childrenOfPath.forEach((child) => {
			byPath[child.path] = child;
		});
	});
	return Object.values(byPath);
};

export default [
	// region pathNavigatorTreeInit, pathNavigatorTreeRefresh, pathNavigatorTreeBackgroundRefresh
	(action$, state$) =>
		action$.pipe(
			ofType(pathNavigatorTreeInit.type, pathNavigatorTreeRefresh.type, pathNavigatorTreeBackgroundRefresh.type),
			withLatestFrom(state$),
			filter(
				([{ type, payload }, state]) =>
					type === pathNavigatorTreeInit.type ||
					// For pathNavigatorTreeRefresh (e.g. path is missing, refresh is pressed on the navigator
					// or socket refresh, fetch again to check if the path was created in the background).
					state.pathNavigatorTree[payload.id].isRootPathMissing
			),
			mergeMap(([{ payload }, state]) =>
				checkPathExistence(state.sites.active, state.pathNavigatorTree[payload.id].rootPath).pipe(
					map((exists) =>
						exists ? pathNavigatorTreeRestore({ id: payload.id }) : pathNavigatorTreeRootMissing({ id: payload.id })
					)
				)
			)
		),
	// endregion
	// region pathNavigatorTreeRestore, pathNavigatorTreeRefresh, pathNavigatorTreeBackgroundRefresh
	(action$, state$) =>
		action$.pipe(
			ofType(pathNavigatorTreeRestore.type, pathNavigatorTreeRefresh.type, pathNavigatorTreeBackgroundRefresh.type),
			withLatestFrom(state$),
			filter(([{ payload }, state]) => !state.pathNavigatorTree[payload.id].isRootPathMissing),
			mergeMap(([{ payload }, state]) => {
				let chunk = state.pathNavigatorTree[payload.id];
				let {
					id,
					path = chunk.rootPath,
					expanded = chunk.expanded,
					collapsed = chunk.collapsed,
					keywordByPath = chunk.keywordByPath,
					offsetByPath = chunk.offsetByPath,
					limit = chunk.limit
				} = payload;
				let paths = [];
				expanded.forEach((expandedPath) => {
					getIndividualPaths(expandedPath, path).forEach((parentPath) => {
						if (!paths.includes(parentPath)) {
							paths.push(parentPath);
						}
					});
				});
				// When initializing — unless there's a stored state — need to manually push the root,
				// so it gets loaded and pushed on to the state.
				if (paths.length === 0) {
					paths.push(state.pathNavigatorTree[id].rootPath);
				}
				return forkJoin([
					fetchContentItems(state.sites.active, paths),
					fetchChildrenByPaths(
						state.sites.active,
						createPresenceTable(expanded, (value) => ({
							...(keywordByPath[value] ? { keyword: keywordByPath[value] } : {}),
							...(offsetByPath[value] ? { limit: limit + offsetByPath[value] } : {})
						})),
						createGetChildrenOptions(chunk, pluckProps(payload, true, 'limit', 'excludes'))
					)
				]).pipe(
					switchMap(([items, children]) => {
						let updatedExpanded = expanded;
						if (items.missingItems.length) {
							// remove items.missingItems from expanded
							updatedExpanded = expanded.filter((expandedPath) => !items.missingItems.includes(expandedPath));
							const uuid = state.sites.byId[state.sites.active].uuid;
							setStoredPathNavigatorTree(uuid, state.user.username, id, {
								expanded: updatedExpanded,
								collapsed: state.pathNavigatorTree[id].collapsed,
								keywordByPath: state.pathNavigatorTree[id].keywordByPath
							});
						}
						return fetchFilteredChildTotals(
							state.sites.active,
							chunk,
							collectItemsForFilteredTotals(items, children)
						).pipe(
							map((childTotals) =>
								pathNavigatorTreeRestoreComplete({
									id,
									expanded: updatedExpanded,
									collapsed,
									items,
									children,
									childTotals
								})
							)
						);
					}),
					catchAjaxError((error) => {
						if (error.status === 404) {
							const uuid = state.sites.byId[state.sites.active].uuid;
							setStoredPathNavigatorTree(uuid, state.user.username, id, {
								expanded: state.pathNavigatorTree[id].expanded,
								collapsed: state.pathNavigatorTree[id].collapsed,
								keywordByPath: state.pathNavigatorTree[id].keywordByPath
							});
							return batchActions([pathNavigatorTreeUpdate({ id, expanded: [] }), pathNavigatorTreeRefresh({ id })]);
						} else {
							return pathNavigatorTreeRestoreFailed({ error, id });
						}
					})
				);
			})
		),
	// endregion

	// region pathNavigatorTreeBulkBackgroundRefresh
	(action$, state$) =>
		action$.pipe(
			// TODO: There's no special handling for background vs visible. Should there be?
			ofType(pathNavigatorTreeBulkRefresh.type),
			withLatestFrom(state$),
			mergeMap(([{ payload }, state]) => {
				const { requests } = payload;
				let paths = [];
				let optionsByPath = {};

				// For each tree, get the paths of the expanded nodes that will be retrieved, and the options for the children
				// that will be fetched
				requests.forEach(({ id }) => {
					const chunk = state.pathNavigatorTree[id];
					const { expanded, keywordByPath, offsetByPath, limit } = chunk;
					expanded.forEach((expandedPath) => {
						getIndividualPaths(expandedPath, chunk.rootPath).forEach((parentPath) => {
							if (!paths.includes(parentPath)) {
								paths.push(parentPath);
							}
						});
					});
					if (!expanded.length) {
						paths.push(chunk.rootPath);
					}
					optionsByPath = {
						...optionsByPath,
						...createPresenceTable(expanded, (value) => ({
							...createGetChildrenOptions(chunk, pluckProps(payload, true, 'limit', 'excludes')),
							...(keywordByPath[value] ? { keyword: keywordByPath[value] } : {}),
							...(offsetByPath[value] ? { limit: limit + offsetByPath[value] } : {})
						}))
					};
				});
				return requests.length
					? forkJoin([
							fetchContentItems(state.sites.active, paths),
							fetchChildrenByPaths(state.sites.active, optionsByPath)
						]).pipe(
							switchMap(([items, children]) => {
								const treeRequests: Observable<PathNavigatorTreeRestoreCompletePayload>[] = requests.map(({ id }) => {
									let updatedExpanded = state.pathNavigatorTree[id].expanded;
									if (items.missingItems.length) {
										updatedExpanded = state.pathNavigatorTree[id].expanded.filter(
											(expandedPath) => !items.missingItems.includes(expandedPath)
										);
										const uuid = state.sites.byId[state.sites.active].uuid;
										setStoredPathNavigatorTree(uuid, state.user.username, id, {
											expanded: updatedExpanded,
											collapsed: state.pathNavigatorTree[id].collapsed,
											keywordByPath: state.pathNavigatorTree[id].keywordByPath
										});
									}

									// Filter children, only keep those that are children of the rootPath of the current tree
									const treeChildrenByPath: LookupTable<GetChildrenResponse> = {};
									Object.entries(children).forEach(([parentPath, children]) => {
										if (parentPath.startsWith(withoutIndex(state.pathNavigatorTree[id].rootPath))) {
											treeChildrenByPath[parentPath] = children;
										}
									});
									const treeItems = items.filter((item) =>
										item.path.startsWith(withoutIndex(state.pathNavigatorTree[id].rootPath))
									);
									return fetchFilteredChildTotals(
										state.sites.active,
										state.pathNavigatorTree[id],
										collectItemsForFilteredTotals(treeItems, treeChildrenByPath)
									).pipe(
										map((childTotals) => ({
											id,
											expanded: updatedExpanded,
											collapsed: state.pathNavigatorTree[id].collapsed,
											items: treeItems,
											children: treeChildrenByPath,
											childTotals
										}))
									);
								});
								return forkJoin(treeRequests).pipe(map((trees) => pathNavigatorTreeBulkRestoreComplete({ trees })));
							}),
							catchAjaxError((error) =>
								pathNavigatorTreeBulkRestoreFailed({ ids: requests.map(({ id }) => id), error })
							)
						)
					: EMPTY;
			})
		),
	// endregion
	// region pathNavigatorFetchPathChildren
	(action$: Observable<StandardAction<PathNavTreeFetchPathChildrenPayload>>, state$) =>
		action$.pipe(
			ofType(pathNavigatorTreeFetchPathChildren.type),
			withLatestFrom(state$),
			mergeMap(([{ payload }, state]) => {
				const { id, path, options } = payload;
				const chunk = state.pathNavigatorTree[id];
				const finalOptions = createGetChildrenOptions(chunk, options);
				return fetchChildrenByPath(state.sites.active, path, {
					...finalOptions,
					...(chunk.offsetByPath[path] && {
						limit: chunk.limit + chunk.offsetByPath[path]
					})
				}).pipe(
					switchMap((children) =>
						fetchFilteredChildTotals(state.sites.active, chunk, children).pipe(
							map((childTotals) =>
								pathNavigatorTreeFetchPathChildrenComplete({
									id,
									children,
									parentPath: path,
									options: finalOptions,
									childTotals
								})
							)
						)
					),
					catchAjaxError((error) => pathNavigatorTreeFetchPathChildrenFailed({ error, id, path }))
				);
			})
		),
	// endregion
	// region pathNavigatorTreeBulkFetchPathChildren
	(action$: Observable<StandardAction<PathNavTreeBulkFetchPathChildrenPayload>>, state$) =>
		action$.pipe(
			ofType(pathNavigatorTreeBulkFetchPathChildren.type),
			withLatestFrom(state$),
			mergeMap(([action, state]) => {
				const { requests } = action.payload;
				const optionsByPath = {};
				requests.forEach((request) => {
					const chunk = state.pathNavigatorTree[request.id];
					optionsByPath[request.path] = {
						...createGetChildrenOptions(chunk, request.options),
						...(chunk.offsetByPath[request.path] && {
							limit: chunk.limit + chunk.offsetByPath[request.path]
						})
					};
				});
				return fetchChildrenByPaths(state.sites.active, optionsByPath).pipe(
					switchMap((children) => {
						const totalsRequests = requests.map((item) => {
							const chunk = state.pathNavigatorTree[item.id];
							return fetchFilteredChildTotals(state.sites.active, chunk, children[item.path]).pipe(
								map((childTotals) => ({
									id: item.id,
									children: children[item.path],
									parentPath: item.path,
									options: optionsByPath[item.path],
									childTotals
								}))
							);
						});
						return (totalsRequests.length ? forkJoin(totalsRequests) : of([])).pipe(
							map((paths) => pathNavigatorTreeBulkFetchPathChildrenComplete({ paths }))
						);
					}),
					catchAjaxError((error) =>
						pathNavigatorTreeBulkFetchPathChildrenFailed({ ids: requests.map((item) => item.id), error })
					)
				);
			})
		),
	// endregion
	// region pathNavigatorTreeSetKeyword
	(action$, state$) =>
		action$.pipe(
			ofType(pathNavigatorTreeSetKeyword.type),
			withLatestFrom(state$),
			switchMap(([{ payload }, state]) => {
				const { id, path, keyword } = payload;
				const chunk = state.pathNavigatorTree[id];
				const options = createGetChildrenOptions(chunk, { keyword });
				return fetchChildrenByPath(state.sites.active, path, options).pipe(
					switchMap((children) =>
						fetchFilteredChildTotals(state.sites.active, chunk, children).pipe(
							map((childTotals) =>
								pathNavigatorTreeFetchPathChildrenComplete({ id, parentPath: path, children, options, childTotals })
							)
						)
					),
					catchAjaxError((error) => pathNavigatorTreeFetchPathChildrenFailed({ error, id, path }))
				);
			})
		),
	// endregion
	// region pathNavigatorTreeFetchPathPage
	(action$, state$) =>
		action$.pipe(
			ofType(pathNavigatorTreeFetchPathPage.type),
			withLatestFrom(state$),
			mergeMap(([{ payload }, state]) => {
				const { id, path } = payload;
				const chunk = state.pathNavigatorTree[id];
				const keyword = state.pathNavigatorTree[id].keywordByPath[path];
				const offset = state.pathNavigatorTree[id].offsetByPath[path];
				return fetchChildrenByPath(
					state.sites.active,
					path,
					createGetChildrenOptions(chunk, {
						keyword: keyword,
						offset: offset
					})
				).pipe(
					switchMap((children) =>
						fetchFilteredChildTotals(state.sites.active, chunk, children).pipe(
							map((childTotals) =>
								pathNavigatorTreeFetchPathPageComplete({
									id,
									parentPath: path,
									children,
									options: { keyword, offset },
									childTotals
								})
							)
						)
					),
					catchAjaxError((error) => pathNavigatorTreeFetchPathPageFailed({ error, id }))
				);
			})
		),
	// endregion
	// region Local storage setting
	(action$, state$) =>
		action$.pipe(
			ofType(
				pathNavigatorTreeCollapsePath.type,
				pathNavigatorTreeExpandPath.type,
				pathNavigatorTreeFetchPathChildrenComplete.type,
				pathNavigatorTreeFetchPathPageComplete.type,
				pathNavigatorTreeToggleCollapsed.type
			),
			withLatestFrom(state$),
			tap(([{ payload }, state]) => {
				const { id } = payload;
				const { expanded, collapsed, keywordByPath } = state.pathNavigatorTree[id];
				const uuid = state.sites.byId[state.sites.active].uuid;
				setStoredPathNavigatorTree(uuid, state.user.username, id, {
					expanded,
					collapsed,
					keywordByPath
				});
			}),
			ignoreElements()
		),
	// endregion
	// region fetchContentItemComplete — recount a filtered zero once childrenCount becomes positive
	(action$, state$) =>
		action$.pipe(
			ofType(fetchContentItemComplete.type),
			withLatestFrom(state$),
			mergeMap(
				([
					{
						payload: { item }
					},
					state
				]) => {
					if (item.childrenCount <= 0) {
						return EMPTY;
					}
					const path = item.path;
					// Existing children fetch applies systemTypes and stores children.total. Skip nodes whose
					// children are already loaded — those are refreshed by the content-event path.
					return Object.values(state.pathNavigatorTree)
						.filter(
							(tree) =>
								tree.seedFilteredChildTotals && tree.totalByPath[path] === 0 && !(path in tree.childrenByParentPath)
						)
						.map((tree) => pathNavigatorTreeFetchPathChildren({ id: tree.id, path, expand: false }));
				}
			)
		),
	// endregion
	// region contentEvent
	(action$: Observable<StandardAction<SocketEventBase>>, state$) =>
		action$.pipe(
			ofType(contentEvent.type),
			withLatestFrom(state$),
			mergeMap(([action, state]) => {
				const actions = [];
				const refreshRequests = [];
				const idsToRefreshChildrenOnly: PathNavTreeBulkFetchPathChildrenPayload['requests'] = [];
				// Content Event Cases:
				// a. New file/folder: fetch parent
				// b. File/folder updated (with no `sortStrategy` or `order` configurations set up): fetch item
				contentAndDeleteEventForEachApplicableTree(
					state.pathNavigatorTree,
					action.payload.targetPath,
					(tree, targetPath, parentPathOfTargetPath) => {
						const id = tree.id;
						const rootPath = tree.rootPath;
						const extension = getFileExtension(targetPath);
						const isFile = extension === '';
						const parentPath = isFile ? parentPathOfTargetPath : getParentPath(targetPath);
						const sortingOptionsSet = Boolean(tree.sortStrategy || tree.order);
						if (
							// If the path corresponds to the root and the root didn't exist, root now exists
							tree.isRootPathMissing &&
							(targetPath === rootPath || withIndex(targetPath) === rootPath)
						) {
							refreshRequests.push({ id });
						} else if (
							// If an entry for the path exists, assume it's an update to an existing item.
							(targetPath in tree.totalByPath || withIndex(targetPath) in tree.totalByPath) &&
							// If sorting options are set, the parent path needs to be updated for the sort order to be correct.
							!sortingOptionsSet
						) {
							// Reloading the item done by content epics
							// actions.push(fetchContentItem({ path }));
						} else if (
							// If an entry for the folder exists, fetch
							parentPath in tree.totalByPath ||
							withIndex(parentPath) in tree.totalByPath
						) {
							const pathToUpdate = parentPath in tree.totalByPath ? parentPath : withIndex(parentPath);
							// Show/fetch the new child(ren)
							pathToUpdate in tree.childrenByParentPath &&
								idsToRefreshChildrenOnly.push({ id, path: pathToUpdate, expand: false });
							// Update child count done by content epics.
							// fetchContentItem({ path: parentPath })
						}
					}
				);
				refreshRequests.length && actions.push(pathNavigatorTreeBulkRefresh({ requests: refreshRequests }));
				idsToRefreshChildrenOnly.length &&
					actions.push(pathNavigatorTreeBulkFetchPathChildren({ requests: idsToRefreshChildrenOnly }));
				return actions;
			})
		),
	// endregion
	// region deleteContentEvent, deleteContentEvents
	(action$, state$) =>
		action$.pipe(
			ofType(deleteContentEvent.type, deleteContentEvents.type),
			withLatestFrom(state$),
			tap(([, state]) => {
				Object.values(state.pathNavigatorTree).forEach((tree) => {
					tree.isRootPathMissing &&
						removeStoredPathNavigatorTree(state.sites.byId[state.sites.active].uuid, state.user.username, tree.id);
				});
			}),
			ignoreElements()
		),
	// endregion
	// region moveContentEvent
	(action$: Observable<StandardAction<MoveContentEventPayload>>, state$) =>
		action$.pipe(
			ofType(moveContentEvent.type),
			withLatestFrom(state$),
			mergeMap(([action, state]) => {
				const actions = [];
				const targetPath = action.payload.targetPath;
				const sourcePath = action.payload.sourcePath;
				const parentPathOfTargetPath = getParentPath(targetPath);
				const parentPathOfSourcePath = getParentPath(sourcePath);
				const idsToRefresh = [];
				const idsToRefreshChildrenOnly: PathNavTreeBulkFetchPathChildrenPayload['requests'] = [];
				Object.values(state.pathNavigatorTree).forEach((tree) => {
					const id = tree.id;
					if (
						// The missing path got created.
						tree.isRootPathMissing &&
						tree.rootPath === targetPath
					) {
						idsToRefresh.push({ id });
					} else {
						[parentPathOfTargetPath, parentPathOfSourcePath].forEach((path) => {
							if (
								// If in totalByPath is an item that has been loaded and must update...
								// path in totalByPath may be a page, and its path has index.xml, so it needs to be validated too.
								path in tree.totalByPath ||
								withIndex(path) in tree.totalByPath
							) {
								// Get correct path to fetch (may include index.xml)
								const pathToFetch = path in tree.totalByPath ? path : withIndex(path);
								// If its children are loaded, then re-fetch to get the new
								if (tree.childrenByParentPath[pathToFetch]) {
									idsToRefreshChildrenOnly.push({ id, path: pathToFetch, expand: false });
								}
								// Re-fetching the item done by content epics.
								// fetchContentItem({ path: path })
							}
						});
					}
				});
				idsToRefresh.length && actions.push(pathNavigatorTreeBulkRefresh({ requests: idsToRefresh }));
				idsToRefreshChildrenOnly.length &&
					actions.push(pathNavigatorTreeBulkFetchPathChildren({ requests: idsToRefreshChildrenOnly }));
				return actions;
			})
		),
	// endregion
	// region pluginInstalled
	// Can't be smart about this one given the level of information the event provides.
	(action$: Observable<StandardAction<MarketplacePlugin>>, state$) =>
		action$.pipe(
			ofType(pluginInstalled.type),
			throttleTime(500),
			withLatestFrom(state$),
			switchMap(([, state]) => {
				const requests = [];
				Object.values(state.pathNavigatorTree).forEach((tree) => {
					if (['/templates', '/scripts', '/static-assets'].includes(getRootPath(tree.rootPath))) {
						requests.push({ id: tree.id, backgroundRefresh: true });
					}
				});
				return requests.length ? [pathNavigatorTreeBulkRefresh({ requests: requests })] : EMPTY;
			})
		),
	// endregion
	// region workflowEvent, publishEvent
	// Can't be smart about these given the level of information the events provide.
	(action$, state$) =>
		action$.pipe(
			ofType(
				workflowEventSubmit.type,
				workflowEventDirectPublish.type,
				workflowEventApprove.type,
				workflowEventReject.type,
				workflowEventCancel.type,
				publishEvent.type
			),
			throttleTime(500),
			withLatestFrom(state$),
			map(([, state]) =>
				pathNavigatorTreeBulkRefresh({
					requests: Object.keys(state.pathNavigatorTree).map((id) => ({ id, backgroundRefresh: true }))
				})
			)
		)
	// endregion
] as CrafterCMSEpic[];
