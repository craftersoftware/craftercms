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
import { filter, ignoreElements, map, switchMap, tap, withLatestFrom } from 'rxjs/operators';
import { NEVER, of } from 'rxjs';
import { camelize, dasherize } from '../../utils/string';
import {
	closeCodeEditorDialog,
	fetchContentVersion,
	fetchContentVersionComplete,
	fetchContentVersionFailed,
	newContentCreationComplete,
	popCodeEditorDialog,
	showCodeEditorDialog,
	showEditDialog,
	showPreviewDialog,
	updateCodeEditorDialog,
	updateEditDialogConfig,
	updatePreviewDialog
} from '../actions/dialogs';
import { fetchContentXML, fetchItemVersion } from '../../services/content';
import { catchAjaxError } from '../../utils/ajax';
import { batchActions } from '../actions/misc';
import { changeCurrentUrl, requestWorkflowCancellationDialogOnResult } from '../actions/preview';
import { CrafterCMSEpic } from '../store';
import { formEngineMessages } from '../../env/i18n-legacy';
import infoGraphic from '../../assets/information.svg';
import { nnou, nou } from '../../utils/object';
import { getHostToGuestBus } from '../../utils/subjects';
import { unlockItem } from '../actions/content';
import { generateDialogId } from '../../utils/dialogs';
import type { LegacyFormDialogStateProps } from '../../components/LegacyFormDialog/utils';
import type { CodeEditorDialogProps, CodeEditorDialogStateProps } from '../../components/CodeEditorDialog';
import type { PreviewDialogProps, PreviewDialogStateProps } from '../../components/PreviewDialog';
import { popDialog, pushDialog, updateDialogState } from '../actions/dialogStack';
import { nanoid } from 'nanoid';
import { pushConfirmDialog } from '../../utils/system';

function getDialogNameFromType(type: string): string {
	let name = getDialogActionNameFromType(type);
	return camelize(dasherize(name.toLowerCase()));
}

function getDialogActionNameFromType(type: string): string {
	return type.replace(/(CLOSE_)|(_DIALOG)/g, '');
}

const dialogEpics: CrafterCMSEpic[] = [
	// region fetchContentVersion
	(action$, state$) =>
		action$.pipe(
			ofType(fetchContentVersion.type),
			withLatestFrom(state$),
			switchMap(([{ payload }, state]) =>
				fetchItemVersion(state.sites.active, payload.path, payload.versionNumber).pipe(
					map(fetchContentVersionComplete),
					catchAjaxError(fetchContentVersionFailed)
				)
			)
		),
	// endregion
	// region newContentCreationComplete
	(action$) =>
		action$.pipe(
			ofType(newContentCreationComplete.type),
			filter(({ payload }) => payload.item?.isPage && payload.item.isPreviewable),
			map(({ payload }) => changeCurrentUrl(payload.redirectUrl))
		),
	// endregion
	// region showEditDialog, showCodeEditorDialog
	(action$, state$, { getIntl, store }) =>
		action$.pipe(
			ofType(showEditDialog.type, showCodeEditorDialog.type),
			withLatestFrom(state$),
			switchMap(([{ type, payload }, state]) => {
				// If state.path isn't null and the payload.path is different, it means another form is getting opened.
				// To avoid losing state of the form, we disallow this and show a dialog indicating to close the current
				// form before opening another.
				let showValidation = false;

				const dialogId = generateDialogId(type);
				const dialogState = state.dialogStack.byId[dialogId];

				if (dialogState) {
					if (type === showEditDialog.type) {
						showValidation =
							payload.path !== (dialogState.props as LegacyFormDialogStateProps).path ||
							payload.iceGroupId !== (dialogState.props as LegacyFormDialogStateProps).iceGroupId ||
							payload.modelId !== (dialogState.props as LegacyFormDialogStateProps).modelId;
					} else {
						showValidation = payload.path !== (dialogState.props as CodeEditorDialogStateProps).path;
					}
				}

				if (nou(payload.path) || !showValidation) {
					// If showEditDialog action is called while the dialog is already open & minimized, we maximize it.
					// Differences in the showEditDialog payload — to what's on the state — are ignored, except for the path,
					// which is used to check if it's the same form that's getting opened.

					if (dialogState) {
						const { isMinimized, updateDialogAction } =
							type === showEditDialog.type
								? {
										isMinimized: (dialogState.props as LegacyFormDialogStateProps).isMinimized,
										updateDialogAction: updateEditDialogConfig
									}
								: {
										isMinimized: (dialogState.props as CodeEditorDialogStateProps).isMinimized,
										updateDialogAction: updateCodeEditorDialog
									};
						if (isMinimized === true) {
							return of(updateDialogAction({ isMinimized: false }));
						}
					} else {
						return NEVER;
					}
				} else {
					const dialogId = nanoid();
					return of(
						pushConfirmDialog({
							id: dialogId,
							props: {
								body: getIntl().formatMessage(formEngineMessages.inProgressConfirmation),
								imageUrl: infoGraphic,
								onOk: () => store.dispatch(popDialog({ id: dialogId }))
							}
						})
					);
				}
			})
		),
	// endregion
	// region showPreviewDialog
	(action$, state$) =>
		action$.pipe(
			ofType(showPreviewDialog.type),
			withLatestFrom(state$),
			filter(
				([{ payload }, state]) =>
					payload.type === 'editor' &&
					nnou(payload.url) &&
					nou((state.dialogStack.byId[generateDialogId(showPreviewDialog.type)]?.props as PreviewDialogProps)?.content)
			),
			switchMap(([{ payload }, state]) =>
				fetchContentXML(state.sites.active, payload.url).pipe(map((content) => updatePreviewDialog({ content })))
			)
		),
	// endregion
	// region requestWorkflowCancellationDialogOnResult
	(action$) =>
		action$.pipe(
			ofType(requestWorkflowCancellationDialogOnResult.type),
			tap((action) => {
				const hostToGuest$ = getHostToGuestBus();
				hostToGuest$.next(action);
			}),
			ignoreElements()
		),
	// endregion
	// region closeCodeEditorDialog
	// Moved unlock from dialog to epics since the container has no visibility of the backdrop click close and
	// was hence unable to unlock the item in all cases.
	(action$, state$) =>
		action$.pipe(
			ofType(closeCodeEditorDialog.type),
			withLatestFrom(state$),
			filter(([, state]) => {
				const username = state.user.username;
				const codeEditorState = state.dialogStack.byId[generateDialogId(closeCodeEditorDialog.type)]
					?.props as CodeEditorDialogProps;
				const item = state.content.itemsByPath[codeEditorState?.path];
				return item?.stateMap.locked && item.lockOwner?.username === username;
			}),
			map(([, state]) =>
				unlockItem({
					path: (state.dialogStack.byId[generateDialogId(closeCodeEditorDialog.type)]?.props as CodeEditorDialogProps)
						.path
				})
			)
		),
	// endregion
	// region pushDialog
	(action$, state$) =>
		action$.pipe(
			ofType(pushDialog.type),
			withLatestFrom(state$),
			filter(([{ payload }, state]) => {
				return (
					payload.component === 'craftercms.components.PreviewDialog' &&
					payload.props.type === 'editor' &&
					nnou(payload.props.url) &&
					nou((state.dialogStack.byId[payload.id]?.props as PreviewDialogStateProps)?.content)
				);
			}),
			switchMap(([{ payload }, state]) =>
				fetchContentXML(state.sites.active, payload.props.url).pipe(
					map((content) => updateDialogState({ id: payload.id, props: { content } }))
				)
			)
		),
	// endregion
	// region popDialog
	(action$, state$) =>
		action$.pipe(
			ofType(popCodeEditorDialog.type),
			withLatestFrom(state$),
			filter(([{ payload }, state]) => {
				const dialogId = payload.id;
				// Check if the dialog has a path set in its state.
				if (!(state.dialogStack.byId[dialogId]?.props as CodeEditorDialogStateProps)?.path) return false;

				const username = state.user.username;
				const item =
					state.content.itemsByPath[(state.dialogStack.byId[dialogId]?.props as CodeEditorDialogStateProps)?.path];
				return item.stateMap.locked && item.lockOwner.username === username;
			}),
			map(([{ payload }, state]) =>
				batchActions([
					unlockItem({ path: (state.dialogStack.byId[payload.id].props as CodeEditorDialogStateProps).path }),
					popDialog({ id: payload.id })
				])
			)
		)
	// endregion
] as CrafterCMSEpic[];

export default dialogEpics;
