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
	exhaustMap,
	filter,
	ignoreElements,
	map,
	mergeMap,
	startWith,
	switchMap,
	takeUntil,
	tap,
	withLatestFrom
} from 'rxjs/operators';
import { getHostToHostBus } from '../../utils/subjects';
import { itemSuccessMessages } from '../../env/i18n-legacy';
import {
	closeSiteSocket,
	emitSystemEvent,
	emitSystemEvents,
	fetchGlobalMenu,
	fetchGlobalMenuComplete,
	fetchGlobalMenuFailed,
	messageSharedWorker,
	newProjectReady,
	openSiteSocket,
	projectDeleted,
	showCopyItemSuccessNotification,
	showCreateFolderSuccessNotification,
	showCreateItemSuccessNotification,
	showCutItemSuccessNotification,
	showDeleteItemSuccessNotification,
	showDuplicatedItemSuccessNotification,
	showEditItemSuccessNotification,
	showPasteItemSuccessNotification,
	showPublishItemSuccessNotification,
	showRejectItemSuccessNotification,
	showRevertItemSuccessNotification,
	showSystemNotification,
	showUnlockItemSuccessNotification,
	siteSocketStatus,
	storeInitialized
} from '../actions/system';
import { CrafterCMSEpic } from '../store';
import {
	fetchPublishingStatus,
	fetchPublishingStatusComplete,
	fetchPublishingStatusFailed,
	fetchPublishingStatusProcessingComplete,
	startPublishingStatusFetcher,
	stopPublishingStatusFetcher
} from '../actions/publishingStatus';
import { fetchStatus } from '../../services/publishing';
import { catchAjaxError } from '../../utils/ajax';
import { interval, NEVER, Observable } from 'rxjs';
import { sessionTimeout } from '../actions/user';
import { sharedWorkerUnauthenticated } from '../actions/auth';
import { fetchGlobalMenuItems } from '../../services/configuration';
import { fetchSiteConfig } from '../actions/configuration';
import { getStoredShowToolsPanel } from '../../utils/state';
import { closeToolsPanel, openToolsPanel } from '../actions/preview';
import { getXSRFToken, removeSiteCookie, setSiteCookie } from '../../utils/auth';
import { changeSiteComplete, fetchSites, popSite } from '../actions/sites';
import { defineMessages } from 'react-intl';
import { batchActions } from '../actions/misc';
import StandardAction from '../../models/StandardAction';
import { ProjectLifecycleEvent } from '../../models/ProjectLifecycleEvent';
import { isDashboardAppUrl, isPreviewAppUrl, isProjectToolsAppUrl, pushConfirmDialog } from '../../utils/system';
import { GlobalRoutes } from '../../env/routes';
import { previewSwitch } from '../../services/security';
import { getPublishingStatusState } from '../../components/PublishingStatusDisplay';
import { nanoid } from 'nanoid';
import { popDialog } from '../actions/dialogStack';

const msgs = defineMessages({
	siteSwitchedOnAnotherTab: {
		defaultMessage: 'The active project was changed from "{currentProject}" to "{newProject}" on another tab.'
	},
	siteSwitchedOnAnotherTabPrimaryAction: {
		defaultMessage: 'Continue on {currentProject}'
	},
	siteSwitchedOnAnotherTabSecondaryAction: {
		defaultMessage: 'Switch to {newProject}'
	}
});

const systemEpics: CrafterCMSEpic[] = [
	// region storeInitialized
	(action$, state$) =>
		action$.pipe(
			ofType(storeInitialized.type),
			withLatestFrom(state$),
			switchMap(([, state]) => {
				const hasActiveSite = Boolean(state.sites.active);
				const isActiveSiteAvailable = Boolean(state.sites.byId?.[state.sites.active]);
				const showToolsPanel =
					hasActiveSite &&
					isActiveSiteAvailable &&
					getStoredShowToolsPanel(state.sites.byId?.[state.sites.active].uuid, state.user.username);
				return [
					fetchGlobalMenu(),
					...(hasActiveSite
						? [
								startPublishingStatusFetcher(),
								fetchSiteConfig(),
								messageSharedWorker(openSiteSocket({ site: state.sites.active, xsrfToken: getXSRFToken() })),
								showToolsPanel === null || state.preview.showToolsPanel === showToolsPanel
									? false
									: state.preview.showToolsPanel
										? closeToolsPanel()
										: openToolsPanel()
							].filter(Boolean)
						: [])
				];
			})
		),
	// endregion
	// region changeSiteComplete
	(action$) =>
		action$.pipe(
			ofType(changeSiteComplete.type),
			switchMap(({ payload: { nextSite } }) => [
				startPublishingStatusFetcher(),
				fetchSiteConfig(),
				messageSharedWorker(openSiteSocket({ site: nextSite, xsrfToken: getXSRFToken() }))
			])
		),
	// endregion
	// region emitSystemEvent
	(action$) =>
		action$.pipe(
			ofType(emitSystemEvent.type),
			tap(({ payload }) => getHostToHostBus().next(payload)),
			map(({ payload: action }) => action)
		),
	// endregion
	// region emitSystemEvents
	(action$: Observable<StandardAction<ReturnType<typeof emitSystemEvents>['payload']>>) =>
		action$.pipe(
			ofType(emitSystemEvents.type),
			tap(({ payload }) => {
				const hostToHost$ = getHostToHostBus();
				payload.events.forEach((action) => hostToHost$.next(action));
			}),
			mergeMap((action) => action.payload.events)
		),
	// endregion
	// region showDeleteItemSuccessNotification
	(action$, state$, { getIntl }) =>
		action$.pipe(
			ofType(showDeleteItemSuccessNotification.type),
			tap(({ payload }) => {
				const hostToHost$ = getHostToHostBus();
				hostToHost$.next(
					showSystemNotification({
						message: getIntl().formatMessage(itemSuccessMessages.itemDeleted, {
							count: payload.items.length
						})
					})
				);
			}),
			ignoreElements()
		),
	// endregion
	// region showPublishItemSuccessNotification
	(action$, state$, { getIntl }) =>
		action$.pipe(
			ofType(showPublishItemSuccessNotification.type),
			withLatestFrom(state$),
			tap(([{ payload }, state]) => {
				const hostToHost$ = getHostToHostBus();
				const { type } = payload;
				hostToHost$.next(
					showSystemNotification({
						message:
							payload.schedule === 'now'
								? getIntl().formatMessage(
										type === 'publish'
											? itemSuccessMessages.itemPublishedNow
											: itemSuccessMessages.itemRequestedToPublishNow,
										{
											count: payload.items.length,
											environment: payload.environment
										}
									)
								: getIntl().formatMessage(
										type === 'publish'
											? itemSuccessMessages.itemSchedulePublished
											: itemSuccessMessages.itemRequestedToSchedulePublish,
										{
											count: payload.items.length,
											environment: payload.environment
										}
									)
					})
				);
			}),
			ignoreElements()
		),
	// endregion
	// region showEditItemSuccessNotification
	(action$, state$, { getIntl }) =>
		action$.pipe(
			ofType(showEditItemSuccessNotification.type),
			tap(({ payload: { action } }) => {
				let message;
				if (action === 'save') {
					message = getIntl().formatMessage(itemSuccessMessages.itemSavedAsDraft);
				} else {
					message = getIntl().formatMessage(itemSuccessMessages.itemEdited);
				}
				const hostToHost$ = getHostToHostBus();
				hostToHost$.next(
					showSystemNotification({
						message,
						options: { variant: action === 'save' ? 'warning' : 'default' }
					})
				);
			}),
			ignoreElements()
		),
	// endregion
	// region showCreateItemSuccessNotification
	(action$, state$, { getIntl }) =>
		action$.pipe(
			ofType(showCreateItemSuccessNotification.type),
			tap(() => {
				const hostToHost$ = getHostToHostBus();
				hostToHost$.next(
					showSystemNotification({
						message: getIntl().formatMessage(itemSuccessMessages.itemCreated)
					})
				);
			}),
			ignoreElements()
		),
	// endregion
	// region showCreateFolderSuccessNotification
	(action$, state$, { getIntl }) =>
		action$.pipe(
			ofType(showCreateFolderSuccessNotification.type),
			tap(() => {
				const hostToHost$ = getHostToHostBus();
				hostToHost$.next(
					showSystemNotification({
						message: getIntl().formatMessage(itemSuccessMessages.folderCreated)
					})
				);
			}),
			ignoreElements()
		),
	// endregion
	// region showCopyItemSuccessNotification
	(action$, state$, { getIntl }) =>
		action$.pipe(
			ofType(showCopyItemSuccessNotification.type),
			tap(({ payload }) => {
				const hostToHost$ = getHostToHostBus();
				hostToHost$.next(
					showSystemNotification({
						message: getIntl().formatMessage(itemSuccessMessages.itemCopied, {
							count: payload?.paths.length ?? 1
						})
					})
				);
			}),
			ignoreElements()
		),
	// endregion
	// region showCutItemSuccessNotification
	(action$, state$, { getIntl }) =>
		action$.pipe(
			ofType(showCutItemSuccessNotification.type),
			tap(({ payload }) => {
				const hostToHost$ = getHostToHostBus();
				hostToHost$.next(
					showSystemNotification({
						message: getIntl().formatMessage(itemSuccessMessages.itemCut)
					})
				);
			}),
			ignoreElements()
		),
	// endregion
	// region showPasteItemSuccessNotification
	(action$, state$, { getIntl }) =>
		action$.pipe(
			ofType(showPasteItemSuccessNotification.type),
			tap(({ payload }) => {
				const hostToHost$ = getHostToHostBus();
				hostToHost$.next(
					showSystemNotification({
						message: getIntl().formatMessage(itemSuccessMessages.itemPasted)
					})
				);
			}),
			ignoreElements()
		),
	// endregion
	// region showUnlockItemSuccessNotification
	(action$, state$, { getIntl }) =>
		action$.pipe(
			ofType(showUnlockItemSuccessNotification.type),
			tap(({ payload }) => {
				const hostToHost$ = getHostToHostBus();
				hostToHost$.next(
					showSystemNotification({
						message: getIntl().formatMessage(itemSuccessMessages.itemUnlocked)
					})
				);
			}),
			ignoreElements()
		),
	// endregion
	// region showDuplicatedItemSuccessNotification
	(action$, state$, { getIntl }) =>
		action$.pipe(
			ofType(showDuplicatedItemSuccessNotification.type),
			tap(({ payload }) => {
				const hostToHost$ = getHostToHostBus();
				hostToHost$.next(
					showSystemNotification({
						message: getIntl().formatMessage(itemSuccessMessages.itemDuplicated)
					})
				);
			}),
			ignoreElements()
		),
	// endregion
	// region showRevertItemSuccessNotification
	(action$, state$, { getIntl }) =>
		action$.pipe(
			ofType(showRevertItemSuccessNotification.type),
			tap(({ payload }) => {
				const hostToHost$ = getHostToHostBus();
				hostToHost$.next(
					showSystemNotification({
						message: getIntl().formatMessage(itemSuccessMessages.itemReverted)
					})
				);
			}),
			ignoreElements()
		),
	// endregion
	// region showSystemNotification
	(action$) =>
		action$.pipe(
			ofType(showSystemNotification.type),
			tap(({ payload }) => {
				const hostToHost$ = getHostToHostBus();
				hostToHost$.next(showSystemNotification(payload));
			}),
			ignoreElements()
		),
	// endregion
	// region showRejectItemSuccessNotification
	(action$, state$, { getIntl }) =>
		action$.pipe(
			ofType(showRejectItemSuccessNotification.type),
			tap(({ payload }) => {
				const hostToHost$ = getHostToHostBus();
				hostToHost$.next(
					showSystemNotification({
						message: getIntl().formatMessage(itemSuccessMessages.itemRejected, { count: payload?.count ?? 1 })
					})
				);
			}),
			ignoreElements()
		),
	// endregion
	// region messageSharedWorker
	(action$, state$, { worker }) =>
		action$.pipe(
			ofType(messageSharedWorker.type),
			tap((action) => {
				worker.port.postMessage(action.payload);
			}),
			ignoreElements()
		),
	// endregion
	// region fetchPublishingStatus
	(action$, state$) =>
		action$.pipe(
			ofType(fetchPublishingStatus.type),
			withLatestFrom(state$),
			filter(([, state]) => Boolean(state.sites.active)),
			exhaustMap(([, state]) =>
				fetchStatus(state.sites.active).pipe(
					switchMap((response) => {
						let actions = [fetchPublishingStatusComplete(response)];
						const publishingStatusState = getPublishingStatusState(response);
						if (['ready', 'stopped'].includes(publishingStatusState)) {
							actions.push(fetchPublishingStatusProcessingComplete());
						}
						return actions;
					}),
					catchAjaxError(fetchPublishingStatusFailed)
				)
			)
		),
	// endregion
	// region startPublishingStatusFetcher
	(action$, state$) =>
		action$.pipe(
			ofType(startPublishingStatusFetcher.type),
			withLatestFrom(state$),
			filter(([, state]) => Boolean(state.sites.active)),
			switchMap(() =>
				interval(150000).pipe(
					startWith(0), // To fetch status immediately
					map(() => fetchPublishingStatus()),
					takeUntil(
						action$.pipe(
							ofType(stopPublishingStatusFetcher.type, sessionTimeout.type, sharedWorkerUnauthenticated.type)
						)
					)
				)
			)
		),
	// endregion
	// region fetchPublishingStatusProcessing
	(action$, state$) =>
		action$.pipe(
			ofType(fetchPublishingStatusComplete.type),
			withLatestFrom(state$),
			filter(([, state]) => ['processing', 'publishing'].includes(getPublishingStatusState(state.publishing))),
			switchMap(() =>
				interval(1000).pipe(
					startWith(0), // To fetch status immediately
					map(() => fetchPublishingStatus()),
					takeUntil(
						action$.pipe(
							ofType(
								fetchPublishingStatusProcessingComplete.type,
								sessionTimeout.type,
								sharedWorkerUnauthenticated.type
							)
						)
					)
				)
			)
		),
	// endregion
	// region fetchGlobalMenu
	(action$) =>
		action$.pipe(
			ofType(fetchGlobalMenu.type),
			exhaustMap(() => fetchGlobalMenuItems().pipe(map(fetchGlobalMenuComplete), catchAjaxError(fetchGlobalMenuFailed)))
		),
	// endregion
	// region newProjectReady
	(action$) =>
		action$.pipe(
			ofType(newProjectReady.type),
			map(() => fetchSites())
		),
	// endregion
	// region projectDeleted
	(action$: Observable<StandardAction<ProjectLifecycleEvent<'SITE_DELETED_EVENT'>>>, state$, { getIntl }) =>
		action$.pipe(
			ofType(projectDeleted.type),
			withLatestFrom(state$),
			switchMap(([{ payload }, state]) => {
				const { formatMessage } = getIntl();
				const { byId: sites, active: site } = state.sites;
				const { authoringBase } = state.env;
				// Site deleted was the active site?
				if (payload.siteUuid === sites[site]?.uuid) {
					removeSiteCookie();
					const pathname = window.location.pathname;
					const shouldRedirect =
						isPreviewAppUrl(pathname) || isDashboardAppUrl(pathname) || isProjectToolsAppUrl(pathname);
					if (shouldRedirect) {
						alert(
							formatMessage({ defaultMessage: "This project has been deleted, you'll be redirected to projects list." })
						);
						window.location.href = `${authoringBase}#${GlobalRoutes.Projects}`;
						return NEVER;
					} else {
						return [popSite({ siteId: site, isActive: true }), messageSharedWorker(closeSiteSocket({ site }))];
					}
				} else {
					return [fetchSites()];
				}
			})
		),
	// endregion
	// region siteSocketStatus
	(action$, state$, { getIntl, store }) =>
		action$.pipe(
			ofType(siteSocketStatus.type),
			withLatestFrom(state$),
			filter(([action, state]) => action.payload.connected && action.payload.siteId !== state.sites.active),
			map(([action, state]) => {
				const sites = state.sites.byId;
				const currentProjectId = state.sites.active;
				const newProjectId = action.payload.siteId;
				const currentProject = sites[currentProjectId].name;
				const newProject = sites[newProjectId].name;
				const dialogId = nanoid();
				return pushConfirmDialog({
					id: dialogId,
					props: {
						body: getIntl().formatMessage(msgs.siteSwitchedOnAnotherTab, {
							newProject,
							currentProject
						}),
						okButtonText: getIntl().formatMessage(msgs.siteSwitchedOnAnotherTabPrimaryAction, {
							newProject,
							currentProject
						}),
						cancelButtonText: getIntl().formatMessage(msgs.siteSwitchedOnAnotherTabSecondaryAction, {
							newProject,
							currentProject
						}),
						onOk: () => {
							// Continue on current site (since it was changed on another tab we need to call previewSwitch, to re-set the
							// current site)
							setSiteCookie(currentProjectId);
							previewSwitch().subscribe();
							store.dispatch(
								batchActions([
									popDialog({ id: dialogId }),
									messageSharedWorker(openSiteSocket({ site: currentProjectId, xsrfToken: getXSRFToken() }))
								])
							);
						},
						onCancel: () => {
							setSiteCookie(newProjectId);
							setTimeout(() => {
								const href = window.location.href;
								if (href.includes(`site=`)) {
									window.location.href = href.replace(`site=${currentProjectId}`, `site=${newProjectId}`);
								} else {
									window.location.reload();
								}
							});
							store.dispatch(popDialog({ id: dialogId }));
						}
					}
				});
			})
		)
	// endregion
];

export default systemEpics;
