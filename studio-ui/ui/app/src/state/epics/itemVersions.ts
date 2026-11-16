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

import { ofType, StateObservable } from 'redux-observable';
import { map, switchMap, withLatestFrom } from 'rxjs/operators';
import GlobalState from '../../models/GlobalState';
import { fetchItemHistory as getContentHistory, fetchVersions, revertTo } from '../../services/content';
import { catchAjaxError } from '../../utils/ajax';
import {
	compareBothVersions,
	compareBothVersionsComplete,
	compareBothVersionsFailed,
	compareToPreviousVersion,
	fetchItemVersions,
	fetchItemVersionsComplete,
	fetchItemVersionsFailed,
	resetVersionsState,
	revertContent,
	revertContentComplete,
	revertContentFailed,
	revertToPreviousVersion,
	versionsChangeItem
} from '../actions/versions';
import { EMPTY, of } from 'rxjs';
import { historyDialogClosed } from '../actions/dialogs';
import { fetchHistory as getConfigurationHistory } from '../../services/configuration';
import { reloadContentItem } from '../actions/content';
import { emitSystemEvent, itemReverted, showRevertItemSuccessNotification } from '../actions/system';
import { batchActions } from '../actions/misc';
import { getHostToGuestBus } from '../../utils/subjects';
import { reloadRequest } from '../actions/preview';
import { CrafterCMSEpic } from '../store';
import { getControllerPath } from '../../utils/path';
import { popPiece } from '../../utils/string';

export default [
	(action$, state$: StateObservable<GlobalState>) =>
		action$.pipe(
			ofType(fetchItemVersions.type, versionsChangeItem.type),
			withLatestFrom(state$),
			switchMap(([{ payload }, state]) => {
				const service = state.versions.isConfig
					? getConfigurationHistory(
							state.sites.active,
							payload?.path ?? state.versions.item.path,
							payload?.environment ?? state.versions.environment,
							payload?.module ?? state.versions.module
						)
					: getContentHistory(state.sites.active, payload?.path ?? state.versions.item.path);
				return service.pipe(map(fetchItemVersionsComplete), catchAjaxError(fetchItemVersionsFailed));
			})
		),
	(action$, state$: StateObservable<GlobalState>) =>
		action$.pipe(
			ofType(compareBothVersions.type, compareToPreviousVersion.type),
			withLatestFrom(state$),
			switchMap(([{ payload }, state]) =>
				fetchVersions(state.sites.active, [
					state.versions.byId[state.versions.selected[0]],
					state.versions.byId[state.versions.selected[1]]
				]).pipe(map(compareBothVersionsComplete), catchAjaxError(compareBothVersionsFailed))
			)
		),
	(action$, state$: StateObservable<GlobalState>) =>
		action$.pipe(
			ofType(revertContent.type, revertToPreviousVersion.type),
			withLatestFrom(state$),
			switchMap(([{ payload }, state]) =>
				revertTo(
					payload.siteId ?? state.sites.active,
					payload.path ?? state.versions.item.path,
					payload.versionNumber ?? state.versions.previous
				).pipe(
					map(() => revertContentComplete({ path: payload.path })),
					catchAjaxError(revertContentFailed)
				)
			)
		),
	(action$, state$: StateObservable<GlobalState>) =>
		action$.pipe(
			ofType(revertContentComplete.type),
			withLatestFrom(state$),
			switchMap(([{ payload }, state]) => {
				const currentPreviewPath = state.preview.guest?.path;
				let isPreviewTemplateOrController = false;
				if (currentPreviewPath) {
					const currentItem = state.content.itemsByPath[currentPreviewPath];
					const currentContentTypeId = currentItem?.contentTypeId;
					const currentContentType = currentContentTypeId ? state.contentTypes.byId[currentContentTypeId] : null;
					const controllerPath =
						currentContentTypeId && currentItem
							? `${getControllerPath(currentItem.systemType)}${popPiece(currentContentTypeId, '/')}.groovy}`
							: null;

					if (currentContentType?.displayTemplate === payload.path || controllerPath === payload.path) {
						isPreviewTemplateOrController = true;
					}
				}

				if (payload.path === currentPreviewPath || isPreviewTemplateOrController) {
					getHostToGuestBus().next({ type: reloadRequest.type });
				}
				return of(
					batchActions([
						emitSystemEvent(itemReverted({ target: payload.path })),
						fetchItemVersions(),
						showRevertItemSuccessNotification(),
						reloadContentItem({ path: payload.path })
					])
				);
			})
		),
	(action$, state$: StateObservable<GlobalState>) =>
		action$.pipe(
			ofType(historyDialogClosed.type),
			withLatestFrom(state$),
			switchMap(([, { dialogs }]) => {
				if (!dialogs.viewVersion.open && !dialogs.compareVersions.open) {
					return of(resetVersionsState());
				} else {
					return EMPTY;
				}
			})
		)
] as CrafterCMSEpic[];
