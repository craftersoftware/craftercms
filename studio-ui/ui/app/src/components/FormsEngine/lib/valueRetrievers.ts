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

import LookupTable from '../../../models/LookupTable';
import ContentType, { ContentTypeField } from '../../../models/ContentType';
import type { BuiltInControlType } from './controlMap';
import type { RepeatItem } from '../controls/Repeat';
import type { NodeSelectorItem } from '../controls/NodeSelector';
import { systemFieldsNotInType, XmlKeys } from './formConsts';
import { deserialize, unescapeXml } from '../../../utils/xml';
import type { DescriptorControlType } from '../../ContentTypeManagement/controlMap';
import type { DescriptorContentType } from '../../ContentTypeManagement/utils';
import { nnou } from '../../../utils/object';
import { v4 as uuid } from 'uuid';
import { Matcher } from 'path-expression-matcher';
import controlDescriptors from '../../ContentTypeManagement/descriptors/controls';
import { getAdditionalFieldsIdsFromDescriptor } from './formUtils';

export type ValueRetriever<T = unknown> = (value: unknown, field: ContentTypeField) => T;

export const valueRetrieverLookup: Record<BuiltInControlType | DescriptorControlType, ValueRetriever | null> = {
	'auto-filename': textFieldExtractor,
	'aws-file-upload': awsFileExtractor,
	'checkbox-group': arrayFieldExtractor,
	checkbox: booleanFieldExtractor,
	boolean: booleanFieldExtractor,
	'date-time': null,
	'expired-date': null,
	disabled: booleanFieldExtractor,
	dropdown: textFieldExtractor,
	'file-name': textFieldExtractor,
	forcehttps: booleanFieldExtractor,
	'image-picker': textFieldExtractor,
	input: textFieldExtractor,
	string: textFieldExtractor,
	'internal-name': textFieldExtractor,
	label: textFieldExtractor,
	'link-input': textFieldExtractor,
	'link-textarea': textFieldExtractor,
	'linked-dropdown': textFieldExtractor,
	'locale-selector': textFieldExtractor,
	repeat: arrayFieldExtractor,
	'node-selector': arrayFieldExtractor,
	'numeric-input': numberFieldExtractor,
	int: numberFieldExtractor,
	'page-nav-order': booleanFieldExtractor,
	rte: textFieldExtractor,
	textarea: textFieldExtractor,
	time: null,
	'transcoded-video-picker': arrayFieldExtractor,
	uuid: uuidExtractor,
	'video-picker': textFieldExtractor,
	colorPicker: textOrNullExtractor,
	'content-path-input': textFieldExtractor,
	contentTypes: (value) => contentTypesExtractor(value as string),
	'dropdown-static-values': (value) => objectArrayExtractor(value as string),
	'template-selector': textFieldExtractor,
	'type-image-selector': textFieldExtractor,
	'read-only-value': textFieldExtractor,
	range: (value) => objectExtractor(value as string),
	'type-js-controller-selector': textFieldExtractor,
	'key-value-map': (value) => objectArrayExtractor(value as string),
	'type-destination-paths-selector': null,
	'path-with-macro-creator': textFieldExtractor,
	'merge-strategy-selector': textFieldExtractor,
	'datasource:image': (value) => stringArrayExtractor(value as string),
	'datasource:video': (value) => stringArrayExtractor(value as string),
	'datasource:audio': (value) => stringArrayExtractor(value as string),
	'datasource:item': (value) => stringArrayExtractor(value as string),
	'datasource:transcoded-video': (value) => stringArrayExtractor(value as string),
	'datasource:image:singleSelection': textFieldExtractor,
	'datasource:video:singleSelection': textFieldExtractor,
	'datasource:audio:singleSelection': textFieldExtractor,
	'datasource:item:singleSelection': textFieldExtractor,
	variable: textFieldExtractor,
	'date-time-expression-input': textFieldExtractor,
	'input-email': textFieldExtractor,
	'input-link': textFieldExtractor,
	'input-phone': textFieldExtractor,
	'delete-dependencies': null,
	'copy-dependencies': null,
	'sort-dropdown': textFieldExtractor
};

/**
 * Takes in the raw deserialized values from a content XML and returns a "clean" JSON-style object
 * with the values returned by the field value retrievers.
 * @param contentTypeFields The fields of the content type
 * @param xmlDeserializedValues The raw deserialized values from the content XML
 * @param contentTypesLookup A lookup table of content types
 * @param fieldCallback A callback to run for each field
 * @param customControls A lookup table with custom controls to extend the OOB controls descriptors
 **/
export function createParsedValuesObject(
	contentTypeFields: LookupTable<ContentTypeField> | ContentTypeField[],
	xmlDeserializedValues: LookupTable<unknown>,
	contentTypesLookup: LookupTable<ContentType>,
	fieldCallback?: (fieldId: string, value: unknown, isAdditionalField?: boolean) => void,
	customControls?: LookupTable<DescriptorContentType>
): LookupTable<unknown> {
	const values = {};
	systemFieldsNotInType.forEach((systemFieldId) => {
		if (systemFieldId in xmlDeserializedValues) {
			values[systemFieldId] = xmlDeserializedValues[systemFieldId] ?? '';
			fieldCallback?.(systemFieldId, values[systemFieldId]);
		}
	});
	// TODO: should controlDescriptors have priority over customControls to avoid overriding OOB controls?
	const descriptors = { ...customControls, ...controlDescriptors };
	(Array.isArray(contentTypeFields) ? contentTypeFields : Object.values(contentTypeFields)).forEach((field) => {
		const descriptor = descriptors[field.type];
		const additionalFieldIds = descriptor ? getAdditionalFieldsIdsFromDescriptor(field.id, descriptor) : [];

		additionalFieldIds.forEach((additionalFieldId) => {
			values[additionalFieldId] = createParsedValueForField(
				xmlDeserializedValues[additionalFieldId],
				field,
				contentTypesLookup
			);
			fieldCallback?.(additionalFieldId, values[additionalFieldId], true);
		});
		values[field.id] = createParsedValueForField(xmlDeserializedValues[field.id], field, contentTypesLookup);
		fieldCallback?.(field.id, values[field.id]);
	});
	return values;
}

export function createParsedValueForField<T = unknown>(
	xmlDeserializedValue: unknown,
	field: ContentTypeField,
	contentTypesLookup: LookupTable<ContentType>
): T {
	const value = retrieveFieldValue<T>(field, xmlDeserializedValue);
	const controlType = field.type as BuiltInControlType;
	switch (controlType) {
		case 'repeat': {
			return (value as Array<RepeatItem>).map((item) =>
				createParsedValuesObject(field.fields ?? ({} as LookupTable<ContentTypeField>), item, contentTypesLookup)
			) as T;
		}
		case 'node-selector': {
			return (value as Array<NodeSelectorItem>).map((item) => {
				try {
					return item.component
						? {
								...item,
								component: createParsedValuesObject(
									contentTypesLookup[(item.component[XmlKeys.contentTypeId] as string).trim()].fields,
									item.component,
									contentTypesLookup
								)
							}
						: item;
				} catch (e) {
					console.error(e);
					return item;
				}
			}) as T;
		}
	}
	return value;
}

export function retrieveFieldValue<T = unknown>(field: ContentTypeField, value: unknown): T {
	const retriever: ValueRetriever<T> | undefined = valueRetrieverLookup[field.type];
	const defaultValue = field.defaultValue as string;
	// Value considering the defaultValue
	const fieldValue = value ?? (nnou(defaultValue) && defaultValue !== '' ? defaultValue : undefined);
	if (!retriever) {
		console.warn(`No value retriever for field ${field.id} of type ${field.type}`);
		return fieldValue as T;
	}
	return retriever(fieldValue, field);
}

/** Takes in the CrafterCMS content XML and returns a JS object with the values */
export function deserializeContentDoc(contentDom: XMLDocument | Element): LookupTable<unknown> {
	if (!contentDom) return null;
	return deserialize(contentDom, {
		ignoreAttributes: true,
		// Ideally, we would extract all collection types (item selector, repeat) that have
		// this sort of syntax to avoid false positives.
		// e.g.collectionFieldIds.map((fieldId) => `${rootTagName}.${fieldId}.item`).includes(jPath);
		isArray: (tagName: string, jPathOrMatcher: string | Matcher) => {
			return typeof jPathOrMatcher === 'string' && jPathOrMatcher.endsWith('.item');
		}
	})[(contentDom as XMLDocument).documentElement?.tagName ?? (contentDom as Element).tagName];
}

export function stringArrayExtractor(value: string): string[] {
	return value ? (value as string)?.split(',') : [];
}

export function arrayFieldExtractor(value: unknown): unknown[] {
	// Controls needn't worry about packaging as `items: { item: [] }`, but when it first gets deserialised, it will have that format.
	return Array.isArray(value) ? value : ((value as Record<'item', unknown[]>)?.item ?? []);
}

export function textFieldExtractor(value: unknown, field?: ContentTypeField): string {
	const escapeContent = (field?.properties?.escapeContent?.value as boolean) ?? false;
	const rawValue: string = nnou(value) ? (value as string) : '';
	return escapeContent ? unescapeXml(rawValue) : rawValue;
}

export function textOrNullExtractor(value: unknown): string | null {
	return (value && String(value)) || null;
}

export function numberFieldExtractor(value: unknown): number | null {
	return nnou(value) ? Number(value) : null;
}

/** Handles boolean values that may come as actual booleans or as strings. An empty string or null/undefined becomes (no value set). */
export function booleanFieldExtractor(value: unknown): boolean {
	return value === true || value === 'true';
}

export function contentTypesExtractor(value: string): string[] | '*' {
	return value === '*' ? '*' : stringArrayExtractor(value);
}

export function objectArrayExtractor(value: string): object[] {
	try {
		return value ? JSON.parse(value) : [];
	} catch (e) {
		console.error('Invalid JSON', e);
		return [];
	}
}

export function objectExtractor(value: string): object {
	try {
		return value ? JSON.parse(value) : {};
	} catch (e) {
		console.error('Invalid JSON', e);
		return {};
	}
}

export function uuidExtractor(value: unknown): string {
	return textOrNullExtractor(value) ?? uuid();
}

export function awsFileExtractor(value) {
	return arrayFieldExtractor(value)[0];
}
