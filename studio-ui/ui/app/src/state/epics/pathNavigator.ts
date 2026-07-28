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
import { ignoreElements, map, mergeMap, switchMap, tap, throttleTime, withLatestFrom } from 'rxjs/operators';
import { catchAjaxError } from '../../utils/ajax';
import {
	checkPathExistence,
	fetchChildrenByPath,
	fetchChildrenByPaths,
	fetchContentItems,
	fetchItemWithChildrenByPath
} from '../../services/content';
import { getIndividualPaths, getParentPath, getRootPath, withIndex, withoutIndex } from '../../utils/path';
import { EMPTY, forkJoin, Observable } from 'rxjs';
import {
	pathNavigatorBackgroundRefresh,
	pathNavigatorBulkFetchPathComplete,
	pathNavigatorBulkFetchPathFailed,
	pathNavigatorBulkRefresh,
	pathNavigatorChangeLimit,
	pathNavigatorChangePage,
	pathNavigatorConditionallySetPath,
	pathNavigatorConditionallySetPathComplete,
	pathNavigatorConditionallySetPathFailed,
	pathNavigatorFetchParentItems,
	pathNavigatorFetchParentItemsComplete,
	pathNavigatorFetchPath,
	pathNavigatorFetchPathComplete,
	pathNavigatorFetchPathFailed,
	pathNavigatorInit,
	pathNavigatorRefresh,
	pathNavigatorSetCollapsed,
	pathNavigatorSetCurrentPath,
	pathNavigatorSetKeyword,
	PathNavInitPayload,
	pathNavRootPathMissing
} from '../actions/pathNavigator';
import { setStoredPathNavigator } from '../../utils/state';
import { CrafterCMSEpic } from '../store';
import { AjaxError } from 'rxjs/ajax';
import StandardAction from '../../models/StandardAction';
import {
	DeleteContentEventPayload,
	DeleteContentEventsPayload,
	MoveContentEventPayload
} from '../../models/SocketEvent';
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
import { pushErrorDialog } from '../../utils/system';

export default [
	// region pathNavigatorInit
	(action$: Observable<StandardAction<PathNavInitPayload>>, state$) =>
		action$.pipe(
			ofType(pathNavigatorInit.type),
			withLatestFrom(state$),
			mergeMap(
				([
					{
						payload: { id, excludes, rootPath, limit, sortStrategy, order }
					},
					state
				]) =>
					checkPathExistence(state.sites.active, rootPath).pipe(
						map((exists) =>
							exists
								? pathNavigatorFetchParentItems({
										id,
										path: state.pathNavigator[id].currentPath,
										offset: state.pathNavigator[id].offset,
										keyword: state.pathNavigator[id].keyword,
										excludes,
										limit,
										sortStrategy,
										order
									})
								: pathNavRootPathMissing({ id })
						)
					)
			)
		),
	// endregion
	// region pathNavigatorRefresh
	(action$, state$) =>
		action$.pipe(
			ofType(pathNavigatorRefresh.type, pathNavigatorBackgroundRefresh.type),
			withLatestFrom(state$),
			mergeMap(
				([
					{
						type,
						payload: { id }
					},
					state
				]) => {
					const chunk = state.pathNavigator[id];
					if (!chunk) {
						return EMPTY;
					}
					const {
						pathFetchRequestId,
						currentPath,
						keyword,
						limit,
						offset,
						excludes,
						sortStrategy,
						order,
						rootPath
					} = chunk;
					return fetchItemWithChildrenByPath(state.sites.active, currentPath, {
						keyword,
						limit,
						offset,
						excludes,
						sortStrategy,
						order
					}).pipe(
						map(({ item, children }) =>
							pathNavigatorFetchPathComplete({ id, parent: item, children, pathFetchRequestId })
						),
						catchAjaxError((error: AjaxError) => {
							if (error.status === 404 && rootPath !== currentPath) {
								return pathNavigatorConditionallySetPath({ id, path: rootPath, pathFetchRequestId });
							} else {
								return pathNavigatorFetchPathFailed({ error, id, pathFetchRequestId });
							}
						})
					);
				}
			)
		),
	// endregion
	// region pathNavigatorBulkRefresh
	(action$, state$) =>
		action$.pipe(
			ofType(pathNavigatorBulkRefresh.type),
			withLatestFrom(state$),
			mergeMap(([{ payload }, state]) => {
				const { requests } = payload;
				let paths = [];
				let optionsByPath = {};

				requests.forEach(({ id }) => {
					const chunk = state.pathNavigator[id];
					if (!chunk) {
						return;
					}
					const { currentPath, keyword, limit, offset, excludes, sortStrategy, order } = chunk;
					paths.push(currentPath);
					optionsByPath[currentPath] = {
						keyword,
						limit,
						offset,
						excludes,
						sortStrategy,
						order
					};
				});

				return requests.length
					? forkJoin([
							fetchContentItems(state.sites.active, paths),
							fetchChildrenByPaths(state.sites.active, optionsByPath)
						]).pipe(
							map(([items, children]) =>
								pathNavigatorBulkFetchPathComplete({
									paths: requests.map(({ id }) => ({
										id,
										parent: items.find((item) =>
											item.path.startsWith(withoutIndex(state.pathNavigator[id].currentPath))
										),
										children: children[state.pathNavigator[id].currentPath]
									}))
								})
							),
							catchAjaxError((error) => pathNavigatorBulkFetchPathFailed({ ids: requests.map(({ id }) => id), error }))
						)
					: EMPTY;
			})
		),
	// endregion
	// region pathNavigatorFetchPath
	(action$, state$) =>
		action$.pipe(
			ofType(pathNavigatorFetchPath.type),
			withLatestFrom(state$),
			mergeMap(
				([
					{
						type,
						payload: { id, path, keyword }
					},
					state
				]) => {
					const chunk = state.pathNavigator[id];
					if (!chunk) {
						return EMPTY;
					}
					const { pathFetchRequestId, excludes, limit, sortStrategy, order } = chunk;
					return fetchItemWithChildrenByPath(state.sites.active, path, {
						excludes,
						limit,
						sortStrategy,
						order,
						...(keyword && { keyword })
					}).pipe(
						map(({ item, children }) =>
							pathNavigatorFetchPathComplete({ id, parent: item, children, pathFetchRequestId })
						),
						catchAjaxError(
							(error) => pathNavigatorFetchPathFailed({ id, error, pathFetchRequestId }),
							(error) => pushErrorDialog({ props: { error: error.response ?? error } })
						)
					);
				}
			)
		),
	// endregion
	// region pathNavigatorConditionallySetPath
	(action$, state$) =>
		action$.pipe(
			ofType(pathNavigatorConditionallySetPath.type),
			withLatestFrom(state$),
			mergeMap(
				([
					{
						payload: { id, path, keyword, pathFetchRequestId }
					},
					state
				]) => {
					const chunk = state.pathNavigator[id];
					if (!chunk) {
						return EMPTY;
					}
					if (
						pathFetchRequestId !== undefined &&
						pathFetchRequestId !== chunk.pathFetchRequestId
					) {
						return EMPTY;
					}
					const { excludes, limit, sortStrategy, order } = chunk;
					return fetchItemWithChildrenByPath(state.sites.active, path, {
						excludes,
						limit,
						sortStrategy,
						order,
						...(keyword && { keyword })
					}).pipe(
						map(({ item, children }) =>
							pathNavigatorConditionallySetPathComplete({
								id,
								path,
								parent: item,
								children,
								pathFetchRequestId
							})
						),
						catchAjaxError(
							(error) => pathNavigatorConditionallySetPathFailed({ id, error }),
							(error) => pushErrorDialog({ props: { error: error.response ?? error } })
						)
					);
				}
			)
		),
	// endregion
	// region pathNavigatorSetCurrentPath
	(action$, state$) =>
		action$.pipe(
			ofType(pathNavigatorSetCurrentPath.type),
			withLatestFrom(state$),
			mergeMap(
				([
					{
						payload: { id, path }
					},
					state
				]) => {
					const chunk = state.pathNavigator[id];
					if (!chunk) {
						return EMPTY;
					}
					const { pathFetchRequestId, sortStrategy, order } = chunk;
					return fetchItemWithChildrenByPath(state.sites.active, path, {
						sortStrategy,
						order
					}).pipe(
						map(({ item, children }) =>
							pathNavigatorFetchPathComplete({ id, parent: item, children, pathFetchRequestId })
						),
						catchAjaxError((error) => pathNavigatorFetchPathFailed({ error, id, pathFetchRequestId }))
					);
				}
			)
		),
	// endregion
	// region pathNavigatorSetKeyword
	(action$, state$) =>
		action$.pipe(
			ofType(pathNavigatorSetKeyword.type),
			withLatestFrom(state$),
			mergeMap(
				([
					{
						type,
						payload: { id, keyword }
					},
					state
				]) => {
					const chunk = state.pathNavigator[id];
					if (!chunk) {
						return EMPTY;
					}
					const { pathFetchRequestId, currentPath, limit, sortStrategy, order, excludes } = chunk;
					return fetchChildrenByPath(state.sites.active, currentPath, {
						keyword,
						limit,
						sortStrategy,
						order,
						excludes
					}).pipe(
						map((children) =>
							pathNavigatorFetchPathComplete({
								id,
								parent: state.content.itemsByPath[currentPath],
								children,
								pathFetchRequestId
							})
						),
						catchAjaxError((error) => pathNavigatorFetchPathFailed({ error, id, pathFetchRequestId }))
					);
				}
			)
		),
	// endregion
	// region pathNavigatorChangePage
	(action$, state$) =>
		action$.pipe(
			ofType(pathNavigatorChangePage.type, pathNavigatorChangeLimit.type),
			withLatestFrom(state$),
			mergeMap(
				([
					{
						type,
						payload: { id, offset }
					},
					state
				]) => {
					const chunk = state.pathNavigator[id];
					if (!chunk) {
						return EMPTY;
					}
					const { pathFetchRequestId, currentPath, limit, sortStrategy, order, excludes, keyword } = chunk;
					return fetchChildrenByPath(state.sites.active, currentPath, {
						limit,
						sortStrategy,
						order,
						excludes,
						...(Boolean(keyword) && { keyword }),
						offset
					}).pipe(
						map((children) => pathNavigatorFetchPathComplete({ id, children, pathFetchRequestId })),
						catchAjaxError((error) => pathNavigatorFetchPathFailed({ error, id, pathFetchRequestId }))
					);
				}
			)
		),
	// endregion
	// region pathNavigatorFetchParentItems
	(action$, state$) =>
		action$.pipe(
			ofType(pathNavigatorFetchParentItems.type),
			withLatestFrom(state$),
			mergeMap(
				([
					{
						type,
						payload: { id, path, excludes, limit, offset, keyword, sortStrategy, order }
					},
					state
				]) => {
					const chunk = state.pathNavigator[id];
					if (!chunk) {
						return EMPTY;
					}
					const site = state.sites.active;
					const { rootPath, pathFetchRequestId, sortStrategy: navigatorSortStrategy, order: navigatorOrder } =
						chunk;
					const parentsPath = getIndividualPaths(path, rootPath);
					if (parentsPath.length > 1) {
						return forkJoin([
							fetchContentItems(site, parentsPath),
							fetchChildrenByPath(site, path, {
								excludes,
								limit,
								offset,
								keyword,
								sortStrategy,
								order
							})
						]).pipe(
							map(([items, children]) => pathNavigatorFetchParentItemsComplete({ id, items, children })),
							catchAjaxError((error: AjaxError) => {
								if (error.status === 404) {
									return pathNavigatorConditionallySetPath({ id, path: getRootPath(path), pathFetchRequestId });
								} else {
									return pathNavigatorFetchPathFailed({ error, id, pathFetchRequestId });
								}
							})
						);
					} else {
						return fetchItemWithChildrenByPath(site, path, {
							excludes,
							limit,
							offset,
							keyword,
							sortStrategy: navigatorSortStrategy,
							order: navigatorOrder
						}).pipe(
							map(({ item, children }) =>
								pathNavigatorFetchPathComplete({ id, parent: item, children, pathFetchRequestId })
							),
							catchAjaxError((error) => pathNavigatorFetchPathFailed({ error, id, pathFetchRequestId }))
						);
					}
				}
			)
		),
	// endregion
	// region pathNavigatorFetchPathComplete, pathNavigatorConditionallySetPathComplete, pathNavigatorSetCollapsed
	(action$, state$) =>
		action$.pipe(
			ofType(
				pathNavigatorFetchPathComplete.type,
				pathNavigatorConditionallySetPathComplete.type,
				pathNavigatorSetCollapsed.type,
				pathNavigatorChangeLimit.type
			),
			withLatestFrom(state$),
			tap(
				([
					{
						type,
						payload: { id, parent }
					},
					state
				]) => {
					if (type !== pathNavigatorConditionallySetPathComplete.type || parent?.childrenCount > 0) {
						const chunk = state.pathNavigator[id];
						if (!chunk) {
							return;
						}
						const uuid = state.sites.byId[state.sites.active].uuid;
						setStoredPathNavigator(uuid, state.user.username, id, {
							currentPath: chunk.currentPath,
							collapsed: chunk.collapsed,
							keyword: chunk.keyword,
							offset: chunk.offset,
							limit: chunk.limit
						});
					}
				}
			),
			ignoreElements()
		),
	// endregion
	// region contentEvent
	(action$, state$) =>
		action$.pipe(
			ofType(contentEvent.type),
			withLatestFrom(state$),
			mergeMap(([action, state]) => {
				// Cases:
				// a. Item is the current path in the navigator: refresh navigator
				// b. Item is a direct child of the current path: refresh navigator
				// b. Item is a direct child of the current path: refresh navigator
				// c. Item is a child of an item on the current path: refresh item's child count
				const {
					payload: { targetPath }
				} = action;
				const parentPathOfTargetPath = getParentPath(targetPath);
				const parentOfTargetWithIndex = withIndex(parentPathOfTargetPath);
				const refreshRequests = [];
				Object.values(state.pathNavigator).forEach((navigator) => {
					if (
						// Case (a)
						navigator.currentPath === targetPath ||
						// Case (b)
						navigator.currentPath === parentPathOfTargetPath ||
						navigator.currentPath === parentOfTargetWithIndex
					) {
						refreshRequests.push({ id: navigator.id, backgroundRefresh: true });
					} /* else if (
            // Case (c) - Content epics load any item that's on the state already
            navigator.currentPath === getParentPath(parentPathOfTargetPath)
          ) {
            actions.push(fetchContentItem({ path: parentPathOfTargetPath }));
          } */
				});
				return refreshRequests.length ? [pathNavigatorBulkRefresh({ requests: refreshRequests })] : EMPTY;
			})
		),
	// endregion
	// region deleteContentEvent, deleteContentEvents
	(action$: Observable<StandardAction<DeleteContentEventPayload | DeleteContentEventsPayload>>, state$) =>
		action$.pipe(
			ofType(deleteContentEvent.type, deleteContentEvents.type),
			withLatestFrom(state$),
			mergeMap(([action, state]) => {
				const targetPaths =
					deleteContentEvents.type === action.type
						? (action.payload as DeleteContentEventsPayload).targetPaths
						: [(action.payload as DeleteContentEventPayload).targetPath];
				const actions = [];
				const navigators = Object.values(state.pathNavigator);
				targetPaths.forEach((targetPath) => {
					navigators.forEach((navigator) => {
						if (!navigator.isRootPathMissing && navigator.currentPath.startsWith(targetPath)) {
							actions.push(pathNavigatorSetCurrentPath({ id: navigator.id, path: navigator.rootPath }));
						}
					});
				});
				return actions;
			})
		),
	// endregion
	// region moveContentEvent
	(action$: Observable<StandardAction<MoveContentEventPayload>>, state$) =>
		action$.pipe(
			ofType(moveContentEvent.type),
			withLatestFrom(state$),
			mergeMap(([action, state]) => {
				const actions = [];
				const {
					payload: { targetPath, sourcePath }
				} = action;
				const parentOfTargetPath = getParentPath(targetPath);
				const parentOfSourcePath = getParentPath(sourcePath);
				const refreshRequests = [];
				// const idsToBgRefresh = [];
				Object.values(state.pathNavigator).forEach((navigator) => {
					if (navigator.isRootPathMissing && targetPath === navigator.rootPath) {
						refreshRequests.push({ id: navigator.id });
					} else if (!navigator.isRootPathMissing && navigator.currentPath.startsWith(sourcePath)) {
						actions.push(pathNavigatorSetCurrentPath({ id: navigator.id, path: navigator.rootPath }));
					} else if (
						withoutIndex(navigator.currentPath) === parentOfTargetPath ||
						withoutIndex(navigator.currentPath) === parentOfSourcePath
					) {
						refreshRequests.push({ id: navigator.id, backgroundRefresh: true });
					}
				});
				refreshRequests.length && actions.push(pathNavigatorBulkRefresh({ requests: refreshRequests }));
				return actions.length ? actions : EMPTY;
			})
		),
	// endregion
	// region pluginInstalled
	(action$, state$) =>
		action$.pipe(
			ofType(pluginInstalled.type),
			throttleTime(500),
			withLatestFrom(state$),
			switchMap(([, state]) => {
				const requests = [];
				Object.values(state.pathNavigator).forEach((tree) => {
					if (['/templates', '/scripts', '/static-assets'].includes(getRootPath(tree.rootPath))) {
						requests.push({ id: tree.id, backgroundRefresh: true });
					}
				});
				return requests.length ? [pathNavigatorBulkRefresh({ requests })] : EMPTY;
			})
		),
	// endregion
	// region publishEvent, workflowEvent
	(action$, state$) =>
		action$.pipe(
			ofType(
				publishEvent.type,
				workflowEventSubmit.type,
				workflowEventDirectPublish.type,
				workflowEventApprove.type,
				workflowEventReject.type,
				workflowEventCancel.type
			),
			throttleTime(500),
			withLatestFrom(state$),
			switchMap(([, state]) => {
				const requests = Object.keys(state.pathNavigator).map((id) => ({ id, backgroundRefresh: true }));
				return requests.length ? [pathNavigatorBulkRefresh({ requests })] : EMPTY;
			})
		)
	// endregion
] as CrafterCMSEpic[];
