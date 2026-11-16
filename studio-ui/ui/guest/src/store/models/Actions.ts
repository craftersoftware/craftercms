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

import { GuestStandardAction } from './GuestStandardAction';
import { SyntheticEvent } from 'react';
import { ElementRecord } from '../../models/InContextEditing';
import GuestReducer from './GuestReducer';
import {
	assetDragEnded,
	assetDragStarted,
	clearContentTreeFieldSelected,
	clearHighlightedDropTargets,
	componentDragEnded,
	componentDragStarted,
	componentInstanceDragEnded,
	componentInstanceDragStarted,
	contentTreeFieldSelected,
	contentTreeSwitchFieldInstance,
	contentTypeDropTargetsRequest,
	highlightModeChanged,
	hostCheckIn,
	setPreviewEditMode,
	trashed,
	updateRteConfig
} from '@craftercms/studio-ui/state/actions/preview';
import { Observable } from 'rxjs';
import {
	addAssetTypes,
	computedDragEnd,
	computedDragOver,
	contentReady,
	desktopAssetDragEnded,
	desktopAssetDragStarted,
	documentDragEnd,
	documentDragLeave,
	documentDragOver,
	documentDrop,
	dropzoneEnter,
	dropzoneLeave,
	editComponentInline,
	exitComponentInlineEdit,
	iceZoneSelected,
	insertComponent,
	zoneHoverClearedViaKeyboard,
	zoneHoveredViaKeyboard,
	zoneSelectedViaKeyboard,
	insertInstance,
	moveComponent,
	scrolling,
	scrollingStopped,
	setDropPosition,
	setEditMode,
	startListening,
	desktopAssetUploadComplete,
	desktopAssetUploadProgress,
	desktopAssetUploadStarted
} from '../actions';

export type GuestActionTypes =
	// dom events
	| 'mouseover'
	| 'mouseleave'
	| 'dragstart'
	| 'dragover'
	| 'dragleave'
	| 'drop'
	| 'dragend'
	| 'click'
	| 'dblclick'
	// other
	| typeof setDropPosition.type
	| typeof addAssetTypes.type
	| typeof moveComponent.type
	| typeof insertComponent.type
	| typeof insertInstance.type
	| typeof computedDragEnd.type
	| typeof computedDragOver.type
	| typeof iceZoneSelected.type
	| typeof zoneHoveredViaKeyboard.type
	| typeof zoneHoverClearedViaKeyboard.type
	| typeof zoneSelectedViaKeyboard.type
	| typeof editComponentInline.type
	| typeof exitComponentInlineEdit.type
	| typeof setEditMode.type
	| typeof startListening.type
	| typeof scrolling.type
	| typeof scrollingStopped.type
	| typeof dropzoneEnter.type
	| typeof dropzoneLeave.type
	| typeof componentDragStarted.type
	| typeof componentDragEnded.type
	| typeof componentInstanceDragStarted.type
	| typeof componentInstanceDragEnded.type
	| typeof desktopAssetDragStarted.type
	| typeof desktopAssetUploadStarted.type
	| typeof desktopAssetUploadProgress.type
	| typeof desktopAssetUploadComplete.type
	| typeof desktopAssetDragEnded.type
	| typeof assetDragStarted.type
	| typeof assetDragEnded.type
	| typeof trashed.type
	| typeof setPreviewEditMode.type
	| typeof highlightModeChanged.type
	| typeof clearHighlightedDropTargets.type
	| typeof contentTypeDropTargetsRequest.type
	| typeof hostCheckIn.type
	| typeof contentTreeFieldSelected.type
	| typeof clearContentTreeFieldSelected.type
	| typeof contentTreeSwitchFieldInstance.type
	| typeof updateRteConfig.type
	| typeof documentDragOver.type
	| typeof documentDragLeave.type
	| typeof documentDrop.type
	| typeof documentDragEnd.type
	| typeof contentReady.type;

export type MouseEventAction = GuestStandardAction<{
	event: SyntheticEvent<Element, MouseEvent> | MouseEvent;
	record: ElementRecord;
}>;

export type WithRecordAction = GuestReducer<{
	record: ElementRecord;
}>;

export type MouseEventActionObservable = Observable<GuestStandardAction>;
