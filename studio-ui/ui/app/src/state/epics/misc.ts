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
import { catchError, filter, map, switchMap, withLatestFrom } from 'rxjs/operators';
import { EMPTY, merge, Observable, of } from 'rxjs';
import GlobalState from '../../models/GlobalState';
import {
	batchActions,
	changeContentType as changeContentTypeAction,
	createFile as createFileAction,
	editContentTypeTemplate,
	editController,
	editTemplate
} from '../actions/misc';
import { createFile, fetchContentItem } from '../../services/content';
import {
	FORM_CONTROLLER_FILE_NAME,
	FORM_CONTROLLER_JS_STUB
} from '../../components/FormsEngine/lib/formControllerStub';
import { reloadContentItem } from '../actions/content';
import { blockUI, showEditItemSuccessNotification, unblockUI } from '../actions/system';
import { CrafterCMSEpic } from '../store';
import { translations } from '../../components/ItemActionsMenu/translations';
import { getFileNameFromPath, getParentPath } from '../../utils/path';
import { popPiece } from '../../utils/string';
import { associateTemplate } from '../actions/preview';
import { pushDialog } from '../actions/dialogStack';
import { createComponentId, pickShowContentFormAction, pushErrorDialog } from '../../utils/system';
import { nanoid } from 'nanoid';
import { popCodeEditorDialog } from '../actions/dialogs';

const epics = [
	(action$, state$: Observable<GlobalState>, { store }) =>
		action$.pipe(
			ofType(changeContentTypeAction.type),
			withLatestFrom(state$),
			switchMap(([{ payload }, state]) => {
				const newContentTypeId = payload.newContentTypeId;
				const path = payload.path;
				if (payload.originalContentTypeId !== newContentTypeId) {
					return of(
						pickShowContentFormAction({
							site: state.sites.active,
							path,
							authoringBase: state.env.authoringBase,
							changeTemplate: newContentTypeId,
							onSaveSuccess: ({ action }) =>
								store.dispatch(batchActions([showEditItemSuccessNotification({ action }), reloadContentItem({ path })]))
						})
					);
				}
				return EMPTY;
			})
		),
	(action$, state$, { getIntl, store }) =>
		action$.pipe(
			ofType(editTemplate.type, editController.type, editContentTypeTemplate.type),
			filter(({ payload }) => payload.openOnSuccess || payload.openOnSuccess === void 0),
			withLatestFrom(state$),
			switchMap(([action, state]) => {
				const { payload, type } = action;
				let path;
				let mode;
				let contentType;
				if (editContentTypeTemplate.type === type) {
					const _contentType = state.contentTypes.byId[payload.contentTypeId];
					path = _contentType.displayTemplate
						? _contentType.displayTemplate
						: `/templates/web/${_contentType.type === 'page' ? 'pages' : 'components'}/${popPiece(
								_contentType.id,
								'/'
							)}.ftl`;
					mode = 'ftl';
					contentType = payload.contentTypeId;
				} else {
					path = `${payload.path}/${payload.fileName}`.replace(/\/{2,}/g, '/');
					mode = payload.mode;
					contentType = payload.contentType;
				}
				const fileName = editContentTypeTemplate.type === type ? getFileNameFromPath(path) : payload.fileName;
				const destinationPath = editContentTypeTemplate.type === type ? getParentPath(path) : payload.path;
				// Only editing templates should associate. Groovy controllers are not on the content type definition.
				const shouldAssociateTemplate = type !== editController.type;
				const onSaveSuccess = payload.onSaveSuccess;
				const openCodeEditor = (dialogId: string, isNew = false) =>
					pushDialog({
						id: dialogId,
						component: createComponentId('CodeEditorDialog'),
						allowFullScreen: true,
						allowMinimize: true,
						props: {
							site: state.sites.active,
							path,
							mode,
							contentType,
							isNew,
							associateTemplateOnSave: isNew && shouldAssociateTemplate,
							onSuccess: onSaveSuccess,
							onClose: () => store.dispatch(popCodeEditorDialog({ id: dialogId }))
						}
					});
				return merge(
					of(blockUI({ message: getIntl().formatMessage(translations.verifyingAffectedWorkflows) })),
					fetchContentItem(state.sites.active, path).pipe(
						map(() => {
							const dialogId = nanoid();
							return batchActions([openCodeEditor(dialogId), unblockUI()]);
						}),
						catchError(({ response }) => {
							if (response.response.code === 7000) {
								const dialogId = nanoid();
								if (payload.createBeforeOpen) {
									return of(
										createFileAction({
											path: destinationPath,
											fileName,
											onCreated: batchActions(
												[
													shouldAssociateTemplate &&
														associateTemplate({ contentTypeId: contentType, displayTemplate: path }),
													openCodeEditor(dialogId),
													unblockUI()
												].filter(Boolean)
											)
										})
									);
								}
								return of(batchActions([openCodeEditor(dialogId, true), unblockUI()]));
							} else {
								return of(batchActions([pushErrorDialog({ props: { error: response.response } }), unblockUI()]));
							}
						})
					)
				);
			})
		),
	(action$, state$) =>
		action$.pipe(
			ofType(createFileAction.type),
			withLatestFrom(state$),
			switchMap(([{ payload }, state]) => {
				const path = payload.path;
				const fileName = payload.fileName;
				const content = fileName === FORM_CONTROLLER_FILE_NAME ? FORM_CONTROLLER_JS_STUB : '';
				return createFile(state.sites.active, path, fileName, content).pipe(map(() => payload.onCreated));
			})
		)
] as CrafterCMSEpic[];

export default epics;
