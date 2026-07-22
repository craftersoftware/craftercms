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

import { combineEpics, ofType } from 'redux-observable';
import { GuestStandardAction } from '../models/GuestStandardAction';
import {
	catchError,
	filter,
	finalize,
	ignoreElements,
	map,
	switchMap,
	take,
	takeUntil,
	tap,
	withLatestFrom
} from 'rxjs/operators';
import { isEditActionAvailable, not } from '../../utils/util';
import { post } from '../../utils/communicator';
import * as iceRegistry from '../../iceRegistry';
import { getById, getReferentialEntries, isTypeAcceptedAsByField } from '../../iceRegistry';
import { beforeWrite$, checkIfLockedOrModified, dragOk, getMoveComponentInfo, unwrapEvent } from '../util';
import * as contentController from '../../contentController';
import {
	createContentInstance,
	getCachedContentItem,
	getCachedContentItems,
	getCachedModel,
	getCachedModels,
	getCachedModelsByPath,
	getModelIdFromInheritedField,
	isInheritedField,
	modelHierarchyMap
} from '../../contentController';
import { from, interval, merge, NEVER, Observable, of, Subscriber } from 'rxjs';
import { clearAndListen$, destroyDragSubjects, dragover$, escape$, initializeDragSubjects } from '../subjects';
import { initTinyMCE } from '../../controls/rte';
import { dragAndDropActiveClass, EditingStatus, HighlightMode } from '../../constants';
import {
	assetDragEnded,
	assetDragStarted,
	clearContentTreeFieldSelected,
	clearSelectedZones,
	componentDragEnded,
	componentDragStarted,
	componentInstanceDragEnded,
	componentInstanceDragStarted,
	contentTreeFieldSelected,
	contentTreeSwitchFieldInstance,
	contentTypeDropTargetsRequest,
	contentTypeDropTargetsResponse,
	instanceDragBegun,
	instanceDragEnded,
	snackGuestMessage,
	trashed
} from '@craftercms/studio-ui/state/actions/preview';
import { MouseEventActionObservable } from '../models/Actions';
import { GuestState } from '../models/GuestStore';
import { notNullOrUndefined, nullOrUndefined } from '@craftercms/studio-ui/utils/object';
import { ElementRecord, ICEProps } from '../../models/InContextEditing';
import * as ElementRegistry from '../../elementRegistry';
import { compileAllDropZones, get, getElementFromICEProps } from '../../elementRegistry';
import { scrollToElement } from '../../utils/dom';
import {
	computedDragEnd,
	desktopAssetDragEnded,
	desktopAssetDragStarted,
	desktopAssetUploadComplete,
	desktopAssetUploadFailed,
	desktopAssetUploadProgress,
	desktopAssetUploadStarted,
	documentDragEnd,
	documentDragLeave,
	documentDragOver,
	documentDrop,
	dropzoneEnter,
	dropzoneLeave,
	exitComponentInlineEdit,
	setEditingStatus,
	startListening
} from '../actions';
import { extractCollectionItem } from '@craftercms/studio-ui/utils/model';
import { getParentModelId } from '../../utils/ice';
import { unlockItem } from '@craftercms/studio-ui/state/actions/content';
import StandardAction from '@craftercms/studio-ui/models/StandardAction';
import { validateActionPolicy } from '@craftercms/studio-ui/services/sites';
import { processPathMacros } from '@craftercms/studio-ui/utils/path';
import { uploadDataUrl } from '@craftercms/studio-ui/services/content';
import { getRequestForgeryToken } from '@craftercms/studio-ui/utils/auth';
import { ensureSingleSlash } from '@craftercms/studio-ui/utils/string';
import { getInheritanceParentIdsForField, validateImageRestrictions } from '@craftercms/studio-ui/utils/content';
import { SearchItem } from '@craftercms/studio-ui/models';
import type { ImageRestrictions } from '@craftercms/studio-ui/components/ImageEditorDialog/types';
import { imageEditCancelled, imageEdited, showImageEditorDialog } from '@craftercms/studio-ui/state/actions/dialogs';

const createReader$ = (file: File) =>
	new Observable((subscriber: Subscriber<ProgressEvent<FileReader>>) => {
		const reader = new FileReader();
		let closed = false;
		reader.onload = (event) => {
			if (!closed) {
				subscriber.next(event);
				subscriber.complete();
			}
		};
		reader.readAsDataURL(file);
		return () => {
			closed = true;
			subscriber.complete();
		};
	});

const epic = combineEpics<GuestStandardAction, GuestStandardAction, GuestState>(
	// region mouseover, mouseleave
	(action$: MouseEventActionObservable, state$) =>
		action$.pipe(
			ofType('mouseover', 'mouseleave'),
			withLatestFrom(state$),
			tap(
				([action, state]: [action: GuestStandardAction, state: GuestState]) =>
					state.status === EditingStatus.LISTENING && action.payload.event.stopPropagation()
			),
			ignoreElements()
		),
	// endregion
	// region dragstart
	(action$: MouseEventActionObservable, state$) =>
		action$.pipe(
			ofType('dragstart'),
			withLatestFrom(state$),
			switchMap(([action, state]: [action: GuestStandardAction, state: GuestState]) => {
				const {
					payload: { event, record }
				} = action;
				const iceId = state.draggable?.[record.id];
				const { isLocked, isExternallyModified } = checkIfLockedOrModified(state, record);
				if (isLocked || isExternallyModified) {
					return NEVER;
				} else if (nullOrUndefined(iceId)) {
					// When the drag starts on a child element of the item, it passes through here.
					console.error('No ice id found for this drag instance.', record, state.draggable);
				} else if (not(iceId)) {
					// Items that browser make draggable by default (images, etc).
					console.warn("Element is draggable but wasn't set draggable by craftercms");
				} else {
					post(instanceDragBegun(iceId));
					if (event) {
						event.stopPropagation();
						const e = unwrapEvent<DragEvent>(event);
						e.dataTransfer.setData('text/plain', `${record.id}`);
						e.dataTransfer.setDragImage(document.querySelector('.craftercms-dragged-element'), 20, 20);
					}
					document.documentElement.classList.add(dragAndDropActiveClass);
					return initializeDragSubjects(state$);
				}
				return NEVER;
			})
		),
	// endregion
	// region dragover
	(action$: MouseEventActionObservable, state$) =>
		action$.pipe(
			ofType('dragover'),
			withLatestFrom(state$),
			tap(([action, state]: [action: GuestStandardAction, state: GuestState]) => {
				const {
					payload: { event, record }
				} = action;
				let { element } = record;
				if (dragOk(state.status) && !state.dragContext?.scrolling && state.dragContext.players.includes(element)) {
					event.preventDefault();
					event.stopPropagation();
					dragover$().next({ event, record });
				}
			}),
			ignoreElements()
		),
	(action$) =>
		action$.pipe(
			ofType(documentDragOver.type),
			tap(({ payload: { event } }) => event.preventDefault()),
			ignoreElements()
		),
	// endregion
	// region dragleave
	(action$, state$) =>
		action$.pipe(
			ofType('dragleave', documentDragLeave.type),
			withLatestFrom(state$),
			filter(([, state]) => state.status === EditingStatus.UPLOAD_ASSET_FROM_DESKTOP),
			switchMap(() =>
				interval(100).pipe(
					map(() => desktopAssetDragEnded()),
					takeUntil(action$.pipe(ofType(documentDragOver.type, 'dragover')))
				)
			)
		),
	// endregion
	// region drop
	(action$: MouseEventActionObservable, state$) => {
		return action$.pipe(
			ofType('drop'),
			withLatestFrom(state$),
			filter(([, state]) => dragOk(state.status) && !state.dragContext.invalidDrop),
			switchMap(([action, state]: [action: GuestStandardAction, state: GuestState]) => {
				const {
					payload: { event, record }
				} = action;
				event.preventDefault();
				event.stopPropagation();
				const status = state.status;
				const dragContext = state.dragContext;
				const file = unwrapEvent<DragEvent>(event).dataTransfer.files[0];

				const models = getCachedModels();
				const dropZone = dragContext.dropZone;

				// If dropzone doesn't exist it means that the item was dropped in an invalid section
				// so there should be no lock or other actions.
				if (dropZone) {
					const { modelId } = iceRegistry.getById(dropZone.iceId);
					// get parentModelId in case the current dropZone is an embedded component
					const parentModelId = getParentModelId(modelId, models, modelHierarchyMap);
					// if path of current model doesn't exist (current component is embedded), then use the parent model id (shared)
					const path = models[modelId].craftercms.path ?? models[parentModelId].craftercms.path;
					const cachedContentItem = getCachedContentItem(path);

					const pathToLock = record.inherited
						? models[getModelIdFromInheritedField(modelId, record.fieldId)].craftercms.path
						: path;

					// If moving to the same position, there is no need of locking and other requests.
					if (status === EditingStatus.SORTING_COMPONENT && getMoveComponentInfo(dragContext).movedToSamePosition) {
						post(instanceDragEnded());
						return of(computedDragEnd());
					} else {
						// TODO: In the case of "move", only locking the source dropzone currently.
						// The item unlock happens with write content API
						return beforeWrite$({
							path: pathToLock,
							site: state.activeSite,
							username: state.username,
							localItem: cachedContentItem
						}).pipe(
							switchMap(() => {
								switch (status) {
									case EditingStatus.PLACING_DETACHED_ASSET: {
										const { dropZone } = dragContext;
										if (dropZone && dragContext.inZone) {
											const iceRecord = iceRegistry.getById(dropZone.iceId);
											const field = iceRegistry.getRecordField(iceRecord);
											const {
												validations: { allowImageUpload }
											} = field;

											const restrictions: ImageRestrictions = {
												height: field.validations?.height?.value,
												width: field.validations?.width?.value,
												maxHeight: field.validations?.maxHeight?.value,
												maxWidth: field.validations?.maxWidth?.value,
												minHeight: field.validations?.minHeight?.value,
												minWidth: field.validations?.minWidth?.value
											};

											// Path to upload asset if image doesn't meet restrictions
											const uploadPath = allowImageUpload?.value
												? processPathMacros({
														path: allowImageUpload.value,
														objectId: iceRecord.modelId
													})
												: `/static-assets/images/${iceRecord.modelId}`;

											const { path, name } = dragContext.dragged as SearchItem;
											return from(validateImageRestrictions(path, restrictions)).pipe(
												switchMap((meetsRestrictions) => {
													if (meetsRestrictions) {
														contentController.updateField(iceRecord.modelId, iceRecord.fieldId, iceRecord.index, path);
														return NEVER;
													} else {
														post(
															showImageEditorDialog({
																path,
																restrictions,
																fileName: name,
																recordId: record.id,
																uploadPath
															})
														);
														return of(desktopAssetDragEnded());
													}
												})
											);
										} else {
											return NEVER;
										}
									}
									case EditingStatus.SORTING_COMPONENT: {
										if (notNullOrUndefined(dragContext.targetIndex)) {
											post(instanceDragEnded());
											moveComponent(dragContext);
											return of(computedDragEnd());
										}
										break;
									}
									case EditingStatus.PLACING_NEW_COMPONENT: {
										if (notNullOrUndefined(dragContext.targetIndex)) {
											// `contentType` on the dragContext is the content type of the thing getting created
											const { targetIndex, contentType, dropZone } = dragContext;
											const record = iceRegistry.getById(dropZone.iceId);
											const entries = getReferentialEntries(record);
											// This assumes the validation of the type being accepted by the field has been performed prior
											// to this running. Hence, create as embedded if accepted, otherwise create as shared.
											const createAsEmbedded = isTypeAcceptedAsByField(entries.field, contentType.id, 'embedded');
											let newComponentPath = null;
											if (!createAsEmbedded) {
												newComponentPath =
													entries.contentType.dataSources?.find(
														(ds) =>
															ds.type === 'components' && ds.properties.contentTypes.split(',').includes(contentType.id)
													)?.properties?.baseRepoPath ?? null;
												newComponentPath = newComponentPath
													? processPathMacros({
															path: newComponentPath,
															objectId: record.modelId,
															useUUID: false,
															fullParentPath: path
														})
													: newComponentPath;
											}
											const instance = createContentInstance(contentType, newComponentPath);
											setTimeout(() => {
												contentController.insertComponent(
													record.modelId,
													record.fieldId,
													record.fieldId.includes('.') ? `${record.index}.${targetIndex}` : targetIndex,
													instance,
													!createAsEmbedded,
													true
												);
											});
										}
										break;
									}
									case EditingStatus.PLACING_DETACHED_COMPONENT: {
										if (notNullOrUndefined(dragContext.targetIndex)) {
											const { targetIndex, instance, dropZone } = dragContext;
											const record = iceRegistry.getById(dropZone.iceId);
											setTimeout(() => {
												contentController.insertComponent(
													record.modelId,
													record.fieldId,
													record.fieldId.includes('.') ? `${record.index}.${targetIndex}` : targetIndex,
													instance,
													// Only shared components ever come through this path
													true
												);
											});
										}
										break;
									}
									case EditingStatus.UPLOAD_ASSET_FROM_DESKTOP: {
										if (dragContext.inZone) {
											const { field } = iceRegistry.getReferentialEntries(record.iceIds[0]);
											const {
												validations: { allowImageUpload }
											} = field;

											const path = allowImageUpload?.value
												? processPathMacros({
														path: allowImageUpload.value,
														objectId: record.modelId
													})
												: // TODO: Support path coming from content type definition
													`/static-assets/images/${record.modelId}`;

											const restrictions: ImageRestrictions = {
												height: field.validations?.height?.value,
												width: field.validations?.width?.value,
												maxHeight: field.validations?.maxHeight?.value,
												maxWidth: field.validations?.maxWidth?.value,
												minHeight: field.validations?.minHeight?.value,
												minWidth: field.validations?.minWidth?.value
											};
											const readerObs = createReader$(file);

											return readerObs.pipe(
												switchMap((event) => {
													const fileSrc = event.target.result as string;
													return from(validateImageRestrictions(fileSrc, restrictions)).pipe(
														switchMap((meetsRestrictions) => {
															if (!meetsRestrictions) {
																const url = URL.createObjectURL(file);
																post(
																	showImageEditorDialog({
																		path: url,
																		restrictions,
																		fileName: file.name,
																		recordId: record.id,
																		uploadPath: path
																	})
																);

																return of(desktopAssetDragEnded());
															} else {
																return merge(
																	of(desktopAssetUploadStarted({ record })),
																	of(desktopAssetDragEnded()),
																	validateActionPolicy(state.activeSite, {
																		type: 'CREATE',
																		target: ensureSingleSlash(`${path}/${file.name}`),
																		contentMetadata: {
																			fileSize: file.size
																		}
																	}).pipe(
																		switchMap(({ allowed, modifiedValue, message }) => {
																			const aImg = record.element;
																			const originalSrc = aImg.src;
																			if (allowed) {
																				const fileName = modifiedValue
																					? modifiedValue.replace(path, '').replace(/^\//, '')
																					: file.name;

																				aImg.src = fileSrc;

																				post(snackGuestMessage({ id: 'assetUploadStarted' }));
																				return uploadDataUrl(
																					state.activeSite,
																					{
																						name: fileName,
																						type: file.type,
																						dataUrl: event.target.result
																					},
																					path,
																					getRequestForgeryToken()
																				).pipe(
																					switchMap((action) => {
																						if (action.type === 'progress') {
																							const { progress } = action.payload;
																							const percentage = Math.floor(
																								parseInt(
																									((progress.bytesUploaded / progress.bytesTotal) * 100).toFixed(2)
																								)
																							);
																							return of(
																								desktopAssetUploadProgress({
																									record,
																									percentage
																								})
																							);
																						} else {
																							if (modifiedValue) {
																								post(snackGuestMessage({ id: message }));
																							}
																							return of(
																								desktopAssetUploadComplete({
																									record,
																									path: `${path}${path.endsWith('/') ? '' : '/'}${fileName}`
																								})
																							);
																						}
																					}),
																					catchError(() => {
																						aImg.src = originalSrc;
																						post(
																							snackGuestMessage({
																								id: 'uploadError',
																								level: 'required'
																							})
																						);
																						return of(desktopAssetUploadFailed({ record }));
																					})
																				);
																			} else {
																				aImg.src = originalSrc;
																				post(
																					snackGuestMessage({
																						id: 'noPolicyComply',
																						level: 'required',
																						values: {
																							fileName: file.name,
																							detail: message
																						}
																					})
																				);
																				return of(desktopAssetUploadFailed({ record }));
																			}
																		})
																	)
																);
															}
														})
													);
												})
											);
										} else {
											return of(desktopAssetDragEnded());
										}
									}
								}
								return NEVER;
							})
						);
					}
				} else {
					return NEVER;
				}
			})
		);
	},
	// endregion
	// region imageEdited
	(action$, state$) => {
		return action$.pipe(
			ofType(imageEdited.type),
			withLatestFrom(state$),
			switchMap(([action, state]) => {
				const { blob, fileName: imageFileName, recordId, uploadPath: path } = action.payload;
				const record = get(recordId);
				const iceId = record.iceIds[0];
				const dropZone = compileAllDropZones(iceId)[0];

				if (dropZone) {
					return merge(
						of(desktopAssetDragEnded()),
						of(desktopAssetUploadStarted({ record })),
						validateActionPolicy(state.activeSite, {
							type: 'CREATE',
							target: ensureSingleSlash(`${path}/${imageFileName}`),
							contentMetadata: {
								fileSize: blob.size
							}
						}).pipe(
							switchMap(({ allowed, modifiedValue, message }) => {
								const aImg = record.element as HTMLImageElement;
								const originalSrc = aImg.src;
								if (allowed) {
									const fileName = modifiedValue ? modifiedValue.replace(path, '').replace(/^\//, '') : imageFileName;
									const previewUrl = URL.createObjectURL(blob);
									aImg.src = previewUrl;

									post(snackGuestMessage({ id: 'assetUploadStarted' }));
									return uploadDataUrl(
										state.activeSite,
										{
											name: fileName,
											type: blob.type,
											blob
										},
										path,
										getRequestForgeryToken()
									).pipe(
										switchMap((action) => {
											if (action.type === 'progress') {
												const { progress } = action.payload;
												const percentage = Math.floor(
													parseInt(((progress.bytesUploaded / progress.bytesTotal) * 100).toFixed(2))
												);
												return of(
													desktopAssetUploadProgress({
														record,
														percentage
													})
												);
											} else {
												if (modifiedValue) {
													post(snackGuestMessage({ id: message }));
												}
												return of(
													desktopAssetUploadComplete({
														record,
														path: `${path}${path.endsWith('/') ? '' : '/'}${fileName}`
													})
												);
											}
										}),
										catchError(() => {
											aImg.src = originalSrc;
											post(
												snackGuestMessage({
													id: 'uploadError',
													level: 'required'
												})
											);
											return of(desktopAssetUploadFailed({ record }));
										}),
										finalize(() => URL.revokeObjectURL(previewUrl))
									);
								} else {
									aImg.src = originalSrc;
									post(
										snackGuestMessage({
											id: 'noPolicyComply',
											level: 'required',
											values: {
												fileName: imageFileName,
												detail: message
											}
										})
									);
									return of(desktopAssetUploadFailed({ record }));
								}
							})
						)
					);
				} else {
					return NEVER;
				}
			})
		);
	},
	// endregion
	// region imageEditCancelled
	(action$) => {
		return action$.pipe(
			ofType(imageEditCancelled.type),
			switchMap(({ payload: { recordId } }) => {
				const record = get(recordId);
				return merge(of(desktopAssetDragEnded()), of(desktopAssetUploadFailed({ record })));
			})
		);
	},
	// endregion
	// region documentDrop
	(action$, state$) =>
		action$.pipe(
			ofType(documentDrop.type),
			withLatestFrom(state$),
			switchMap(([action, state]) => {
				const {
					payload: { event }
				} = action;
				const status = state.status;
				event.preventDefault();
				event.stopPropagation();
				switch (status) {
					case EditingStatus.UPLOAD_ASSET_FROM_DESKTOP:
						return of(desktopAssetDragEnded());
					case EditingStatus.SORTING_COMPONENT:
					case EditingStatus.PLACING_NEW_COMPONENT: {
						if (status === EditingStatus.SORTING_COMPONENT) {
							post(instanceDragEnded());
						}
						return [computedDragEnd(), startListening()];
					}
					default:
						return NEVER;
				}
			})
		),
	// endregion
	// region dragend, documentDragEnd
	(action$: MouseEventActionObservable, state$) => {
		return action$.pipe(
			ofType('dragend'),
			withLatestFrom(state$),
			filter(([, state]) => dragOk(state.status)),
			switchMap(([action, state]: [action: GuestStandardAction, state: GuestState]) => {
				const { event } = action.payload;
				event.preventDefault();
				event.stopPropagation();
				post(instanceDragEnded());
				return of(computedDragEnd());
			})
		);
	},
	(action$) =>
		action$.pipe(
			ofType(documentDragEnd.type),
			tap(({ payload }) => payload.event.preventDefault()),
			ignoreElements()
		),
	// endregion
	// region assetDragEnded, componentDragEnded, componentInstanceDragEnded, desktopAssetDragEnded
	(action$: MouseEventActionObservable) =>
		action$.pipe(
			ofType(assetDragEnded.type, componentDragEnded.type, componentInstanceDragEnded.type, desktopAssetDragEnded.type),
			map(() => computedDragEnd())
		),
	// endregion
	// region click
	(action$: MouseEventActionObservable, state$) =>
		action$.pipe(
			// Note: when action is `triggered_click`, the event is the edit button click event.
			ofType('click', 'triggered_click'),
			withLatestFrom(state$),
			filter(
				([action, state]) =>
					// @ts-expect-error: Unsure why typescript doesn't correctly detect the action type. Complains about action not having a `type` as it perceives it to be never.
					action.type === 'triggered_click' ||
					(state.highlightMode === HighlightMode.ALL && state.status === EditingStatus.LISTENING) ||
					(state.highlightMode === HighlightMode.MOVE_TARGETS && state.status === EditingStatus.LISTENING) ||
					(state.highlightMode === HighlightMode.MOVE_TARGETS && state.status === EditingStatus.FIELD_SELECTED)
			),
			switchMap(
				([action, state]: [
					action: GuestStandardAction<{ record: ElementRecord; event: PointerEvent }>,
					state: GuestState
				]) => {
					const actionType = action.type;
					const { record, event } = action.payload;
					const { isLocked, isExternallyModified, isLockedByCurrentUser } = checkIfLockedOrModified(state, record);
					const isEditable = isEditActionAvailable({
						record,
						models: getCachedModels(),
						contentItemsByPath: getCachedContentItems(),
						parentModelId: getParentModelId(record.modelId, getCachedModels(), modelHierarchyMap)
					});
					if (
						isExternallyModified ||
						// Selecting a page/component still has some value even if it's locked
						// to access certain available actions or the item menu. For fields, no
						// action can be performed so won't allow selection, except for the case where
						// the lock owner is the current user. In those cases, allow for fields so user can unlock.
						(isLocked && !isLockedByCurrentUser && getById(record.iceIds[0]).recordType === 'field') ||
						!isEditable
					) {
						return NEVER;
					} else if (
						state.highlightMode === HighlightMode.ALL &&
						(state.status === EditingStatus.LISTENING || actionType === 'triggered_click')
					) {
						let selected = {
							modelId: null,
							fieldId: [],
							index: null,
							coordinates: { x: event.clientX, y: event.clientY }
						};
						if (getById(record.iceIds[0]).recordType === 'node-selector-item') {
							// When selecting the item on a node-selector the desired edit will be the item itself.
							// The following will send the component model id instead of the item model id
							selected.modelId = extractCollectionItem(getCachedModel(record.modelId), record.fieldId[0], record.index);
						} else {
							selected.modelId = record.modelId;
							selected.index = record.index;
							selected.fieldId = record.fieldId;
						}
						const { field } = iceRegistry.getReferentialEntries(record.iceIds[0]);
						const validations = field?.validations;
						const type = field?.type;
						if (
							// If it is locked, want the flow to go through the `else` statement even for these types of field — so people can unlock if they are the owner.
							!isLocked &&
							// FE2 TODO: types changed to be what they are on xml. Test/review thoroughly.
							// ['html', 'text', 'textarea'].includes(type)
							['rte', 'input', 'textarea'].includes(type)
						) {
							if (!window.tinymce) {
								alert(
									'Looks like tinymce is not added on the page. ' +
										'Please add tinymce on to the page to enable editing.'
								);
							} else if (not(validations?.readOnly?.value)) {
								const setupId = (field.properties?.rteConfiguration?.value as string) ?? 'generic';
								const setup = state.rteConfig[setupId] ?? Object.values(state.rteConfig)[0] ?? {};
								// Only pass rte setup to html type, text/textarea (plaintext) controls won't show full rich-text-editing.

								const models = getCachedModels();
								const modelId = action.payload.record.modelId;
								const parentModelId = getParentModelId(modelId, models, modelHierarchyMap);
								const path = models[parentModelId ?? modelId].craftercms.path;
								const cachedContentItem = getCachedContentItem(path);

								const pathToLock = isInheritedField(modelId, field.id)
									? models[getModelIdFromInheritedField(modelId, field.id)].craftercms.path
									: path;

								// FE2 TODO:
								// return beforeWrite$({
								//   path: pathToLock,
								//   site: state.activeSite,
								//   username: state.username,
								//   localItem: cachedContentItem
								// }).pipe(switchMap(() => initTinyMCE(pathToLock, record, validations, type === 'html' ? setup : {})));
								return beforeWrite$({
									path: pathToLock,
									site: state.activeSite,
									username: state.username,
									localItem: cachedContentItem
								}).pipe(
									switchMap(() =>
										initTinyMCE(
											pathToLock,
											record,
											validations,
											// FE2 TODO: Changed the mapping of rte to html, this probably breaks now. Test/review thoroughly.
											// type === 'html' ? setup : {}
											type === 'rte' ? setup : {}
										)
									)
								);
							}
						} else {
							const sources: Observable<StandardAction>[] = [
								escape$.pipe(
									takeUntil(clearAndListen$),
									tap(() => post(clearSelectedZones.type)),
									map(() => startListening()),
									take(1)
								),
								of(setEditingStatus({ status: EditingStatus.FIELD_SELECTED }))
							];
							// Rapid clicking (double-clicking) outside an RTE will cause the normal
							// FIELD_SELECTED status but without a previous mouseover setting the highlight.
							if (Object.values(state.highlighted).length === 0) {
								sources.unshift(of({ type: 'mouseover', payload: { record, event } }));
							}
							return merge(...sources);
						}
					} else if (state.highlightMode === HighlightMode.MOVE_TARGETS && state.status === EditingStatus.LISTENING) {
						const movableRecordId = iceRegistry.getMovableParentRecord(record.iceIds[0]);
						if (notNullOrUndefined(movableRecordId)) {
							// Inform host of the field selection
							// post();
							// By this point element is already highlighted. We just need to freeze
							// and change mode to reveal the move/sort options.
							return merge(
								escape$.pipe(
									takeUntil(clearAndListen$),
									// TODO: stop & map to startListening when any pivoting action occurs
									// takeUntil(action$.pipe(ofType(componentInstanceDragStarted.type))),
									tap(() => post(clearSelectedZones.type)),
									map(() => startListening()),
									take(1)
								),
								of(setEditingStatus({ status: EditingStatus.FIELD_SELECTED }))
							);
						}
					} else if (
						state.status === EditingStatus.FIELD_SELECTED &&
						state.highlightMode === HighlightMode.MOVE_TARGETS
					) {
						const movableRecordId = iceRegistry.getMovableParentRecord(record.iceIds[0]);
						if (state.highlighted[movableRecordId] === void 0) {
							post(clearSelectedZones.type);
							return of(startListening());
						}
					}
					// Note: Returning NEVER will unsubscribe from any previous stream returned on a prior click.
					return NEVER;
				}
			)
		),
	// endregion
	// region computedDragEnd
	(action$: MouseEventActionObservable) =>
		action$.pipe(
			ofType(computedDragEnd.type),
			tap(() => {
				document.documentElement.classList.remove(dragAndDropActiveClass);
				destroyDragSubjects();
			}),
			ignoreElements()
		),
	// endregion
	// region desktopAssetUploadComplete
	(action$: Observable<GuestStandardAction<{ path: string; record: ElementRecord }>>) => {
		return action$.pipe(
			ofType(desktopAssetUploadComplete.type),
			tap((action) => {
				const { record, path } = action.payload;
				contentController.updateField(record.modelId, record.fieldId[0], record.index, path);
			}),
			ignoreElements()
		);
	},
	// endregion
	// region contentTypeDropTargetsRequest
	(action$: Observable<GuestStandardAction<{ contentTypeId: string }>>, state$) => {
		return action$.pipe(
			ofType(contentTypeDropTargetsRequest.type),
			withLatestFrom(state$),
			tap(([action, state]) => {
				const { contentTypeId } = action.payload;
				const dropTargets = Object.values(state.highlighted).map(({ id, label }) => {
					const item = iceRegistry.getById(ElementRegistry.get(id).iceIds[0]);
					return {
						modelId: item.modelId,
						fieldId: item.fieldId,
						label,
						id: item.id,
						contentTypeId
					};
				});
				post(contentTypeDropTargetsResponse({ contentTypeId, dropTargets }));
			}),
			ignoreElements()
		);
	},
	// endregion
	// region startListening
	(action$: MouseEventActionObservable) => {
		return action$.pipe(
			ofType(startListening.type),
			tap(() => post(clearSelectedZones.type)),
			ignoreElements()
		);
	},
	// endregion
	// region trashed
	(action$: Observable<GuestStandardAction<{ iceId: number }>>, state$) => {
		// onDrop doesn't execute when trashing on host side
		// Consider behaviour when running Host Guest-side
		return action$.pipe(
			ofType(trashed.type),
			withLatestFrom(state$),
			switchMap(([action, state]) => {
				const { iceId } = action.payload;
				let { modelId, fieldId, index } = iceRegistry.getById(iceId);
				const models = getCachedModels();
				let parentModelId = getParentModelId(modelId, models, modelHierarchyMap);
				const { username, activeSite } = state;
				({ modelId, parentModelId } = getInheritanceParentIdsForField(
					fieldId,
					models,
					modelId,
					parentModelId,
					getCachedModelsByPath(),
					modelHierarchyMap
				));
				const pathToLock = models[parentModelId ? parentModelId : modelId].craftercms.path;
				return beforeWrite$({
					path: pathToLock,
					site: activeSite,
					username,
					localItem: getCachedContentItem(pathToLock)
				}).pipe(
					switchMap(() => {
						contentController.deleteItem(modelId, fieldId, index);
						post(instanceDragEnded());
						// There's a raise condition where sometimes the dragend is
						// fired and sometimes is not upon dropping on the rubbish bin.
						// Manually firing here may incur in double firing of computed_dragend
						// in those occasions.
						return of(computedDragEnd());
					})
				);
			})
		);
	},
	// endregion
	// region dropzoneEnter
	(action$: Observable<GuestStandardAction<{ elementRecordId: number }>>, state$) => {
		// onDrop doesn't execute when trashing on host side
		// Consider behaviour when running Host Guest-side
		return action$.pipe(
			ofType(dropzoneEnter.type),
			withLatestFrom(state$),
			tap(([action, state]) => {
				const { elementRecordId } = action.payload;
				const { validations } = state.dragContext.dropZones.find(
					(dropZone) => dropZone.elementRecordId === elementRecordId
				);
				Object.values(validations).forEach((validation) => {
					post(snackGuestMessage(validation));
				});
			}),
			ignoreElements()
		);
	},
	// endregion
	// region dropzoneLeave
	(action$: Observable<GuestStandardAction<{ elementRecordId: number }>>, state$) => {
		return action$.pipe(
			ofType(dropzoneLeave.type),
			withLatestFrom(state$),
			tap(([action, state]) => {
				if (!state.dragContext) {
					return;
				}
				const { elementRecordId } = action.payload;
				const { validations } = state.dragContext.dropZones.find(
					(dropZone) => dropZone.elementRecordId === elementRecordId
				);
				if (validations.minCount) {
					post({ type: instanceDragEnded.type });
				}
				Object.values(validations).forEach((validation) => {
					// We dont want to show a validation message for maxCount on Leaving Dropzone
					if (validations.maxCount) {
						return;
					}
					post(snackGuestMessage(validation));
				});
			}),
			ignoreElements()
		);
	},
	// endregion
	// region componentDragStarted
	(action$: MouseEventActionObservable, state$) =>
		action$.pipe(
			ofType(componentDragStarted.type),
			withLatestFrom(state$),
			switchMap(([, state]) => {
				const contentType = state.dragContext.contentType;
				if (nullOrUndefined(contentType.id)) {
					console.error('No contentTypeId found for this drag instance.');
				} else {
					if (state.dragContext.dropZones.length === 0) {
						post(
							snackGuestMessage({
								id: 'dropTargetsNotFound',
								level: 'info',
								values: { contentType: state.dragContext.contentType.name }
							})
						);
					} else {
						document.documentElement.classList.add(dragAndDropActiveClass);
						return initializeDragSubjects(state$);
					}
				}
				return NEVER;
			})
		),
	// endregion
	// region componentInstanceDragStarted
	(action$: MouseEventActionObservable, state$, { getIntl }) => {
		return action$.pipe(
			ofType(componentInstanceDragStarted.type),
			withLatestFrom(state$),
			switchMap(([, state]) => {
				if (nullOrUndefined(state.dragContext.instance.craftercms.contentTypeId)) {
					console.error('No contentTypeId found for this drag instance.');
				} else {
					if (state.dragContext.dropZones.length === 0) {
						if (state.dragContext.isInstanceDuplicateInZone) {
							post(
								snackGuestMessage({
									message: getIntl().formatMessage({
										id: 'instanceDragStarted.duplicateItem',
										defaultMessage: 'Drop targets do not allow duplicate items.'
									}),
									level: 'info'
								})
							);
						} else {
							post(
								snackGuestMessage({
									id: 'dropTargetsNotFound',
									level: 'info',
									values: { contentType: state.dragContext.contentType.name }
								})
							);
						}
					} else {
						document.documentElement.classList.add(dragAndDropActiveClass);
						return initializeDragSubjects(state$);
					}
				}
				return NEVER;
			})
		);
	},
	// endregion
	// region assetDragStarted
	(action$: MouseEventActionObservable, state$) => {
		return action$.pipe(
			ofType(assetDragStarted.type),
			withLatestFrom(state$),
			switchMap(([, state]) => {
				if (nullOrUndefined((state.dragContext.dragged as SearchItem).path)) {
					console.error('No path found for this drag asset.');
					return NEVER;
				}
				return initializeDragSubjects(state$);
			})
		);
	},
	// endregion
	// region desktopAssetDragStarted
	(action$: MouseEventActionObservable, state$) => {
		return action$.pipe(
			ofType(desktopAssetDragStarted.type),
			withLatestFrom(state$),
			switchMap(([, state]) => {
				if (nullOrUndefined(state.dragContext.dragged)) {
					console.error('No file found for this drag asset.');
				} else {
					return initializeDragSubjects(state$);
				}
				return NEVER;
			})
		);
	},
	// endregion
	// region contentTreeFieldSelected
	(action$: Observable<GuestStandardAction<{ iceProps: ICEProps; scrollElement: string; name: string }>>) => {
		return action$.pipe(
			ofType(contentTreeFieldSelected.type),
			switchMap((action) => {
				const { iceProps, scrollElement, name } = action.payload;
				const element = getElementFromICEProps(iceProps.modelId, iceProps.fieldId, iceProps.index);
				if (scrollToElement(element, scrollElement)) {
					return escape$.pipe(
						takeUntil(clearAndListen$),
						map(() => clearContentTreeFieldSelected()),
						take(1)
					);
				} else {
					post(
						snackGuestMessage({
							id: 'registerNotFound',
							level: 'suggestion',
							values: { name }
						})
					);
					return NEVER;
				}
			})
		);
	},
	// endregion
	// region contentTreeSwitchFieldInstance
	(action$: Observable<GuestStandardAction<{ type: string; scrollElement: string }>>, state$) => {
		return action$.pipe(
			ofType(contentTreeSwitchFieldInstance.type),
			withLatestFrom(state$),
			tap(([action, state]) => {
				const { scrollElement } = action.payload;
				let registryEntryId = state.fieldSwitcher.registryEntryIds[state.fieldSwitcher.currentElement];
				scrollToElement(get(registryEntryId).element, scrollElement);
			}),
			ignoreElements()
		);
	},
	// endregion
	// region exitComponentInlineEdit
	(action$: Observable<GuestStandardAction<{ path: string; saved: boolean }>>) => {
		return action$.pipe(
			ofType(exitComponentInlineEdit.type),
			tap((action) => {
				const { path, saved } = action.payload;
				// When the content is saved, the api1/write-content api unlocks
				!saved && path && post(unlockItem({ path }));
			}),
			ignoreElements()
		);
	}
	// endregion
);

const moveComponent = (dragContext) => {
	let { dragged, dropZone, dropZones } = dragContext;
	let originDropZone = dropZones.find((dropZone) => dropZone.origin);
	const containerRecord = iceRegistry.getById(originDropZone.iceId);
	// Determine whether the component is being sorted or moved.
	const { movedToSameZone, movedToSamePosition, draggedElementIndex, targetIndex } = getMoveComponentInfo(dragContext);
	if (movedToSameZone) {
		if (!movedToSamePosition) {
			setTimeout(() => {
				contentController.sortItem(
					containerRecord.modelId,
					containerRecord.fieldId,
					containerRecord.fieldId.includes('.')
						? `${containerRecord.index}.${draggedElementIndex}`
						: draggedElementIndex,
					containerRecord.fieldId.includes('.') ? `${containerRecord.index}.${targetIndex}` : targetIndex
				);
			});
		} else {
			// if draggedElementIndex equals targetIndex it means that item wasn't moved, but it was locked, so it needs
			// to be unlocked.
			const models = contentController.getCachedModels();
			const id = dragged.modelId;
			const path = models[id].craftercms.path;
			post(unlockItem({ path }));
		}
	} else {
		// Different drop zone: Move identified

		const rec = iceRegistry.getById(dropZone.iceId);
		// Chrome didn't trigger the dragend event
		// without the set timeout.
		setTimeout(() => {
			contentController.moveItem(
				containerRecord.modelId,
				containerRecord.fieldId,
				containerRecord.fieldId.includes('.') ? `${containerRecord.index}.${draggedElementIndex}` : draggedElementIndex,
				rec.modelId,
				rec.fieldId,
				rec.fieldId.includes('.') ? `${rec.index}.${targetIndex}` : targetIndex
			);
		}, 20);
	}
};

export default epic;
