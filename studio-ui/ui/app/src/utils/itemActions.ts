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

import { translations } from '../components/ItemActionsMenu/translations';
import { AllItemActions, ContentItem } from '../models/Item';
import { ContextMenuOption } from '../components/ContextMenu';
import { getControllerPath, getRootPath, withoutIndex } from './path';
import { popCodeEditorDialog, showHistoryDialog } from '../state/actions/dialogs';
import { checkPathExistence, fetchContentItem, fetchContentItems } from '../services/content';
import {
	batchActions,
	changeContentType,
	editContentTypeTemplate,
	editController,
	EditFilePayload,
	editTemplate
} from '../state/actions/misc';
import {
	blockUI,
	emitSystemEvent,
	itemCut,
	showCopyItemSuccessNotification,
	showCreateFolderSuccessNotification,
	showCreateItemSuccessNotification,
	showCutItemSuccessNotification,
	showDeleteItemSuccessNotification,
	showEditItemSuccessNotification,
	showPublishItemSuccessNotification,
	unblockUI
} from '../state/actions/system';
import {
	deleteController,
	deleteTemplate,
	duplicateWithPolicyValidation,
	pasteItem,
	pasteItemWithPolicyValidation,
	reloadContentItem,
	setClipboard,
	unlockItem
} from '../state/actions/content';
import { popPiece } from './string';
import { IntlFormatters, MessageDescriptor } from 'react-intl';
import {
	hasApprovePublishAction,
	hasChangeTypeAction,
	hasContentDeleteAction,
	hasCopyAction,
	hasCreateAction,
	hasCreateFolderAction,
	hasCutAction,
	hasDeleteControllerAction,
	hasDeleteTemplateAction,
	hasDuplicateAction,
	hasEditAction,
	hasEditControllerAction,
	hasEditTemplateAction,
	hasGetDependenciesAction,
	hasPasteAction,
	hasPublishAction,
	hasPublishRequestAction,
	hasReadAction,
	hasReadHistoryAction,
	hasRenameAction,
	hasSchedulePublishAction,
	hasUnlockAction,
	hasUploadAction,
	isAudio,
	isInActiveWorkflow,
	isPdfDocument,
	isVideo
} from './content';
import { getEditorMode, isImage, isNavigable, isPreviewable } from '../components/PathNavigator/utils';
import React from 'react';
import { previewItem } from '../state/actions/preview';
import { createPresenceTable } from './array';
import { fetchPublishingStatus } from '../state/actions/publishingStatus';
import { Clipboard } from '../models/GlobalState';
import { Dispatch } from 'redux';
import SystemType from '../models/SystemType';
import { fetchItemVersions } from '../state/actions/versions';
import StandardAction from '../models/StandardAction';
import { fetchDependant } from '../services/dependencies';
import { NewContentDialogProps } from '../components/NewContentDialog/utils';
import { nanoid } from 'nanoid';
import { popDialog, pushDialog, updateDialogState } from '../state/actions/dialogStack';
import { createComponentId, pickShowContentFormAction, pushConfirmDialog, pushErrorDialog } from './system';
import { checkAndCancelAffectedPackages } from '../components/ViewPackagesDialog/utils';
import { fetchAllowedTypes } from '../services/contentTypes';

export type ContextMenuOptionDescriptor<ID extends string = string> = {
	id: ID;
	label: MessageDescriptor;
	values?: any;
};

const unparsedMenuOptions: Record<AllItemActions, ContextMenuOptionDescriptor<AllItemActions>> = {
	// region ItemActions
	edit: {
		id: 'edit',
		label: translations.edit
	},
	unlock: {
		id: 'unlock',
		label: translations.unlock
	},
	view: {
		id: 'view',
		label: translations.viewForm
	},
	createContent: {
		id: 'createContent',
		label: translations.createContent
	},
	createFolder: {
		id: 'createFolder',
		label: translations.createFolder
	},
	rename: {
		id: 'rename',
		label: translations.rename
	},
	delete: {
		id: 'delete',
		label: translations.delete
	},
	deleteController: {
		id: 'deleteController',
		label: translations.deleteController
	},
	deleteTemplate: {
		id: 'deleteTemplate',
		label: translations.deleteTemplate
	},
	changeContentType: {
		id: 'changeContentType',
		label: translations.changeContentType
	},
	cut: {
		id: 'cut',
		label: translations.cut
	},
	copy: {
		id: 'copy',
		label: translations.copy
	},
	copyWithChildren: {
		id: 'copyWithChildren',
		label: translations.copyWithChildren
	},
	paste: {
		id: 'paste',
		label: translations.paste
	},
	upload: {
		id: 'upload',
		label: translations.upload
	},
	duplicate: {
		id: 'duplicate',
		label: translations.duplicate
	},
	schedulePublish: {
		id: 'schedulePublish',
		label: translations.schedule
	},
	publish: {
		id: 'publish',
		label: translations.publish
	},
	requestPublish: {
		id: 'requestPublish',
		label: translations.publish
	},
	history: {
		id: 'history',
		label: translations.history
	},
	dependencies: {
		id: 'dependencies',
		label: translations.references
	},
	editController: {
		id: 'editController',
		label: translations.editController
	},
	editTemplate: {
		id: 'editTemplate',
		label: translations.editTemplate
	},
	revert: {
		id: 'revert',
		label: translations.revert
	},
	// endregion
	// region AssessRemovalItemActions
	viewMedia: {
		id: 'viewMedia',
		label: translations.view
	},
	duplicateAsset: {
		id: 'duplicateAsset',
		label: translations.duplicate
	},
	createController: {
		id: 'createController',
		label: translations.createController
	},
	createTemplate: {
		id: 'createTemplate',
		label: translations.createTemplate
	},
	// endregion
	// region VirtualItemActions
	editCode: {
		id: 'editCode',
		label: translations.edit
	},
	viewCode: {
		id: 'viewCode',
		label: translations.view
	},
	preview: {
		id: 'preview',
		label: translations.preview
	},
	viewPackages: {
		id: 'viewPackages',
		label: translations.viewPackages
	}
	// endregion
};

// `unparsedMenuOptions` is just used as a convenient way of dynamically getting all the actions,
// not using it for any other reason other than getting the full list of item actions.
export const allItemActions = Object.keys(unparsedMenuOptions);

export function toContextMenuOptionsLookup<Keys extends string = AllItemActions>(
	menuOptionDescriptors: Record<Keys, ContextMenuOptionDescriptor>,
	formatMessage: IntlFormatters['formatMessage']
): Record<Keys, ContextMenuOption> {
	const menuOptions: any = {};
	// @ts-expect-error - not sure why the type system is not picking up that the "values" are ContextMenuOptionDescriptor
	Object.entries(menuOptionDescriptors).forEach(([key, { id, label }]) => {
		menuOptions[key] = { id, label: formatMessage(label) };
	});
	return menuOptions;
}

export function generateSingleItemOptions(
	item: ContentItem,
	formatMessage: IntlFormatters['formatMessage'],
	options?: Partial<{
		hasClipboard: boolean;
		includeOnly: AllItemActions[];
	}>
): ContextMenuOption[][] {
	const actionsToInclude = createPresenceTable(options?.includeOnly ?? allItemActions) as Record<
		AllItemActions,
		boolean
	>;

	let sections: ContextMenuOption[][] = [];
	let sectionA: ContextMenuOption[] = [];
	let sectionB: ContextMenuOption[] = [];
	let sectionC: ContextMenuOption[] = [];
	let sectionD: ContextMenuOption[] = [];

	if (!item) {
		return sections;
	}

	const type = item.systemType;
	const isTemplate = item.path.startsWith('/templates');
	const isController = item.path.startsWith('/scripts');
	const isStaticAssets = item.path.startsWith('/static-assets');
	const menuOptions: Record<AllItemActions, ContextMenuOption> = toContextMenuOptionsLookup(
		unparsedMenuOptions,
		formatMessage
	);

	// region Section A
	if (hasEditAction(item.availableActions) && actionsToInclude.edit) {
		if (['page', 'component', 'taxonomy', 'levelDescriptor'].includes(type)) {
			sectionA.push(menuOptions.edit);
		} else {
			sectionA.push(menuOptions.editCode);
		}
	}
	if (hasUnlockAction(item.availableActions) && actionsToInclude.unlock) {
		sectionA.push(menuOptions.unlock);
	}
	if (
		!isStaticAssets &&
		!isController &&
		!isTemplate &&
		hasCreateAction(item.availableActions) &&
		actionsToInclude.createContent
	) {
		sectionA.push(menuOptions.createContent);
	}
	if (hasUploadAction(item.availableActions) && actionsToInclude.upload) {
		sectionB.push(menuOptions.upload);
	}
	if (hasCreateFolderAction(item.availableActions) && actionsToInclude.createFolder) {
		sectionA.push(menuOptions.createFolder);
	}
	if (hasContentDeleteAction(item.availableActions) && actionsToInclude.delete) {
		sectionA.push(menuOptions.delete);
	}
	if (hasGetDependenciesAction(item.availableActions) && actionsToInclude.dependencies) {
		sectionA.push(menuOptions.dependencies);
	}
	if (hasRenameAction(item.availableActions) && actionsToInclude.rename) {
		sectionA.push(menuOptions.rename);
	}
	if (hasReadHistoryAction(item.availableActions) && actionsToInclude.history) {
		sectionA.push(menuOptions.history);
	}
	if (hasChangeTypeAction(item.availableActions) && actionsToInclude.changeContentType) {
		sectionA.push(menuOptions.changeContentType);
	}
	if (isNavigable(item) && actionsToInclude.preview) {
		sectionA.push(menuOptions.preview);
	}
	if (hasReadAction(item.availableActions) && actionsToInclude.view) {
		if (['page', 'component', 'taxonomy', 'levelDescriptor'].includes(type)) {
			sectionA.push(menuOptions.view);
		} else if (isPreviewable(item)) {
			if (isImage(item) || isVideo(item) || isAudio(item) || isPdfDocument(item.mimeType)) {
				sectionA.push(menuOptions.viewMedia);
			} else {
				sectionA.push(menuOptions.viewCode);
			}
		}
	}

	// endregion

	// region Section B
	if (hasCutAction(item.availableActions) && actionsToInclude.cut) {
		sectionB.push(menuOptions.cut);
	}
	if (hasCopyAction(item.availableActions) && actionsToInclude.copy) {
		sectionB.push(menuOptions.copy);
		if (item.childrenCount > 0) {
			sectionB.push(menuOptions.copyWithChildren);
		}
	}
	if (hasPasteAction(item.availableActions) && options?.hasClipboard && actionsToInclude.paste) {
		sectionB.push(menuOptions.paste);
	}
	if (hasDuplicateAction(item.availableActions) && actionsToInclude.duplicate) {
		if (['page', 'component', 'taxonomy', 'levelDescriptor'].includes(type)) {
			sectionB.push(menuOptions.duplicate);
		} else {
			sectionB.push(menuOptions.duplicateAsset);
		}
	}
	// endregion

	// region Section C
	if (
		(hasPublishAction(item.availableActions) && actionsToInclude.publish) ||
		(hasPublishRequestAction(item.availableActions) && actionsToInclude.requestPublish) ||
		(hasSchedulePublishAction(item.availableActions) && actionsToInclude.schedulePublish)
	) {
		sectionC.push(menuOptions.publish);
	}
	if (isInActiveWorkflow(item)) {
		sectionC.push(menuOptions.viewPackages);
	}
	// endregion

	// region Section D
	if (hasEditControllerAction(item.availableActions) && actionsToInclude.editController) {
		sectionD.push(menuOptions.editController);
	}
	if (hasDeleteControllerAction(item.availableActions) && actionsToInclude.deleteController) {
		sectionD.push(menuOptions.deleteController);
	}
	if (hasEditTemplateAction(item.availableActions) && actionsToInclude.editTemplate) {
		sectionD.push(menuOptions.editTemplate);
	}
	if (hasDeleteTemplateAction(item.availableActions) && actionsToInclude.deleteTemplate) {
		sectionD.push(menuOptions.deleteTemplate);
	}
	if (isTemplate && hasCreateAction(item.availableActions) && actionsToInclude.createTemplate) {
		sectionD.push(menuOptions.createTemplate);
	}
	if (isController && hasCreateAction(item.availableActions) && actionsToInclude.createController) {
		sectionD.push(menuOptions.createController);
	}
	// endregion

	if (sectionA.length) {
		sections.push(sectionA);
	}
	if (sectionB.length) {
		sections.push(sectionB);
	}
	if (sectionC.length) {
		sections.push(sectionC);
	}
	if (sectionD.length) {
		sections.push(sectionD);
	}

	return sections;
}

export function generateMultipleItemOptions(
	items: ContentItem[],
	formatMessage: IntlFormatters['formatMessage'],
	options?: {
		includeOnly: AllItemActions[];
	}
): ContextMenuOption[] {
	let publish = true;
	let requestPublish = true;
	let approvePublish = true;
	let schedulePublish = true;
	let deleteItem = true;
	let sections = [];
	const menuOptions = toContextMenuOptionsLookup(unparsedMenuOptions, formatMessage);

	const actionsToInclude = createPresenceTable(options?.includeOnly ?? allItemActions) as Record<
		AllItemActions,
		boolean
	>;

	items.forEach((item) => {
		publish = publish && hasPublishAction(item.availableActions);
		requestPublish = requestPublish && hasPublishRequestAction(item.availableActions);
		approvePublish = approvePublish && hasApprovePublishAction(item.availableActions);
		schedulePublish = schedulePublish && hasSchedulePublishAction(item.availableActions);
		deleteItem = deleteItem && hasContentDeleteAction(item.availableActions);
	});

	if ((publish && actionsToInclude.publish) || (schedulePublish && actionsToInclude.schedulePublish)) {
		sections.push(menuOptions.publish);
	}
	if (deleteItem && actionsToInclude.delete) {
		sections.push(menuOptions.delete);
	}

	return sections;
}

export const itemActionDispatcher = ({
	site,
	item: itemOrItems,
	option,
	authoringBase,
	dispatch,
	formatMessage,
	clipboard,
	onActionSuccess,
	event,
	extraPayload
}: {
	site: string;
	item: ContentItem | ContentItem[];
	option: AllItemActions;
	authoringBase: string;
	dispatch: Dispatch;
	formatMessage: IntlFormatters['formatMessage'];
	clipboard?: Clipboard;
	onActionSuccess?: any;
	event?: React.MouseEvent<Element, MouseEvent>;
	extraPayload?: any;
}) => {
	let item: ContentItem;
	let items: ContentItem[];
	if (Array.isArray(itemOrItems)) {
		items = itemOrItems;
	} else {
		item = itemOrItems;
		items = [itemOrItems];
	}
	// actions that support only one item
	if (item) {
		switch (option) {
			case 'view': {
				const path = item.path;
				dispatch(pickShowContentFormAction({ site, path, authoringBase, readonly: true }));
				break;
			}
			case 'edit': {
				// TODO: Editing embedded components is not currently supported as to edit them,
				//  we need the modelId that's not supplied to this function.
				// const src = `${defaultSrc}site=${site}&path=${embeddedParentPath}&isHidden=true&modelId=${modelId}&type=form`
				const path = item.path;
				dispatch(
					pickShowContentFormAction({
						site,
						path,
						authoringBase,
						onSaveSuccess: ({ action }) =>
							dispatch(
								batchActions([
									showEditItemSuccessNotification({ action }),
									...(onActionSuccess ? [onActionSuccess] : [])
								])
							),
						...extraPayload
					})
				);
				break;
			}
			case 'createFolder': {
				const dialogId = nanoid();
				dispatch(
					pushDialog({
						id: dialogId,
						component: createComponentId('CreateFolderDialog'),
						props: {
							path: item.path,
							allowBraces: item.path.startsWith('/scripts/rest'),
							onCreated: () =>
								dispatch(batchActions([popDialog({ id: dialogId }), showCreateFolderSuccessNotification()])),
							isSubmitting: null
						}
					})
				);
				break;
			}
			case 'rename': {
				if (item.systemType === 'folder') {
					const dialogId = nanoid();
					dispatch(
						pushDialog({
							id: dialogId,
							component: createComponentId('CreateFolderDialog'),
							props: {
								path: item.path,
								allowBraces: item.path.startsWith('/scripts/rest'),
								rename: true,
								value: item.label,
								onRenamed: () => dispatch(popDialog({ id: dialogId }))
							}
						})
					);
				} else {
					const type =
						item.systemType === 'renderingTemplate'
							? 'template'
							: item.systemType === 'script'
								? 'controller'
								: 'asset';

					const dialogId = nanoid();
					dispatch(
						pushDialog({
							id: dialogId,
							component: createComponentId('RenameAssetDialog'),
							props: {
								item,
								allowBraces: item.path.startsWith('/scripts/rest'),
								type,
								onRenamed: () => dispatch(popDialog({ id: dialogId }))
							}
						})
					);
				}
				break;
			}
			case 'createContent': {
				const id = nanoid();

				dispatch(blockUI({ progress: 'indeterminate' }));
				fetchAllowedTypes(site, item.path).subscribe({
					next(contentTypesIds) {
						if (contentTypesIds?.length === 1) {
							const contentTypeId = contentTypesIds[0];
							dispatch(
								batchActions([
									unblockUI(),
									pickShowContentFormAction({
										authoringBase,
										site,
										path: withoutIndex(item.path),
										contentTypeId,
										isNewContent: true
									})
								])
							);
						} else {
							dispatch(
								batchActions([
									unblockUI(),
									pushDialog({
										id,
										component: createComponentId('NewContentDialog'),
										props: {
											item,
											onContentTypeSelected(response) {
												dispatch(updateDialogState({ id, props: { open: false } }));
												dispatch(
													pickShowContentFormAction({
														authoringBase,
														site,
														path: response.path,
														contentTypeId: response.contentType.id,
														isNewContent: true
													})
												);
											}
										} as Partial<NewContentDialogProps>
									})
								])
							);
						}
					},
					error({ response }) {
						dispatch(batchActions([unblockUI(), pushErrorDialog({ props: { error: response } })]));
					}
				});
				break;
			}
			case 'changeContentType': {
				const changeContentTypeDialogId = nanoid();
				dispatch(
					pushDialog({
						id: changeContentTypeDialogId,
						component: createComponentId('ChangeContentTypeDialog'),
						props: {
							item,
							onContentTypeSelected: ({ contentType }) => {
								dispatch(
									batchActions([
										popDialog({ id: changeContentTypeDialogId }),
										changeContentType({
											originalContentTypeId: item.contentTypeId,
											path: item.path,
											newContentTypeId: contentType.id
										})
									])
								);
							}
						}
					})
				);
				break;
			}
			case 'cut': {
				const path = item.path;
				if (item.systemType === 'folder') {
					dispatch(pushDialog({ component: createComponentId('FolderMoveAlertDialog'), props: { item } }));
				} else {
					checkAndCancelAffectedPackages({
						siteId: site,
						item,
						dispatch,
						onContinue: () => {
							fetchDependant(site, path).subscribe({
								next(dependantItems) {
									const actionToDispatch = batchActions([
										setClipboard({
											type: 'CUT',
											sourcePath: item.path
										}),
										emitSystemEvent(itemCut({ target: item.path })),
										showCutItemSuccessNotification()
									]);

									if (dependantItems?.length) {
										fetchContentItems(
											site,
											dependantItems.map((item) => item.path)
										).subscribe((contentItems) => {
											dispatch(
												pushDialog({
													component: createComponentId('BrokenReferencesDialog'),
													props: {
														path,
														references: contentItems,
														onContinue: () => dispatch(actionToDispatch)
													}
												})
											);
										});
									} else {
										dispatch(actionToDispatch);
									}
								},
								error({ response }) {
									dispatch(pushErrorDialog({ props: { error: response } }));
								}
							});
						},
						formatMessage
					});
				}
				break;
			}
			case 'copy': {
				dispatch(
					blockUI({
						progress: 'indeterminate',
						message: `${formatMessage(translations.processing)}...`
					})
				);
				checkPathExistence(site, item.path).subscribe({
					next(exists) {
						if (exists) {
							dispatch(
								batchActions([
									unblockUI(),
									setClipboard({
										type: 'COPY',
										sourcePath: item.path
									}),
									showCopyItemSuccessNotification()
								])
							);
						} else {
							dispatch(
								batchActions([
									unblockUI(),
									pushErrorDialog({
										props: {
											error: {
												code: '7000',
												message: `Content not found`,
												remedialAction: `Check if the item was deleted from the system or blob store`
											}
										}
									})
								])
							);
						}
					},
					error(response) {
						dispatch(batchActions([unblockUI(), pushErrorDialog({ props: { error: response } })]));
					}
				});
				break;
			}
			case 'copyWithChildren': {
				const itemPath = item.path;
				dispatch(
					batchActions([
						setClipboard({
							type: 'COPY',
							sourcePath: itemPath,
							includeChildren: true
						}),
						showCopyItemSuccessNotification()
					])
				);
				break;
			}
			case 'paste': {
				if (clipboard.type === 'CUT') {
					fetchContentItem(site, clipboard.sourcePath).subscribe((clipboardItem) => {
						if (isInActiveWorkflow(clipboardItem)) {
							dispatch(
								pushDialog({
									component: createComponentId('ViewPackagesDialog'),
									props: {
										item: clipboardItem,
										onContinue: () => dispatch(pasteItem({ path: item.path }))
									}
								})
							);
						} else {
							dispatch(pasteItem({ path: item.path }));
						}
					});
				} else {
					dispatch(pasteItemWithPolicyValidation({ path: item.path }));
				}
				break;
			}
			case 'duplicateAsset': {
				const dialogId = nanoid();
				dispatch(
					pushConfirmDialog({
						id: dialogId,
						props: {
							title: formatMessage(translations.duplicate),
							body: formatMessage(translations.duplicateDialogBody),
							onCancel: () => dispatch(popDialog({ id: dialogId })),
							onOk: () =>
								dispatch(
									batchActions([
										popDialog({ id: dialogId }),
										duplicateWithPolicyValidation({
											path: item.path,
											type: 'asset'
										})
									])
								)
						}
					})
				);
				break;
			}
			case 'duplicate': {
				const dialogId = nanoid();
				dispatch(
					pushConfirmDialog({
						id: dialogId,
						props: {
							title: formatMessage(translations.duplicate),
							body: formatMessage(translations.duplicateDialogBody),
							onCancel: () => dispatch(popDialog({ id: dialogId })),
							onOk: () =>
								dispatch(
									batchActions([
										popDialog({ id: dialogId }),
										duplicateWithPolicyValidation({
											path: item.path,
											type: 'item'
										})
									])
								)
						}
					})
				);
				break;
			}
			case 'history': {
				dispatch(
					batchActions([
						fetchItemVersions({
							item,
							rootPath: getRootPath(item.path)
						}),
						showHistoryDialog({})
					])
				);
				break;
			}
			case 'dependencies': {
				dispatch(
					pushDialog({
						component: createComponentId('DependenciesDialog'),
						props: { item, rootPath: getRootPath(item.path) }
					})
				);
				break;
			}
			case 'editTemplate': {
				dispatch(editContentTypeTemplate({ contentTypeId: item.contentTypeId }));
				break;
			}
			case 'editController': {
				dispatch(editControllerActionCreator(item.systemType, item.contentTypeId));
				break;
			}
			case 'createTemplate':
			case 'createController': {
				const dialogId = nanoid();
				dispatch(
					pushDialog({
						id: dialogId,
						component: createComponentId('CreateFileDialog'),
						props: {
							path: withoutIndex(item.path),
							type: option === 'createController' ? 'controller' : 'template',
							allowBraces: option === 'createController' ? item.path.startsWith('/scripts/rest') : false,
							onCreated: (payload) =>
								dispatch(
									batchActions([
										popDialog({ id: dialogId }),
										showCreateItemSuccessNotification(),
										option === 'createController' ? editController(payload) : editTemplate(payload)
									])
								),
							isSubmitting: null
						}
					})
				);
				break;
			}
			case 'editCode': {
				const dialogId = nanoid();
				dispatch(
					pushDialog({
						id: dialogId,
						component: createComponentId('CodeEditorDialog'),
						allowMinimize: true,
						allowFullScreen: true,
						props: {
							path: item.path,
							mode: getEditorMode(item),
							onClose: () => dispatch(popCodeEditorDialog({ id: dialogId }))
						}
					})
				);
				break;
			}
			case 'viewCode': {
				const mode = getEditorMode(item);
				dispatch(
					pushDialog({
						id: nanoid(),
						component: createComponentId('PreviewDialog'),
						allowMinimize: true,
						allowFullScreen: true,
						props: {
							type: 'editor',
							title: item.label,
							url: item.path,
							path: item.path,
							mode
						}
					})
				);
				break;
			}
			case 'viewMedia': {
				dispatch(
					pushDialog({
						component: createComponentId('PreviewDialog'),
						allowMinimize: true,
						allowFullScreen: true,
						props: {
							type: isImage(item) ? 'image' : isVideo(item) ? 'video' : isAudio(item) ? 'audio' : 'pdf',
							title: item.label,
							url: item.path
						}
					})
				);
				break;
			}
			case 'upload': {
				dispatch(
					pushDialog({
						component: createComponentId('UploadDialog'),
						props: {
							path: item.path,
							site
						}
					})
				);
				break;
			}
			case 'unlock': {
				dispatch(unlockItem({ path: item.path }));
				break;
			}
			case 'preview': {
				dispatch(previewItem({ item: item, newTab: event.ctrlKey || event.metaKey }));
				break;
			}
			case 'viewPackages': {
				dispatch(pushDialog({ component: createComponentId('ViewPackagesDialog'), props: { item } }));
				break;
			}
			default:
				break;
		}
	}
	// actions that support multiple items
	// TODO: some actions below aren't really well covered for multiple actions (e.g. deleting controller or template)
	switch (option) {
		case 'delete': {
			const dialogId = nanoid();
			dispatch(
				pushDialog({
					id: dialogId,
					component: createComponentId('DeleteDialog'),
					props: {
						items,
						onSuccess: ({ items }: { items: ContentItem[] }) =>
							dispatch(
								batchActions([
									showDeleteItemSuccessNotification({ items }),
									popDialog({ id: dialogId }),
									...(onActionSuccess ? [onActionSuccess] : [])
								])
							)
					}
				})
			);
			break;
		}
		case 'deleteController': {
			dispatch(deleteController({ item, onSuccess: onActionSuccess }));
			break;
		}
		case 'deleteTemplate': {
			dispatch(deleteTemplate({ item, onSuccess: onActionSuccess }));
			break;
		}
		case 'publish':
		case 'schedulePublish':
		case 'requestPublish': {
			const schedulingMap = {
				approvePublish: undefined,
				schedulePublish: 'custom',
				requestPublish: 'now',
				publish: 'now'
			};
			const dialogId = nanoid();
			dispatch(
				pushDialog({
					id: dialogId,
					component: createComponentId('PublishDialog'),
					props: {
						items,
						scheduling: schedulingMap[option],
						onSuccess: (payload) => {
							dispatch(
								batchActions([
									showPublishItemSuccessNotification(payload),
									...items.map((item) => reloadContentItem({ path: item.path })),
									popDialog({ id: dialogId }),
									fetchPublishingStatus(),
									...(onActionSuccess ? [onActionSuccess] : [])
								])
							);
						}
					}
				})
			);
			break;
		}
	}
};

export function editControllerActionCreator(
	systemType: SystemType,
	contentTypeId: string
): StandardAction<EditFilePayload> {
	return editController({
		path: getControllerPath(systemType),
		fileName: `${popPiece(contentTypeId, '/')}.groovy`,
		mode: 'groovy',
		contentType: contentTypeId
	});
}
