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

import { createLookupTable } from './object';
import ContentType, { ContentTypeField } from '../models/ContentType';
import Jabber from 'jabber';
import LookupTable from '../models/LookupTable';
import { generatePlaceholderImageDataUrl } from './content';
import { ensureSingleSlash, isEmpty, toColor } from './string';
import { darken } from '@mui/material/styles';
import type { Theme } from '@mui/material';
import type { ObjectTypeOption } from '../components/ContentTypeFilter/ContentTypesFilter';
import { ContentItem } from '../models/Item';
import type { BuiltInControlType } from '../components/FormsEngine/lib/controlMap';
import { defineMessages, IntlShape } from 'react-intl';
import { XmlKeys } from '../components/FormsEngine/lib/formConsts';

const messages = defineMessages({
	[XmlKeys.displayTemplate]: {
		defaultMessage: 'Display template'
	},
	[XmlKeys.templateNotRequired]: {
		defaultMessage: 'No template required'
	},
	[XmlKeys.dateModified]: {
		defaultMessage: 'Last modified date'
	},
	[XmlKeys.dateCreated]: {
		defaultMessage: 'Created date'
	}
});

// TODO: Not used.
export function getRelatedContentTypeIds(contentType: ContentType): string[] {
	return Object.values(contentType.fields).reduce((accumulator, field) => {
		if (
			field.type === 'array' &&
			field.validations != null &&
			'validations' in field &&
			'allowedContentTypes' in field.validations
		) {
			Object.keys(field.validations.allowedContentTypes.value).forEach(
				(ctid) => !accumulator.includes(ctid) && accumulator.push(ctid)
			);
		}
		return accumulator;
	}, []);
}

export function isGroupItem(contentType: ContentType, fieldId: string): boolean {
	return fieldId.includes('.');
}

export function isComponentHolder(contentType: ContentType, fieldId: string): boolean {
	return getField(contentType, fieldId).type === 'node-selector';
}

export function isGroup(contentType: ContentType, fieldId: string): boolean {
	return getField(contentType, fieldId).type === 'repeat';
}

export function doesFieldAccept(contentType: ContentType, fieldId: string) {
	// const field = ContentType.getField(contentType, fieldId);
	throw new Error('[doesFieldAccept] Not implemented');
}

export function getField(
	type: ContentType,
	fieldId: string,
	contentTypes?: LookupTable<ContentType>
): ContentTypeField {
	const fields = fieldId.split('.');
	let accumulator = Array.isArray(type.fields) ? createLookupTable(type.fields) : type.fields;
	let parsedFieldId = [];
	fields.forEach((field) => {
		parsedFieldId.push(field);
		if (accumulator.type === 'node-selector') {
			if (!contentTypes) {
				throw new Error(
					`Content types not provided to content type helper \`getField\` method. ` +
						`Unable to retrieve the field \`${fieldId}\` without full list of content types.`
				);
			}
			const contentTypeWithTargetFieldId = Object.keys(accumulator.validations.allowedContentTypes.value).find((ct) =>
				Boolean(contentTypes[ct].fields[field])
			);
			accumulator = contentTypes[contentTypeWithTargetFieldId].fields[field];
		} else {
			if (accumulator.type === 'repeat') {
				// For repeat groups, the field inside the repeat group field will be
				// under {repeatName}.fields.{fieldName}. To abstract this complexity from devs
				// we parse it here.
				accumulator = accumulator.fields[field];
			} else {
				accumulator = accumulator[field];
			}
		}
	});
	return accumulator as ContentTypeField;
}

export function getFields(type: ContentType, ...ids: string[]): ContentTypeField[] {
	return ids.map((id) => getField(type, id));
}

export function getFieldsByType(contentType: ContentType, fieldType): ContentTypeField[] {
	return Object.values(contentType.fields).filter((field) => field.type === fieldType);
}

// TODO: See variable.js for additional case items to possibly include here
export function getDefaultValue(field: ContentTypeField): string | number | boolean | any[] {
	if (field.defaultValue) {
		return field.defaultValue;
	} else if (field.validations.required?.value) {
		switch (field.type as BuiltInControlType) {
			case 'image-picker': {
				const width = field.validations.width?.value ?? field.validations.minWidth?.value ?? 150;
				const height = field.validations.height?.value ?? field.validations.minHeight?.value ?? width;
				return generatePlaceholderImageDataUrl({
					width,
					height,
					font: `24px Arial`,
					text: width > 100 ? `${width} x ${height}` : ':)',
					textPositionY: height / 2,
					textPositionX: width / 2
				});
			}
			case 'input':
			case 'textarea': {
				const maxLength = parseInt(field.validations.maxLength?.value);
				const textGen = new Jabber();
				return maxLength
					? `${textGen.createParagraph(50).substring(0, maxLength)}.`.replace(/\.+/, '.')
					: textGen.createParagraph(10);
			}
			case 'rte': {
				const textGen = new Jabber();
				return textGen.createParagraph(10);
			}
			case 'numeric-input': {
				return field.validations.minValue?.value ?? 1;
			}
			case 'checkbox': {
				return 'false';
			}
			case 'date-time': {
				return new Date().toISOString();
			}
			case 'repeat': {
				const repeat = [];
				if (field.validations.minCount && field.fields) {
					new Array(field.validations.minCount).fill(null).forEach(() => {
						const item = {};
						for (const subFieldId in field.fields) {
							item[subFieldId] = getDefaultValue(field.fields[subFieldId]);
						}
						repeat.push(item);
					});
				}
				return repeat;
			}
			case 'node-selector':
				// TODO: CHECK MIN/MAX COUNT
				return [];
			default: {
				return null;
			}
		}
	}
}

// TODO: This could be used to more generic location. What it does is not specific to content types.
/**
 * It takes a string and generates a colour and contrast colour for it.
 * Applies a darkening effect when the theme is dark.
 */
export function getAvatarWithIconColors(
	colourBaseString: string,
	theme: Theme,
	darkenFn: typeof darken
): { backgroundColor: string; textColor: string } {
	if (!(colourBaseString && theme && darkenFn)) {
		return { backgroundColor: '', textColor: '' };
	}
	const base = toColor(colourBaseString);
	const backgroundColor = theme.palette.mode === 'dark' ? darkenFn(base, 0.2) : base;
	const textColor = theme.palette.getContrastText(base);
	return { backgroundColor, textColor };
}

export const filterTypesByKeywordsAndObjectType = (
	contentTypesList: ContentType[],
	value: string,
	objectTypeFilter: ObjectTypeOption
) => {
	if (!contentTypesList) return [];
	if (isEmpty(value) && objectTypeFilter === 'all') return contentTypesList;
	const keyword = value.toLowerCase();
	return contentTypesList.filter(
		(type) =>
			(objectTypeFilter === 'all' || type.type === objectTypeFilter) &&
			`${type.name}${type.id}`.toLowerCase().includes(keyword)
	);
};

export function getNormalizedFolderPathForApi1GetTypes(item: ContentItem): string {
	// TODO: https://github.com/craftersoftware/craftercms/issues/4473
	return item.systemType === 'folder' && !item.path.endsWith('/') ? `${item.path}/` : item.path;
}

export function createFormDefinitionPathFromTypeId(contentTypeId: string): string {
	return ensureSingleSlash(`/content-types/${contentTypeId}/form-definition.xml`);
}

/**
 * Retrieves the internal content-type fields used by studio.
 *
 * @param formatMessage - i18n formatter.
 * @returns An array of `ContentTypeField` objects representing the internal fields.
 */
export function getStudioContentInternalFields(formatMessage: IntlShape['formatMessage']): ContentTypeField[] {
	return [
		{
			id: XmlKeys.templateNotRequired,
			name: formatMessage(messages[XmlKeys.templateNotRequired]),
			type: 'boolean',
			validations: {},
			defaultValue: ''
		},
		{
			id: XmlKeys.dateModified,
			name: formatMessage(messages[XmlKeys.dateModified]),
			type: 'date-time',
			validations: {},
			defaultValue: ''
		},
		{
			id: XmlKeys.dateCreated,
			name: formatMessage(messages[XmlKeys.dateCreated]),
			type: 'date-time',
			validations: {},
			defaultValue: ''
		}
	];
}

export function createConfigPathFromTypeId(contentTypeId: string): string {
	return ensureSingleSlash(`/content-types/${contentTypeId}/config.xml`);
}

export const systemValidationsNames = [
	'itemManager',
	'minSize',
	'maxSize',
	'maxlength',
	'readonly',
	'width',
	'height',
	'minWidth',
	'minHeight',
	'maxWidth',
	'maxHeight',
	'minValue',
	'maxValue',
	'imgRepositoryUpload',
	'imgDesktopUpload',
	'videoDesktopUpload',
	'videoBrowseRepo',
	'audioDesktopUpload',
	'audioBrowseRepo',
	'fileBrowseRepo'
];

export const systemValidationsKeysMap = {
	minSize: 'minCount',
	maxSize: 'maxCount',
	maxlength: 'maxLength',
	contentTypes: 'allowedContentTypes',
	tags: 'allowedContentTypeTags',
	readonly: 'readOnly',
	width: 'width',
	height: 'height',
	minWidth: 'minWidth',
	minHeight: 'minHeight',
	maxWidth: 'maxWidth',
	maxHeight: 'maxHeight',
	minValue: 'minValue',
	maxValue: 'maxValue',
	imgRepositoryUpload: 'allowImagesFromRepo',
	imgDesktopUpload: 'allowImageUpload',
	videoDesktopUpload: 'allowVideoUpload',
	videoBrowseRepo: 'allowVideosFromRepo',
	audioDesktopUpload: 'allowAudioUpload',
	audioBrowseRepo: 'allowAudioFromRepo',
	fileBrowseRepo: 'allowFilesFromRepo',
	addMedia: 'addMedia'
};

export const componentsDataSourceContentTypesPropertyNames = [
	'allowedContentTypes',
	'allowedEmbeddedContentTypes',
	'allowedSharedContentTypes',
	'allowedSharedExistingContentTypes'
];
