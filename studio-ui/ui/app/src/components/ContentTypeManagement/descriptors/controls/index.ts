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

import type { BuiltInControlType } from '../../../FormsEngine/lib/controlMap';
import { DescriptorContentType } from '../../utils';
import fileNameDescriptor from './fileName';
import inputDescriptor from './input';
import autoFileNameDescriptor from './autoFileName';
import awsFileUploadDescriptor from './awsFileUpload';
import checkboxDescriptor from './checkbox';
import checkboxGroupDescriptor from './checkboxGroup';
import dateTimeDescriptor from './dateTime';
import disabledDescriptor from './disabled';
import dropdownDescriptor from './dropdown';
import forceHttpsDescriptor from './forceHttps';
import imagePickerDescriptor from './imagePicker';
import internalNameDescriptor from './internalName';
import labelDescriptor from './label';
import localeSelectorDescriptor from './localeSelector';
import nodeSelectorDescriptor from './nodeSelector';
import numericInputDescriptor from './numericInput';
import pageNavOrderDescriptor from './pageNavOrder';
import repeatDescriptor from './repeat';
import rteDescriptor from './rte';
import textareaDescriptor from './textarea';
import timeDescriptor from './time';
import transcodedVideoPickerDescriptor from './transcodedVideoPicker';
import uuidDescriptor from './uuid';
import videoPickerDescriptor from './videoPicker';
import colorPickerDescriptor from './colorPicker';
import { defineMessage } from 'react-intl';
import expiredDateDescriptor from './expiredDate';
import inputEmailDescriptor from './inputEmail';
import inputLinkDescriptor from './inputLink';
import inputPhoneDescriptor from './linkPhone';

export const controlDescriptors: Record<BuiltInControlType, DescriptorContentType> = {
	'auto-filename': autoFileNameDescriptor,
	'aws-file-upload': awsFileUploadDescriptor,
	checkbox: checkboxDescriptor,
	'checkbox-group': checkboxGroupDescriptor,
	'date-time': dateTimeDescriptor,
	disabled: disabledDescriptor,
	dropdown: dropdownDescriptor,
	'file-name': fileNameDescriptor,
	forcehttps: forceHttpsDescriptor,
	'image-picker': imagePickerDescriptor,
	input: inputDescriptor,
	'internal-name': internalNameDescriptor,
	label: labelDescriptor,
	'locale-selector': localeSelectorDescriptor,
	'node-selector': nodeSelectorDescriptor,
	'numeric-input': numericInputDescriptor,
	'page-nav-order': pageNavOrderDescriptor,
	repeat: repeatDescriptor,
	rte: rteDescriptor,
	textarea: textareaDescriptor,
	time: timeDescriptor,
	'transcoded-video-picker': transcodedVideoPickerDescriptor,
	uuid: uuidDescriptor,
	'video-picker': videoPickerDescriptor,
	colorPicker: colorPickerDescriptor,
	'expired-date': expiredDateDescriptor,
	'input-email': inputEmailDescriptor,
	'input-link': inputLinkDescriptor,
	'input-phone': inputPhoneDescriptor
};

export default controlDescriptors;
