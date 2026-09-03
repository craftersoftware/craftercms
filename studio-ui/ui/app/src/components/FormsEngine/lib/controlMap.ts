/*
 * Copyright (C) 2007-2025 Crafter Software Corporation. All Rights Reserved.
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

import { ElementType, lazy } from 'react';

// FE2 TODO: See `typeMap` at services/contentTypes.ts
// | 'image'
// | 'text'
export type BuiltInControlType =
	| 'auto-filename'
	| 'aws-file-upload'
	| 'checkbox'
	| 'checkbox-group'
	| 'date-time'
	| 'disabled'
	| 'dropdown'
	| 'file-name'
	| 'forcehttps'
	| 'image-picker'
	| 'input'
	| 'internal-name'
	| 'label'
	| 'locale-selector'
	| 'node-selector'
	| 'numeric-input'
	| 'page-nav-order'
	| 'repeat'
	| 'rte'
	| 'textarea'
	| 'time'
	| 'transcoded-video-picker'
	| 'uuid' // TODO: Not in BPs, seems not to be in use
	| 'video-picker'
	| 'colorPicker'
	| 'expired-date'
	| 'input-email'
	| 'input-link'
	| 'input-phone';

export const controlMap: Record<BuiltInControlType, ElementType> = {
	'auto-filename': lazy(() => import('../controls/AutoFileName')),
	'aws-file-upload': lazy(() => import('../controls/AWSFileUpload')),
	checkbox: lazy(() => import('../controls/Checkbox')),
	'checkbox-group': lazy(() => import('../controls/CheckboxGroup')),
	'date-time': lazy(() => import('../controls/DateTime')),
	disabled: null,
	dropdown: lazy(() => import('../controls/Dropdown')),
	'file-name': lazy(() => import('../controls/./FileName')),
	forcehttps: lazy(() => import('../controls/Checkbox')),
	'image-picker': lazy(() => import('../controls/ImagePicker')),
	input: lazy(() => import('../controls/Text')),
	'internal-name': null,
	label: lazy(() => import('../controls/Label')),
	'locale-selector': lazy(() => import('../controls/LocaleSelector')),
	'node-selector': lazy(() => import('../controls/NodeSelector')),
	'numeric-input': lazy(() => import('../controls/Numeric')),
	'page-nav-order': lazy(() => import('../controls/PageNavOrder')),
	repeat: lazy(() => import('../controls/Repeat')),
	rte: lazy(() => import('../controls/RichTextEditor')),
	textarea: lazy(() => import('../controls/Textarea')),
	time: lazy(() => import('../controls/Time')),
	'transcoded-video-picker': lazy(() => import('../controls/TranscodedVideoPicker')),
	uuid: lazy(() => import('../controls/Uuid')),
	'video-picker': lazy(() => import('../controls/VideoPicker')),
	colorPicker: lazy(() => import('../controls/ColorPicker')),
	'expired-date': lazy(() => import('../controls/DateTime')),
	'input-email': lazy(() => import('../controls/Text')),
	'input-link': lazy(() => import('../controls/Text')),
	'input-phone': lazy(() => import('../controls/Text'))
};
