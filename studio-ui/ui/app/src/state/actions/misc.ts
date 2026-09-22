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
import StandardAction from '../../models/StandardAction';

// region Batch Actions
export const batchActions = /*#__PURE__*/ createAction<StandardAction[]>('BATCH_ACTIONS');
// endregion

// region dispatch DOM Event
export const dispatchDOMEvent = /*#__PURE__*/ createAction<{ id: string } & { [key: string | number]: any }>(
	'DISPATCH_DOM_EVENT'
);
// endregion

// region TemplateActions

export const changeContentType = /*#__PURE__*/ createAction<{
	originalContentTypeId: string;
	path: string;
	newContentTypeId: string;
}>('CHANGE_CONTENT_TYPE');

export const editContentTypeTemplate = /*#__PURE__*/ createAction<{
	contentTypeId: string;
	createBeforeOpen?: boolean;
	onSaveSuccess?: () => void;
}>('EDIT_CONTENT_TYPE_TEMPLATE');

export interface EditFilePayload {
	path: string;
	fileName: string;
	mode: string;
	contentType?: string;
	// The `openOnSuccess` really belongs to CreateFileDialog onCreated (success)
	// payload; it's added here to integrate with it
	openOnSuccess?: boolean;
	/** When true and the file is missing, create (and associate templates) before opening the editor. Default: defer until Save. */
	createBeforeOpen?: boolean;
	/** Called after a successful CodeEditor save (e.g. Type Builder association). */
	onSaveSuccess?: () => void;
}

export const editTemplate = /*#__PURE__*/ createAction<EditFilePayload>('EDIT_TEMPLATE');

export const editController = /*#__PURE__*/ createAction<EditFilePayload>('EDIT_CONTROLLER');

export const createFile = /*#__PURE__*/ createAction<{ path: string; fileName: string; onCreated: StandardAction }>(
	'CREATE_FILE'
);

// endregion
