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

import { createAction } from '@reduxjs/toolkit';
import { ElementRecord } from '../../models/InContextEditing';
import { EditingStatus } from '../../constants';
import { ContentItem } from '@craftercms/studio-ui/models';

export const contentReady = /*#__PURE__*/ createAction('content_ready');
export const setDropPosition = /*#__PURE__*/ createAction<{ targetIndex: number }>('set_drop_position');
export const addAssetTypes = /*#__PURE__*/ createAction('add_asset_types');
export const moveComponent = /*#__PURE__*/ createAction('move_component');
export const insertComponent = /*#__PURE__*/ createAction('insert_component');
export const insertInstance = /*#__PURE__*/ createAction('insert_instance');
export const computedDragEnd = /*#__PURE__*/ createAction('computed_dragend');
export const computedDragOver = /*#__PURE__*/ createAction<{ record: ElementRecord; event }>('computed_dragover');
export const iceZoneSelected = /*#__PURE__*/ createAction<{ record: ElementRecord; event }>('ice_zone_selected');
export const zoneHoveredViaKeyboard = /*#__PURE__*/ createAction<{ record: ElementRecord }>(
	'zone_hovered_via_keyboard'
);
export const zoneHoverClearedViaKeyboard = /*#__PURE__*/ createAction('zone_hover_cleared_via_keyboard');
export const zoneSelectedViaKeyboard = /*#__PURE__*/ createAction<{ record: ElementRecord }>(
	'zone_selected_via_keyboard'
);
export const editComponentInline = /*#__PURE__*/ createAction('edit_component_inline');
export const exitComponentInlineEdit = /*#__PURE__*/ createAction<{ path: string; saved: boolean }>(
	'exit_component_inline_edit'
);
export const setEditMode = /*#__PURE__*/ createAction('set_edit_mode');
export const startListening = /*#__PURE__*/ createAction('start_listening');
export const scrolling = /*#__PURE__*/ createAction('scrolling');
export const scrollingStopped = /*#__PURE__*/ createAction('scrolling_stopped');
export const dropzoneEnter = /*#__PURE__*/ createAction<{ elementRecordId: number }>('drop_zone_enter');
export const dropzoneLeave = /*#__PURE__*/ createAction<{ elementRecordId: number }>('drop_zone_leave');
export const documentDragOver = /*#__PURE__*/ createAction<{ event: Event }>('document:dragover');
export const documentDragLeave = /*#__PURE__*/ createAction<{ event: Event }>('document:dragleave');
export const documentDrop = /*#__PURE__*/ createAction<{ event: Event }>('document:drop');
export const documentDragEnd = /*#__PURE__*/ createAction<{ event: Event }>('document:dragend');
export const desktopAssetDragStarted = /*#__PURE__*/ createAction<{ asset: DataTransferItem }>(
	'desktop_asset_drag_started'
);
export const desktopAssetDragEnded = /*#__PURE__*/ createAction('desktop_asset_drag_ended');
export const setEditingStatus = /*#__PURE__*/ createAction<{ status: EditingStatus }>('set_editing_status');
export const desktopAssetUploadComplete = /*#__PURE__*/ createAction<{ record: ElementRecord; path: string }>(
	'DESKTOP_ASSET_UPLOAD_COMPLETE'
);
export const desktopAssetUploadProgress = /*#__PURE__*/ createAction<{ record: ElementRecord; percentage: number }>(
	'DESKTOP_ASSET_UPLOAD_PROGRESS'
);
export const desktopAssetUploadStarted = /*#__PURE__*/ createAction<{ record: ElementRecord }>(
	'DESKTOP_ASSET_UPLOAD_STARTED'
);
export const desktopAssetUploadFailed = /*#__PURE__*/ createAction<{ record: ElementRecord }>(
	'DESKTOP_ASSET_UPLOAD_FAILED'
);

export const setLockedItems = /*#__PURE__*/ createAction<ContentItem[]>('set_locked_items');
