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

import {
	compileDropZone,
	fromICEId,
	getDragContextFromDropTargets,
	getDraggable,
	getHighlighted,
	getHoverData,
	getRecordsFromIceId,
	getSiblingRects
} from '../../elementRegistry';
import { checkIfLockedOrModified, dragOk } from '../util';
import {
	exists,
	findChildRecord,
	getById,
	getContentTypeDropTargets,
	getMediaDropTargets,
	getMovableParentRecord,
	getRecordDropTargets,
	getReferentialEntries,
	isMovable,
	runDropTargetsValidations,
	runValidation
} from '../../iceRegistry';
import { Reducer } from '@reduxjs/toolkit';
import { GuestStandardAction } from '../models/GuestStandardAction';
import { ElementRecord, ICERecord } from '../../models/InContextEditing';
import { GuestState } from '../models/GuestStore';
import { notNullOrUndefined, nullOrUndefined, reversePluckProps } from '@craftercms/studio-ui/utils/object';
import { updateDropZoneValidations } from '../../utils/dom';
import { EditingStatus, HighlightMode } from '../../constants';
import {
	assetDragStarted,
	clearContentTreeFieldSelected,
	clearHighlightedDropTargets,
	componentDragStarted,
	componentInstanceDragStarted,
	contentTreeFieldSelected,
	contentTreeSwitchFieldInstance,
	contentTypeDropTargetsRequest,
	fetchGuestModelComplete,
	highlightModeChanged,
	hostCheckIn,
	setEditModePadding,
	setPreviewEditMode,
	updateRteConfig
} from '@craftercms/studio-ui/state/actions/preview';
import {
	computedDragEnd,
	computedDragOver,
	desktopAssetDragStarted,
	desktopAssetUploadComplete,
	desktopAssetUploadFailed,
	desktopAssetUploadProgress,
	desktopAssetUploadStarted,
	dropzoneEnter,
	dropzoneLeave,
	editComponentInline,
	exitComponentInlineEdit,
	iceZoneSelected,
	scrolling,
	scrollingStopped,
	setDropPosition,
	setEditingStatus,
	setEditMode,
	setLockedItems,
	startListening
} from '../actions';
import { ModelHierarchyMap } from '@craftercms/studio-ui/utils/content';
import { contentEvent, lockContentEvent } from '@craftercms/studio-ui/state/actions/system';
import { NotFunction, ReducerWithInitialState } from '@reduxjs/toolkit/src/createReducer';
import StandardAction from '@craftercms/studio-ui/models/StandardAction';
import { getParentModelId } from '../../utils/ice';
import { getCachedModels, getCachedContentItems, modelHierarchyMap } from '../../contentController';
import { isEditActionAvailable } from '../../utils/util';
import type { BuiltInControlType } from '@craftercms/studio-ui/components/FormsEngine/lib/controlMap';
import { type ContentTypeFieldValidations } from '@craftercms/studio-ui/src/models/ContentType';
import { value, extractCollectionItem } from '@craftercms/studio-ui/utils/model';

type CaseReducer<S = GuestState, A extends GuestStandardAction = GuestStandardAction> = Reducer<S, A>;

type CaseReducers<S = GuestState, A extends GuestStandardAction = GuestStandardAction> = Record<
	string,
	CaseReducer<S, A>
>;

const initialState: GuestState = {
	dragContext: null,
	draggable: {},
	editable: {},
	highlighted: {},
	status: EditingStatus.LISTENING,
	editMode: false,
	highlightMode: HighlightMode.ALL,
	authoringBase: null,
	uploading: {},
	// models: {},
	// itemsByPath: {},
	lockedPaths: {},
	externallyModifiedPaths: {},
	contentTypes: {},
	hostCheckedIn: false,
	rteConfig: {},
	activeSite: '',
	editModePadding: false,
	username: null
};

function createReducer<S extends NotFunction<any>, CR extends CaseReducers<S, any> = CaseReducers<S, any>>(
	initialState: S,
	actionsMap: CR
): ReducerWithInitialState<S> {
	const reducer = (state = initialState, action) => {
		const caseReducer = actionsMap[action.type];
		return caseReducer?.(state, action) ?? state;
	};
	reducer.getInitialState = () => initialState;
	return reducer;
}

const resetState: (state: GuestState) => GuestState = (state: GuestState) => ({
	...state,
	status: EditingStatus.LISTENING,
	draggable: {},
	highlighted: {},
	dragContext: null
});

// Reducers for `desktopAssetDragStarted` & `assetDragStarted` are nearly identical. Refactored as one here.
const reducerForAssetDragStarted: CaseReducer<
	GuestState,
	GuestStandardAction<
		ReturnType<typeof desktopAssetDragStarted>['payload'] | ReturnType<typeof assetDragStarted>['payload']
	>
> = (state, action) => {
	const { asset } = action.payload;
	if (nullOrUndefined(asset)) {
		return state;
	}
	let type: BuiltInControlType;
	const isFromDesktop = action.type === desktopAssetDragStarted.type;
	const property: 'type' | 'mimeType' = isFromDesktop ? 'type' : 'mimeType';
	if (asset[property].includes('image/')) {
		type = 'image-picker';
	} else if (asset[property].includes('video/')) {
		type = 'video-picker';
	}
	const dropTargets = getMediaDropTargets(type).filter((record) => {
		if (
			!isEditActionAvailable({
				record,
				models: getCachedModels(),
				contentItemsByPath: getCachedContentItems(),
				parentModelId: getParentModelId(record.modelId, getCachedModels(), modelHierarchyMap)
			})
		) {
			return false;
		}
		let { field: { validations = [] } = {} } = getReferentialEntries(record);
		return Boolean(
			isFromDesktop
				? validations['allowImageUpload'] || validations['allowVideoUpload']
				: validations['allowImagesFromRepo'] || validations['allowVideosFromRepo']
		);
	});
	const { players, containers, dropZones } = getDragContextFromDropTargets(dropTargets);
	const highlighted = getHighlighted(dropZones);
	return {
		...state,
		highlighted,
		status: isFromDesktop ? EditingStatus.UPLOAD_ASSET_FROM_DESKTOP : EditingStatus.PLACING_DETACHED_ASSET,
		dragContext: {
			players,
			siblings: [],
			dropZones,
			containers,
			inZone: false,
			targetIndex: null,
			dragged: asset
		}
	};
};

// TODO: Must figure out why these case reducers don't seem to have the Proxy object.
//  Return statements and not mutating the state object is necessary.
//  Is it because createReducer from redux-toolkit is not used?

const reducer = createReducer(initialState, {
	// region dblclick
	dblclick: (state, { payload: { record } }) =>
		state.status === EditingStatus.LISTENING
			? {
					...state,
					status: EditingStatus.EDITING_COMPONENT_INLINE,
					editable: {
						[record.id]: record
					}
				}
			: state,
	// endregion
	// region mouseover
	// TODO: Not pure.
	mouseover: (state, action) => {
		const { record } = action.payload as { record: ElementRecord };
		if (state.status === EditingStatus.LISTENING) {
			const { highlightMode } = state;
			const iceId = record.iceIds[0];
			const movableRecordId = getMovableParentRecord(iceId, record.element);
			if (highlightMode === HighlightMode.ALL) {
				const highlight = getHoverData(record.id);
				if (notNullOrUndefined(movableRecordId)) {
					const elementId = iceId === movableRecordId ? record.id : fromICEId(movableRecordId).id;
					const draggable = getDraggable(elementId);
					return {
						...state,
						highlighted: { [record.id]: highlight },
						draggable: draggable ? { [elementId]: draggable } : state.draggable
					};
				}
				return { ...state, highlighted: { [record.id]: highlight } };
			} else if (highlightMode === HighlightMode.MOVE_TARGETS && notNullOrUndefined(movableRecordId)) {
				const elementId = iceId === movableRecordId ? record.id : fromICEId(movableRecordId).id;
				const draggable = getDraggable(elementId);
				const highlight = getHoverData(
					// If (iceId == movableRecordId) the current record is already
					// the one to show the highlight on.
					elementId
				);
				return {
					...state,
					highlighted: { [movableRecordId]: highlight },
					draggable: draggable ? { [elementId]: draggable } : state.draggable
				};
			}
		}
		return state;
	},
	// endregion
	// region mouseleave
	mouseleave: (state) =>
		state.status === EditingStatus.LISTENING
			? {
					...state,
					highlighted: {},
					draggable: {}
				}
			: state,
	// endregion
	// region dragstart
	// TODO: Not pure.
	dragstart: (state, action) => {
		const { record } = action.payload;
		// onMouseOver pre-populates the draggable record
		const iceId = state.draggable?.[record.id];
		const { isLocked, isExternallyModified } = checkIfLockedOrModified(state, record);
		// Items that browser make draggable by default (images, etc) may not have an ice id
		if (!isLocked && !isExternallyModified && notNullOrUndefined(iceId)) {
			const dropTargets = getRecordDropTargets(iceId);
			const validationsLookup = runDropTargetsValidations(dropTargets);
			const { players, siblings, containers, dropZones } = getDragContextFromDropTargets(
				dropTargets,
				validationsLookup,
				record
			);
			const highlighted = getHighlighted(dropZones);
			return {
				...state,
				highlighted,
				status: EditingStatus.SORTING_COMPONENT,
				dragContext: {
					players,
					siblings,
					dropZones,
					containers,
					inZone: false,
					targetIndex: null,
					dragged: getById(iceId)
				}
			};
		} else {
			return state;
		}
	},
	// endregion
	// region dragleave
	dragleave: (state, action) => {
		const leavingDropZone = !state.dragContext?.dropZone?.element.contains(action.payload.event.relatedTarget);
		return dragOk(state.status)
			? {
					...state,
					dragContext: {
						...state.dragContext,
						over: null,
						inZone: false,
						targetIndex: null,
						dropZone: leavingDropZone ? null : state.dragContext.dropZone
					}
				}
			: state;
	},
	// endregion
	// region computedDragOver
	// TODO: Not pure.
	[computedDragOver.type]: (state, action) => {
		if (state.dragContext.scrolling) {
			return state;
		} else {
			const dragContext = state.dragContext;
			const { record, event } = action.payload;
			const element = record.element;
			if (dragContext.players.includes(element)) {
				let { next, prev } =
					// No point finding siblings for the drop zone element
					dragContext.containers.includes(element) ? { next: null, prev: null } : getSiblingRects(record.id);
				return {
					...state,
					dragContext: {
						...dragContext,
						next,
						prev,
						inZone: true,
						over: record,
						coordinates: { x: event.clientX, y: event.clientY },
						dropZone: dragContext.dropZones.find((dz) => dz.element === element || dz.children.includes(element))
					}
				};
			} else {
				return state;
			}
		}
	},
	// endregion
	// region computedDragEnd
	[computedDragEnd.type]: (state) => ({
		...state,
		status: EditingStatus.LISTENING,
		dragContext: null,
		highlighted: {}
	}),
	// endregion
	// region setDropPosition
	[setDropPosition.type]: (state, { payload: { targetIndex } }) => ({
		...state,
		dragContext: {
			...state.dragContext,
			targetIndex
		}
	}),
	// endregion
	// region editComponentInline
	[editComponentInline.type]: (state) => ({
		...state,
		status: EditingStatus.EDITING_COMPONENT_INLINE,
		draggable: {},
		highlighted: {}
	}),
	// endregion
	// region exitComponentInlineEdit
	[exitComponentInlineEdit.type]: (state) => ({
		...state,
		status: EditingStatus.LISTENING,
		highlighted: {}
	}),
	// endregion
	// region iceZoneSelected
	// TODO: Not pure
	[iceZoneSelected.type]: (state, { payload: { record } }) => ({
		...state,
		status: EditingStatus.EDITING_COMPONENT,
		draggable: {},
		highlighted: { [record.id]: getHoverData(record.id) }
	}),
	// endregion
	// region startListening
	[startListening.type]: resetState,
	// endregion
	// region scrolling
	[scrolling.type]: (state) => ({
		...state,
		dragContext: {
			...state.dragContext,
			scrolling: true
		}
	}),
	// endregion
	// region scrollingStopped
	// TODO: Not pure
	[scrollingStopped.type]: (state) => ({
		...state,
		dragContext: {
			...state.dragContext,
			scrolling: false,
			dropZones: state.dragContext?.dropZones?.map((dropZone) => ({
				...dropZone,
				rect: dropZone.element.getBoundingClientRect(),
				childrenRects: dropZone.children.map((child) => child.getBoundingClientRect())
			}))
		}
	}),
	// endregion
	// region dropzoneEnter
	// TODO: Not pure
	[dropzoneEnter.type]: (state, action) => {
		const { elementRecordId } = action.payload;
		const { dropZones: currentDropZones } = state.dragContext;
		const currentDropZone = currentDropZones.find((dropZone) => dropZone.elementRecordId === elementRecordId);
		let length = currentDropZone.children.length;
		let invalidDrop = currentDropZone.origin ? false : state.dragContext.invalidDrop;
		let rest = reversePluckProps(currentDropZone.validations, 'maxCount', 'minCount');

		if (state.status === EditingStatus.SORTING_COMPONENT && currentDropZone.origin) {
			length = length - 1;
		}

		const maxCount = !currentDropZone.origin
			? runValidation(currentDropZone.iceId as number, 'maxCount', [length])
			: null;

		if (maxCount) {
			rest.maxCount = maxCount;
			invalidDrop = true;
		}

		const dropZones = updateDropZoneValidations(currentDropZone, currentDropZones, rest);

		const highlighted = getHighlighted(dropZones);

		return {
			...state,
			dragContext: {
				...state.dragContext,
				dropZones,
				invalidDrop
			},
			highlighted
		};
	},
	// endregion
	// region dropzoneLeave
	// TODO: Not pure
	[dropzoneLeave.type]: (state, action) => {
		const { elementRecordId } = action.payload;
		if (!state.dragContext) {
			return;
		}
		const { dropZones: currentDropZones } = state.dragContext;
		const currentDropZone = currentDropZones.find((dropZone) => dropZone.elementRecordId === elementRecordId);
		let length = currentDropZone.children.length;
		let invalidDrop = state.status === EditingStatus.SORTING_COMPONENT ? state.dragContext.invalidDrop : false;
		let rest = reversePluckProps(currentDropZone.validations, 'minCount');

		if (state.status === EditingStatus.SORTING_COMPONENT && currentDropZone.origin) {
			length = length - 1;
		}

		const minCount = runValidation(currentDropZone.iceId as number, 'minCount', [length]);

		if (minCount) {
			rest.minCount = minCount;
			invalidDrop = !!currentDropZone.origin;
		}

		const dropZones = updateDropZoneValidations(currentDropZone, currentDropZones, rest);
		const highlighted = getHighlighted(dropZones);

		return {
			...state,
			dragContext: {
				...state.dragContext,
				dropZones,
				invalidDrop
			},
			highlighted
		};
	},
	// endregion
	// region setEditMode
	[setEditMode.type]: (state, { payload }) => ({
		...state,
		highlighted: {},
		highlightMode: payload.highlightMode
	}),
	// endregion
	// region setPreviewEditMode
	[setPreviewEditMode.type]: (state, action) =>
		action.payload.editMode !== state.editMode
			? {
					...state,
					highlighted: {},
					editMode: action.payload.editMode
				}
			: state,
	// endregion
	// region highlightModeChanged
	[highlightModeChanged.type]: (state, { payload }) =>
		state.highlightMode !== payload.highlightMode
			? {
					...resetState(state),
					highlightMode: payload.highlightMode
				}
			: state,
	// endregion
	// region contentTypeDropTargetsRequest
	// TODO: Not pure
	[contentTypeDropTargetsRequest.type]: (state, action) => {
		const { contentTypeId } = action.payload;
		const highlighted = {};

		getContentTypeDropTargets(contentTypeId).forEach((item) => {
			let { elementRecordId } = compileDropZone(item.id);
			highlighted[elementRecordId] = getHoverData(elementRecordId);
		});

		return {
			...state,
			dragContext: {
				...state.dragContext,
				inZone: false
			},
			status: EditingStatus.SHOW_DROP_TARGETS,
			highlighted
		};
	},
	// endregion
	// region clearHighlightedDropTargets
	[clearHighlightedDropTargets.type]: (state) => ({
		...state,
		status: EditingStatus.LISTENING,
		highlighted: {}
	}),
	// endregion
	// region desktopAssetUploadStarted
	// TODO: Not pure
	[desktopAssetUploadStarted.type]: (state, { payload: { record } }) => ({
		...state,
		uploading: {
			...state.uploading,
			[record.id]: getHoverData(record.id)
		}
	}),
	// endregion
	// region desktopAssetUploadComplete
	// TODO: Carry or retrieve record for these events
	[desktopAssetUploadComplete.type]: (
		state,
		{ payload: { record } }: GuestStandardAction<{ record: ElementRecord }>
	) => ({
		...state,
		uploading: reversePluckProps(state.uploading, `${record.id}`)
	}),
	// region desktopAssetUploadFailed
	[desktopAssetUploadFailed.type]: (
		state,
		{ payload: { record } }: GuestStandardAction<{ record: ElementRecord }>
	) => ({
		...state,
		uploading: reversePluckProps(state.uploading, String(record.id))
	}),
	// endregion
	// endregion
	// region desktopAssetUploadProgress
	[desktopAssetUploadProgress.type]: (state, { payload: { percentage, record } }) => ({
		...state,
		uploading: {
			...state.uploading,
			[record.id]: {
				...state.uploading[record.id],
				progress: percentage
			}
		}
	}),
	// endregion
	// region componentDragStarted
	// TODO: Not pure.
	[componentDragStarted.type]: (state, action) => {
		const { contentType } = action.payload;
		if (nullOrUndefined(contentType)) {
			return state;
		}
		let dropTargets = getContentTypeDropTargets(contentType, undefined, ['embedded', 'shared']);
		const validationsLookup = runDropTargetsValidations(dropTargets);
		let { players, siblings, containers, dropZones } = getDragContextFromDropTargets(dropTargets, validationsLookup);
		// TODO: Does filtering drop zones only enough? Verify siblings, containers, etc. don't need to be filtered as well.
		dropZones = dropZones.filter((dz) => {
			const iceRecord = getById(dz.iceId);
			return isEditActionAvailable({
				record: iceRecord,
				models: getCachedModels(),
				contentItemsByPath: getCachedContentItems(),
				parentModelId: getParentModelId(iceRecord.modelId, getCachedModels(), modelHierarchyMap)
			});
		});
		const highlighted = getHighlighted(dropZones);
		return {
			...state,
			highlighted,
			status: EditingStatus.PLACING_NEW_COMPONENT,
			dragContext: {
				players,
				siblings,
				dropZones,
				containers,
				contentType,
				inZone: false,
				targetIndex: null,
				dragged: null
			}
		};
	},
	// endregion
	// region componentInstanceDragStarted
	// TODO: Not pure.
	[componentInstanceDragStarted.type]: (state, action) => {
		const { instance, contentType } = action.payload;
		if (nullOrUndefined(instance)) {
			return state;
		}
		const instanceId = instance.craftercms.id;
		let isInstanceDuplicateInZone = false;
		const dropTargets = getContentTypeDropTargets(
			instance.craftercms.contentTypeId,
			(record: ICERecord, hierarchyMap: ModelHierarchyMap) => {
				const { field: { validations = [] } = {}, model, fieldId, index } = getReferentialEntries(record);
				const allowDuplicates = (validations as ContentTypeFieldValidations)?.allowDuplicates?.value ?? false;
				const collection = nullOrUndefined(index)
					? value(model, fieldId)
					: extractCollectionItem(model, fieldId, index);
				const isComponentDuplicate = Array.isArray(collection) && collection.includes(instanceId);
				if (isComponentDuplicate) isInstanceDuplicateInZone = true;

				return (
					!isEditActionAvailable({
						record,
						models: getCachedModels(),
						contentItemsByPath: getCachedContentItems(),
						parentModelId: getParentModelId(record.modelId, getCachedModels(), modelHierarchyMap)
					}) ||
					(!allowDuplicates && isComponentDuplicate)
				);
			},
			// This action type ensures we're working with existing 'shared' components
			'sharedExisting'
		);
		const validationsLookup = runDropTargetsValidations(dropTargets);
		const { players, siblings, containers, dropZones } = getDragContextFromDropTargets(dropTargets, validationsLookup);

		const highlighted = getHighlighted(dropZones);

		return {
			...state,
			highlighted,
			status: EditingStatus.PLACING_DETACHED_COMPONENT,
			dragContext: {
				players,
				siblings,
				dropZones,
				containers,
				instance,
				contentType,
				inZone: false,
				targetIndex: null,
				dragged: null,
				isInstanceDuplicateInZone
			}
		};
	},
	// endregion
	// region desktopAssetDragStarted
	// TODO: Not pure
	[desktopAssetDragStarted.type]: reducerForAssetDragStarted,
	// endregion
	// region assetDragStarted
	// TODO: Not pure
	[assetDragStarted.type]: reducerForAssetDragStarted,
	// endregion
	// region selectField
	[setEditingStatus.type]: (state, { payload }) => ({
		...state,
		status: payload.status
	}),
	// endregion
	// region contentTreeFieldSelected
	// TODO: Not pure
	[contentTreeFieldSelected.type]: (state, action) => {
		const { iceProps } = action.payload;
		let iceId = exists(iceProps);
		if (iceId === null) {
			return state;
		}
		let iceRecord = getById(iceId);
		let registryEntries, highlight;

		if (iceRecord.recordType === 'component') {
			if (state.highlightMode === HighlightMode.MOVE_TARGETS) {
				// If in move mode, dynamically switch components to their movable item record so users can manipulate.
				const registryEntriesForIce = getRecordsFromIceId(iceId);
				const movableRecordId = getMovableParentRecord(iceId, registryEntriesForIce?.[0]?.element);
				iceId = notNullOrUndefined(movableRecordId) ? movableRecordId : iceId;
			}
		} else if (iceRecord.recordType === 'repeat-item' || iceRecord.recordType === 'node-selector-item') {
			if (state.highlightMode === HighlightMode.ALL) {
				// If in edit mode, switching to the component record, so people can edit the component.
				const componentRecord = findChildRecord(iceRecord.modelId, iceRecord.fieldId, iceRecord.index);
				iceId = notNullOrUndefined(componentRecord) ? componentRecord.id : iceId;
			}
		}

		registryEntries = getRecordsFromIceId(iceId);
		if (!registryEntries) {
			return state;
		}

		highlight = getHoverData(registryEntries[0].id);

		return {
			...state,
			status: EditingStatus.FIELD_SELECTED,
			draggable: isMovable(iceId) ? { [registryEntries[0].id]: iceId } : {},
			highlighted: { [registryEntries[0].id]: highlight },
			fieldSwitcher:
				registryEntries.length > 1
					? {
							iceId,
							currentElement: 0,
							registryEntryIds: registryEntries.map((entry) => entry.id)
						}
					: null
		};
	},
	// endregion
	// region contentTreeSwitchFieldInstance
	// TODO: Not pure
	[contentTreeSwitchFieldInstance.type]: (state, action) => {
		const { type } = action.payload;
		let nextElem = type === 'next' ? state.fieldSwitcher.currentElement + 1 : state.fieldSwitcher.currentElement - 1;
		let id = state.fieldSwitcher.registryEntryIds[nextElem];
		const highlight = getHoverData(state.fieldSwitcher.registryEntryIds[nextElem]);
		return {
			...state,
			draggable: isMovable(state.fieldSwitcher.iceId) ? { [id]: state.fieldSwitcher.iceId } : {},
			highlighted: { [id]: highlight },
			fieldSwitcher: {
				...state.fieldSwitcher,
				currentElement: nextElem
			}
		};
	},
	// endregion
	// region clearContentTreeFieldSelected
	[clearContentTreeFieldSelected.type]: (state) => ({
		...state,
		status: EditingStatus.LISTENING,
		draggable: {},
		highlighted: {},
		fieldSwitcher: null
	}),
	// endregion
	// region hostCheckIn
	[hostCheckIn.type]: (state, action) => ({
		...state,
		hostCheckedIn: true,
		authoringBase: action.payload.authoringBase,
		editModePadding: action.payload.editModePadding,
		highlightMode: action.payload.highlightMode,
		editMode: action.payload.editMode,
		rteConfig: action.payload.rteConfig,
		activeSite: action.payload.site,
		username: action.payload.username
	}),
	// endregion
	// region updateRteConfig
	[updateRteConfig.type]: (state, action) => ({
		...state,
		rteConfig: action.payload.rteConfig
	}),
	// endregion
	// region setEditModePadding
	[setEditModePadding.type]: (state, action) => ({
		...state,
		editModePadding: action.payload.editModePadding
	}),
	// endregion
	// region contentEvent
	[contentEvent.type]: (state, { payload }) => {
		if (state.username !== payload.user.username) {
			return {
				...state,
				externallyModifiedPaths: { ...state.externallyModifiedPaths, [payload.targetPath]: { user: payload.user } }
			};
		} else {
			return state;
		}
	},
	// endregion
	// region lockContentEvent
	[lockContentEvent.type]: (state, { payload }) => {
		const nextState = { ...state, lockedPaths: { ...state.lockedPaths } };
		if (payload.locked) {
			nextState.lockedPaths[payload.targetPath] = { user: payload.user };
		} else {
			delete nextState.lockedPaths[payload.targetPath];
		}
		return nextState;
	},
	// endregion
	// region setLockedItems
	[setLockedItems.type]: (state, { payload }) => {
		const lockedPaths = { ...state.lockedPaths };
		payload.forEach((item) => {
			lockedPaths[item.path] = { user: item.lockOwner };
		});
		return { ...state, lockedPaths };
	},
	// endregion
	// region fetchGuestModelComplete
	[fetchGuestModelComplete.type]: (
		state,
		{ payload }: StandardAction<ReturnType<typeof fetchGuestModelComplete>['payload']>
	) => {
		const lockedPaths = { ...state.lockedPaths };
		// const itemsByPath = { ...state.itemsByPath };
		payload.contentItems.forEach((item) => {
			if (item.stateMap.locked) {
				lockedPaths[item.path] = { user: item.lockOwner };
			}
			// itemsByPath[item.path] = item;
		});
		return { ...state, lockedPaths /* , itemsByPath */ };
	}
	// endregion
});

export default reducer;
