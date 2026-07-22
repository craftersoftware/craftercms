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
import { filter, map, mergeMap, switchMap, tap, withLatestFrom } from 'rxjs/operators';
import {
	clearClipboard,
	conditionallyUnlockItem,
	contentItemsMissing,
	deleteController,
	deleteTemplate,
	duplicateAsset,
	duplicateItem,
	duplicateWithPolicyValidation,
	fetchContentItem,
	fetchContentItemComplete,
	fetchContentItemFailed,
	fetchContentItems,
	fetchContentItemsComplete,
	fetchContentItemsFailed,
	fetchQuickCreateList as fetchQuickCreateListAction,
	fetchQuickCreateListComplete,
	fetchQuickCreateListFailed,
	lockItem,
	lockItemCompleted,
	lockItemFailed,
	pasteItem,
	pasteItemWithPolicyValidation,
	reloadContentItem,
	unlockItem
} from '../actions/content';
import { catchAjaxError, extractErrorPayload } from '../../utils/ajax';
import {
	duplicate,
	fetchContentItem as fetchContentItemService,
	fetchContentItems as fetchContentItemsService,
	fetchItemByPath,
	fetchQuickCreateList,
	lock,
	paste,
	unlock
} from '../../services/content';
import { merge, Observable, of } from 'rxjs';
import { getEditorMode, isEditableAsset } from '../../utils/content';
import {
	blockUI,
	contentEvent,
	lockContentEvent,
	moveContentEvent,
	showDeleteItemSuccessNotification,
	showDuplicatedItemSuccessNotification,
	showPasteItemSuccessNotification,
	showSystemNotification,
	showUnlockItemSuccessNotification,
	unblockUI
} from '../actions/system';
import { batchActions } from '../actions/misc';
import {
	getItemGroovyPath,
	getItemTemplatePath,
	getParentPath,
	isValidCopyPastePath,
	withIndex,
	withoutIndex
} from '../../utils/path';
import { getHostToGuestBus, getHostToHostBus } from '../../utils/subjects';
import { validateActionPolicy } from '../../services/sites';
import { defineMessages } from 'react-intl';
import { CrafterCMSEpic } from '../store';
import StandardAction from '../../models/StandardAction';
import { asArray } from '../../utils/array';
import { AjaxError } from 'rxjs/ajax';
import { dissociateTemplate } from '../actions/preview';
import { isBlank } from '../../utils/string';
import SocketEvent, { MoveContentEventPayload } from '../../models/SocketEvent';
import { popDialog, pushDialog } from '../actions/dialogStack';
import { nanoid } from 'nanoid';
import { createComponentId, pickShowContentFormAction, pushConfirmDialog, pushErrorDialog } from '../../utils/system';
import type { ContentItem } from '../../models';
import { popCodeEditorDialog, showItemMegaMenu } from '../actions/dialogs';

export const sitePolicyMessages = defineMessages({
	itemPastePolicyConfirm: {
		id: 'pastePolicy.confirm',
		defaultMessage:
			'The selected {action} target goes against project policies for the destination directory ({detail}). • Original path: "{path}", • Suggested path is: "{modifiedPath}". Would you like to use the suggested path?'
	},
	itemPastePolicyError: {
		id: 'pastePolicy.error',
		defaultMessage: 'The selected {action} target goes against project policies for the destination directory: {detail}'
	},
	itemPasteValidating: {
		id: 'words.validating',
		defaultMessage: 'Validating'
	},
	duplicate: {
		id: 'words.duplicate',
		defaultMessage: 'Duplicate'
	}
});

export const itemFailureMessages = defineMessages({
	itemPasteToChildNotAllowed: {
		id: 'item.itemPasteToChildNotAllowed',
		defaultMessage: 'Pasting to a child item is not allowed for cut'
	},
	controllerNotFound: {
		id: 'item.controllerNotFound',
		defaultMessage: 'Controller not found.'
	},
	templateNotFound: {
		id: 'item.templateNotFound',
		defaultMessage: 'Template not found.'
	}
});

const inProgressMessages = defineMessages({
	pasting: {
		id: 'words.pasting',
		defaultMessage: 'Pasting'
	},
	processing: {
		id: 'words.processing',
		defaultMessage: 'Processing'
	},
	duplicating: {
		id: 'words.duplicating',
		defaultMessage: 'Duplicating'
	}
});

const content: CrafterCMSEpic[] = [
	// region fetchQuickCreateListAction
	(action$, $state) =>
		action$.pipe(
			ofType(fetchQuickCreateListAction.type),
			withLatestFrom($state),
			switchMap(
				([
					,
					{
						sites: { active }
					}
				]) =>
					fetchQuickCreateList(active).pipe(
						map(fetchQuickCreateListComplete),
						catchAjaxError(fetchQuickCreateListFailed)
					)
			)
		),
	// endregion
	// region showItemMegaMenu
	(action$) =>
		action$.pipe(
			ofType(showItemMegaMenu.type),
			map(({ payload }) => fetchContentItem({ path: payload.path }))
		),
	// endregion
	// region fetchContentItem, reloadContentItem
	(action$, state$) =>
		action$.pipe(
			ofType(reloadContentItem.type),
			withLatestFrom(state$),
			filter(
				([{ payload, type }, state]) =>
					// Only fetch if the item isn't already in state or it is an explicit re-fetch
					// request (via reloadContentItem action)
					!state.content.itemsByPath[payload.path] || type === reloadContentItem.type
			),
			mergeMap(([{ payload }, state]) =>
				fetchContentItemService(state.sites.active, payload.path).pipe(
					map((item) => fetchContentItemComplete({ item })),
					catchAjaxError(fetchContentItemFailed)
				)
			)
		),
	// endregion
	// region fetchContentItem
	(action$, state$) =>
		action$.pipe(
			ofType(fetchContentItem.type),
			withLatestFrom(state$),
			mergeMap(([{ payload }, state]) =>
				fetchContentItemService(state.sites.active, payload.path).pipe(
					map((item) => (item ? fetchContentItemComplete({ item }) : contentItemsMissing({ paths: [payload.path] }))),
					catchAjaxError(fetchContentItemFailed)
				)
			)
		),
	// endregion
	// region fetchContentItems
	(action$, state$) =>
		action$.pipe(
			ofType(fetchContentItems.type),
			withLatestFrom(state$),
			mergeMap(([{ payload }, state]) =>
				fetchContentItemsService(state.sites.active, payload.paths).pipe(
					map((items) => fetchContentItemsComplete({ items })),
					catchAjaxError(fetchContentItemsFailed)
				)
			)
		),
	// endregion
	// region duplicateItem
	(action$, state$, { getIntl, store }) =>
		action$.pipe(
			ofType(duplicateItem.type),
			withLatestFrom(state$),
			switchMap(([{ payload }, state]) =>
				merge(
					of(
						blockUI({
							progress: 'indeterminate',
							message: `${getIntl().formatMessage(inProgressMessages.duplicating)}...`
						})
					),
					duplicate(state.sites.active, payload.path).pipe(
						switchMap(({ item: path }) => [
							unblockUI(),
							pickShowContentFormAction({
								site: state.sites.active,
								path,
								authoringBase: state.env.authoringBase,
								onSaveSuccess: () => store.dispatch(payload.onSuccess)
							})
						])
					)
				)
			),
			catchAjaxError(
				() => unblockUI(),
				(error) => pushErrorDialog({ props: { error: error.response } })
			)
		),
	// endregion
	// region unlockItem
	(action$, state$) =>
		action$.pipe(
			ofType(unlockItem.type),
			withLatestFrom(state$),
			switchMap(([{ payload }, state]) =>
				unlock(state.sites.active, payload.path).pipe(
					// Not using the boolean return of the service. If the item it's already unlocked,
					// notify anyway of successful unlock as not notifying can be confusing (i.e. "what happened?").
					filter(() => payload.notify),
					map(() => showUnlockItemSuccessNotification())
				)
			)
		),
	// endregion
	// region lockItem
	(action$, state$) =>
		action$.pipe(
			ofType(lockItem.type),
			withLatestFrom(state$),
			switchMap(([{ payload }, state]) =>
				lock(state.sites.active, payload.path).pipe(
					map(() => lockItemCompleted({ path: payload.path, username: state.user.username })),
					catchAjaxError((r) => {
						console.error(r);
						return lockItemFailed();
					})
				)
			)
		),
	// endregion
	// region conditionallyUnlockItem
	(action$, state$) =>
		action$.pipe(
			ofType(conditionallyUnlockItem.type),
			withLatestFrom(state$),
			filter(
				([{ payload }, state]) => state.content.itemsByPath[payload.path].lockOwner?.username === state.user.username
			),
			map(([{ payload }]) => unlockItem(payload))
		),
	// endregion
	// region duplicateAsset
	(action$, state$, { getIntl, store }) =>
		action$.pipe(
			ofType(duplicateAsset.type),
			withLatestFrom(state$),
			switchMap(([{ payload }, state]) =>
				merge(
					of(
						blockUI({
							progress: 'indeterminate',
							message: `${getIntl().formatMessage(inProgressMessages.duplicating)}...`
						})
					),
					duplicate(state.sites.active, payload.path).pipe(
						switchMap(({ item: path }) => {
							const mode = getEditorMode(state.content.itemsByPath[payload.path].mimeType);
							const editableAsset = isEditableAsset(payload.path);
							const dialogId = nanoid();
							return [
								unblockUI(),
								...(editableAsset
									? [
											pushDialog({
												id: dialogId,
												component: createComponentId('CodeEditorDialog'),
												props: {
													authoringBase: state.env.authoringBase,
													site: state.sites.active,
													path,
													mode,
													onSuccess: () => store.dispatch(payload.onSuccess),
													onClose: () => store.dispatch(popCodeEditorDialog({ id: dialogId }))
												}
											})
										]
									: [])
							];
						}),
						catchAjaxError(
							() => unblockUI(),
							(error) => pushErrorDialog({ props: { error: error.response } })
						)
					)
				)
			)
		),
	// endregion
	// region duplicateWithPolicyValidation
	(action$, state$, { getIntl, store }) =>
		action$.pipe(
			ofType(duplicateWithPolicyValidation.type),
			withLatestFrom(state$),
			switchMap(([{ payload }, state]) =>
				validateActionPolicy(state.sites.active, {
					type: 'COPY',
					target: payload.path,
					source: getParentPath(withoutIndex(payload.path))
				}).pipe(
					map(({ allowed, modifiedValue, target, message }) => {
						if (allowed && modifiedValue) {
							const dialogId = nanoid();
							return pushConfirmDialog({
								id: dialogId,
								props: {
									body: getIntl().formatMessage(sitePolicyMessages.itemPastePolicyConfirm, {
										action: getIntl().formatMessage(sitePolicyMessages.duplicate),
										path: target,
										modifiedPath: modifiedValue,
										detail: message
									}),
									onCancel: () => store.dispatch(popDialog({ id: dialogId })),
									onOk: () => {
										store.dispatch(
											batchActions([
												...(payload.type === 'item'
													? [
															duplicateItem({
																path: payload.path,
																onSuccess: showDuplicatedItemSuccessNotification()
															})
														]
													: [
															duplicateAsset({
																path: payload.path,
																onSuccess: showDuplicatedItemSuccessNotification()
															})
														]),
												popDialog({ id: dialogId })
											])
										);
									}
								}
							});
						} else if (allowed) {
							return payload.type === 'item'
								? duplicateItem({
										path: payload.path,
										onSuccess: showDuplicatedItemSuccessNotification()
									})
								: duplicateAsset({
										path: payload.path,
										onSuccess: showDuplicatedItemSuccessNotification()
									});
						} else {
							const dialogId = nanoid();
							return pushConfirmDialog({
								id: dialogId,
								props: {
									body: getIntl().formatMessage(sitePolicyMessages.itemPastePolicyError, {
										action: getIntl().formatMessage(sitePolicyMessages.duplicate),
										detail: message
									}),
									onOk: () => store.dispatch(popDialog({ id: dialogId }))
								}
							});
						}
					})
				)
			)
		),
	// endregion
	// region pasteItem
	(action$, state$, { getIntl }) =>
		action$.pipe(
			ofType(pasteItem.type),
			withLatestFrom(state$),
			filter(([{ payload }, state]) => {
				if (isValidCopyPastePath(payload.path, state.content.clipboard.sourcePath)) {
					return true;
				} else {
					getHostToHostBus().next(
						showSystemNotification({
							message: getIntl().formatMessage(itemFailureMessages.itemPasteToChildNotAllowed),
							options: { variant: 'error' }
						})
					);
					return false;
				}
			}),
			switchMap(([{ payload }, state]) =>
				merge(
					of(
						blockUI({
							progress: 'indeterminate',
							message: `${getIntl().formatMessage(inProgressMessages.pasting)}...`
						})
					),
					paste(state.sites.active, payload.path, state.content.clipboard).pipe(
						map(() => batchActions([unblockUI(), clearClipboard(), showPasteItemSuccessNotification()])),
						catchAjaxError(
							() => unblockUI(),
							(error) => {
								const responseCode = error.response?.code;
								if (responseCode === 56001) {
									const item = state.content.itemsByPath[state.content.clipboard.sourcePath];
									const sourceContentType = item?.contentTypeId;
									return pushErrorDialog({
										props: {
											error: {
												message: getIntl().formatMessage(
													{ defaultMessage: 'Cannot copy "{sourceLabel}" to "{targetPath}".' },
													{
														sourceLabel: item?.label ?? state.content.clipboard.sourcePath,
														targetPath: payload.path
													}
												),
												remedialAction: sourceContentType
													? getIntl().formatMessage(
															{
																defaultMessage:
																	'Content type "{contentType}" of the source item is not allowed in the target location.'
															},
															{
																contentType: sourceContentType
															}
														)
													: undefined
											}
										}
									});
								} else {
									return pushErrorDialog({ props: { error: extractErrorPayload(error as AjaxError) } });
								}
							}
						)
					)
				)
			)
		),
	// endregion
	// region pasteItemWithPolicyValidation
	(action$, state$, { getIntl, store }) =>
		action$.pipe(
			ofType(pasteItemWithPolicyValidation.type),
			withLatestFrom(state$),
			switchMap(([{ payload }, state]) => {
				let fileName = withoutIndex(state.content.clipboard.sourcePath).split('/').pop();
				if (
					state.content.clipboard.sourcePath.startsWith('/site/website') &&
					state.content.clipboard.sourcePath.endsWith('index.xml')
				) {
					fileName = withIndex(fileName);
				}
				return merge(
					of(
						blockUI({
							progress: 'indeterminate',
							message: `${getIntl().formatMessage(sitePolicyMessages.itemPasteValidating)}...`
						})
					),
					validateActionPolicy(state.sites.active, {
						type: state.content.clipboard.type === 'CUT' ? 'MOVE' : 'COPY',
						target: `${withoutIndex(payload.path)}/${fileName}`,
						source: state.content.clipboard.sourcePath
					}).pipe(
						switchMap(({ allowed, modifiedValue, target, message }) => {
							if (allowed && modifiedValue) {
								const dialogId = nanoid();
								return [
									unblockUI(),
									pushConfirmDialog({
										id: dialogId,
										props: {
											body: getIntl().formatMessage(sitePolicyMessages.itemPastePolicyConfirm, {
												action: state.content.clipboard.type === 'CUT' ? 'cut' : 'copy',
												path: target,
												modifiedPath: modifiedValue,
												detail: message
											}),
											onCancel: () => store.dispatch(popDialog({ id: dialogId })),
											onOk: () => {
												store.dispatch(batchActions([pasteItem({ path: payload.path }), popDialog({ id: dialogId })]));
											}
										}
									})
								];
							} else if (allowed) {
								return [
									pasteItem({
										path: payload.path
									})
								];
							} else {
								const dialogId = nanoid();
								return [
									unblockUI(),
									pushConfirmDialog({
										id: dialogId,
										props: {
											body: getIntl().formatMessage(sitePolicyMessages.itemPastePolicyError, {
												action: state.content.clipboard.type === 'CUT' ? 'cut' : 'copy',
												detail: message
											}),
											onOk: () => store.dispatch(popDialog({ id: dialogId }))
										}
									})
								];
							}
						})
					)
				);
			})
		),
	// endregion
	// region deleteController, deleteTemplate
	(action$, state$, { getIntl, store }) =>
		action$.pipe(
			ofType(deleteController.type, deleteTemplate.type),
			withLatestFrom(state$),
			switchMap(([{ type, payload }, state]) => {
				const { item, onSuccess } = payload;
				const path =
					type === 'DELETE_CONTROLLER' ? getItemGroovyPath(item) : getItemTemplatePath(item, state.contentTypes.byId);

				// path may be empty string if the displayTemplate has not been set for a content type.
				if (isBlank(path)) {
					const dialogId = nanoid();
					return of(
						pushConfirmDialog({
							id: dialogId,
							props: {
								body: getIntl().formatMessage(
									itemFailureMessages[type === 'DELETE_CONTROLLER' ? 'controllerNotFound' : 'templateNotFound']
								),
								onOk: () => store.dispatch(popDialog({ id: dialogId }))
							}
						})
					);
				} else {
					return merge(
						of(blockUI({ message: `${getIntl().formatMessage(inProgressMessages.processing)}...` })),
						fetchItemByPath(state.sites.active, path).pipe(
							switchMap((itemToDelete) => {
								const dialogId = nanoid();
								return [
									pushDialog({
										id: dialogId,
										component: createComponentId('DeleteDialog'),
										props: {
											items: asArray(itemToDelete),
											onSuccess: ({ items }: { items: ContentItem[] }) =>
												store.dispatch(
													batchActions(
														[
															showDeleteItemSuccessNotification({ items }),
															type === 'DELETE_TEMPLATE' && dissociateTemplate({ contentTypeId: item.contentTypeId }),
															popDialog({ id: dialogId }),
															onSuccess
														].filter(Boolean)
													)
												)
										}
									}),
									unblockUI()
								];
							}),
							catchAjaxError((error: AjaxError) => {
								const dialogId = nanoid();
								return batchActions([
									unblockUI(),
									error.status === 404
										? pushConfirmDialog({
												id: dialogId,
												props: {
													body: getIntl().formatMessage(
														itemFailureMessages[
															type === 'DELETE_CONTROLLER' ? 'controllerNotFound' : 'templateNotFound'
														]
													),
													onOk: () => store.dispatch(popDialog({ id: dialogId }))
												}
											})
										: pushErrorDialog({ props: { error: error.response ?? error } })
								]);
							})
						)
					);
				}
			})
		),
	// endregion
	// region lockContentEvent
	(action$, state$) =>
		action$.pipe(
			ofType(lockContentEvent.type),
			withLatestFrom(state$),
			filter(([{ payload }, state]) => Boolean(state.content.itemsByPath[payload.targetPath])),
			switchMap(([{ payload }, state]) =>
				fetchContentItemService(state.sites.active, payload.targetPath).pipe(
					tap((item) => {
						getHostToGuestBus().next(fetchContentItemComplete({ item }));
					}),
					map((item) => fetchContentItemComplete({ item })),
					catchAjaxError(fetchContentItemFailed)
				)
			)
		),
	// endregion
	// region contentEvent
	(action$: Observable<StandardAction<SocketEvent>>, state$) =>
		action$.pipe(
			ofType(contentEvent.type),
			withLatestFrom(state$),
			mergeMap(([action, state]) => {
				const { targetPath } = action.payload;
				const parentPath = getParentPath(targetPath);
				const parentWithIndex = withIndex(parentPath);
				return [
					// If the item is in state, assume it got updated
					state.content.itemsByPath[targetPath] && fetchContentItem({ path: targetPath }),
					// If the parent of the item is in state, a new item may have been added, re-fetch to update its child count
					state.content.itemsByPath[parentPath] && fetchContentItem({ path: parentPath }),
					state.content.itemsByPath[parentWithIndex] && fetchContentItem({ path: parentWithIndex })
				].filter(Boolean);
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
				const itemsByPath = state.content.itemsByPath;
				const { targetPath, sourcePath } = action.payload;
				const parentOfTarget = getParentPath(targetPath);
				const parentOfSource = getParentPath(sourcePath);
				// By this point, the reducer would have deleted the `sourcePath` from the state.
				// Re-fetch any items that are already on the state that were changed themselves or
				// where a child may have been added/removed.
				[targetPath, parentOfTarget, parentOfSource, withIndex(parentOfTarget), withIndex(parentOfSource)].forEach(
					(path) => {
						if (itemsByPath[path]) {
							actions.push(fetchContentItem({ path }));
						}
					}
				);
				return actions;
			})
		)
	// endregion
];

export default content;
