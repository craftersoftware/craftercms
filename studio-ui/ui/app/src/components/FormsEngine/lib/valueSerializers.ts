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

import { ContentTypeField } from '../../../models';
import { NodeSelectorItem } from '../controls/NodeSelector';
import LookupTable from '../../../models/LookupTable';
import ContentType from '../../../models/ContentType';
import { XmlKeys } from './formConsts';
import { BuiltInControlType } from './controlMap';
import { RepeatItem } from '../controls/Repeat';
import { XMLBuilder, XmlBuilderOptions } from 'fast-xml-parser';
import type { DescriptorControlType } from '../../ContentTypeManagement/controlMap';
import { nnou } from '../../../utils/object';
import { escapeXml } from '../../../utils/xml';
import { AwsFile } from '../controls/AWSFileUpload';

const attributeNamePrefix = '@:';
const cdataPropName = '__cdata__';
const textNodeName = '#text';

export type ValueSerializer<T = unknown> = (
	field: ContentTypeField,
	value: unknown,
	contentTypesLookup?: LookupTable<ContentType>
) => T;

export const valueSerializersLookup: Record<BuiltInControlType | DescriptorControlType, ValueSerializer | undefined> = {
	'auto-filename': undefined,
	'aws-file-upload': (field, value) => prepareAwsFile(field, value as AwsFile),
	'checkbox-group': prepareArray,
	checkbox: undefined,
	boolean: undefined,
	'date-time': undefined,
	'expired-date': undefined,
	disabled: undefined,
	dropdown: undefined,
	'file-name': undefined,
	forcehttps: undefined,
	'image-picker': undefined,
	input: (field, value) => prepareString(field, value as string),
	string: (field, value) => prepareString(field, value as string),
	'internal-name': undefined,
	label: undefined,
	'locale-selector': undefined,
	repeat: (field, value, contentTypesLookup) => prepareRepeat(field, value as RepeatItem[], contentTypesLookup),
	'node-selector': (field, value, contentTypesLookup) =>
		prepareNodeSelector(field, value as NodeSelectorItem[], contentTypesLookup),
	'numeric-input': undefined,
	int: undefined,
	'page-nav-order': undefined,
	rte: prepareRTE,
	textarea: (field, value) => prepareString(field, value as string),
	time: undefined,
	'transcoded-video-picker': (field, value) => prepareArray(field, value),
	uuid: undefined,
	'video-picker': undefined,
	colorPicker: undefined,
	'content-path-input': undefined,
	contentTypes: (field, value) => prepareContentTypes(field, value as string[]),
	'dropdown-static-values': (field, value) => prepareObjectArray(field, value as object[]),
	'template-selector': undefined,
	'type-image-selector': undefined,
	'read-only-value': undefined,
	range: (field, value) => prepareObject(field, value as object),
	'type-js-controller-selector': undefined,
	'key-value-map': (field, value) => prepareObjectArray(field, value as object[]),
	'type-destination-paths-selector': (field, value) => prepareObject(field, value as object),
	'path-with-macro-creator': undefined,
	'merge-strategy-selector': undefined,
	'datasource:image': (field, value) => prepareStringArray(field, value as string[]),
	'datasource:video': (field, value) => prepareStringArray(field, value as string[]),
	'datasource:audio': (field, value) => prepareStringArray(field, value as string[]),
	'datasource:item': (field, value) => prepareStringArray(field, value as string[]),
	'datasource:transcoded-video': (field, value) => prepareStringArray(field, value as string[]),
	'datasource:image:singleSelection': undefined,
	'datasource:video:singleSelection': undefined,
	'datasource:audio:singleSelection': undefined,
	'datasource:item:singleSelection': undefined,
	variable: undefined,
	'date-time-expression-input': undefined,
	'input-email': undefined,
	'input-link': undefined,
	'input-phone': undefined,
	'delete-dependencies': (field, value) => (value == null ? undefined : prepareObject(field, value as object)),
	'copy-dependencies': (field, value) => (value == null ? undefined : prepareObject(field, value as object)),
	'sort-dropdown': undefined
};

/**
 * Formats a FormsEngine values object with "hints" for attributes or other specifics for the XML serialiser to serialise
 * the content as a CrafterCMS content xml.
 **/
function prepareValuesForXmlSerialising(
	fields: LookupTable<ContentTypeField>,
	values: LookupTable<unknown>,
	contentTypesLookup: LookupTable<ContentType>
): LookupTable<unknown> {
	const jObj = { ...values };
	Object.entries(jObj).forEach(([id, value]) => {
		// System props are not in the model, hence field might be undefined at times.
		const field = fields[id];
		const fieldType = field?.type as BuiltInControlType | DescriptorControlType;
		const fieldAttributes: Record<string, unknown> = {};
		// Field type specific hinting...

		const serializer = valueSerializersLookup[fieldType];
		if (serializer) {
			jObj[id] = serializer(field, value, contentTypesLookup);
		}
		if (field?.properties?.tokenize?.value) {
			fieldAttributes[createAttrHint('tokenized')] = true;
		}
		// TODO: Carry/implement attributes (no-default, remote, others?)
		if (Object.keys(fieldAttributes).length) {
			const current = jObj[id];
			jObj[id] =
				nnou(current) && typeof current === 'object'
					? { ...fieldAttributes, ...current }
					: // The serializer may have made changes to 'value', so we need to use that instead of the original 'value'
						{ ...fieldAttributes, [textNodeName]: jObj[id] };
		}
	});
	return jObj;
}

type XmlNuancedArrayFormat<T = unknown> = {
	[P in `${typeof attributeNamePrefix}item-list`]: true;
} & {
	item: T[];
};

function prepareString(field: ContentTypeField, value: string): string {
	const escapeContent = (field?.properties?.escapeContent?.value as boolean) ?? false;
	return nnou(value) && escapeContent ? escapeXml(value as string) : value;
}

function prepareNodeSelector(
	field: ContentTypeField,
	value: NodeSelectorItem[],
	contentTypesLookup: LookupTable<ContentType>
): XmlNuancedArrayFormat<NodeSelectorItem> {
	return {
		'@:item-list': true,
		item: value.map((item) => {
			if (item.component == null) {
				return item;
			}
			const contentType = contentTypesLookup[(item.component[XmlKeys.contentTypeId] as string)?.trim()];
			if (!contentType) {
				console.error(`Content type not found for embedded component`, item.component);
				return item;
			}
			const component = prepareValuesForXmlSerialising(
				contentType.fields,
				item.component,
				contentTypesLookup
			) as unknown as NodeSelectorItem['component'];
			component[createAttrHint('id')] = component[XmlKeys.modelId];
			return { ...item, [createAttrHint('inline')]: true, component };
		})
	};
}

function prepareRepeat(
	field: ContentTypeField,
	value: RepeatItem[],
	contentTypesLookup: LookupTable<ContentType>
): XmlNuancedArrayFormat {
	const nestedFields = field.fields ?? ({} as LookupTable<ContentTypeField>);
	return {
		'@:item-list': true,
		item: value.map((item) => prepareValuesForXmlSerialising(nestedFields, item, contentTypesLookup))
	};
}

function prepareArray<T = unknown>(field: ContentTypeField, value: T): { item: T } {
	return {
		// TODO: Unsure if all array-likes could/should have the item list attribute. It makes sense, though.
		//  '@:item-list': true,
		item: value
	};
}

function prepareRTE<T = unknown>(field: ContentTypeField, value: T): { [cdataPropName]: T } {
	// TODO: CDATA wrap based on config
	return { [cdataPropName]: value };
}

function prepareStringArray(field: ContentTypeField, value: string[]): string {
	return value.join(',');
}

function prepareContentTypes(field: ContentTypeField, value: string[] | '*'): string {
	if (value === '*') return '*';
	return value?.join(',') ?? '';
}

function prepareObjectArray(field: ContentTypeField, value: object[]): string {
	return JSON.stringify(value);
}

function prepareObject(field: ContentTypeField, value: object): string {
	return JSON.stringify(value);
}

function prepareAwsFile(field: ContentTypeField, value: AwsFile) {
	return { item: value };
}

function createAttrHint(attributeName: string): string {
	return `${attributeNamePrefix}${attributeName}`;
}

// TODO: Move to utils/xml.ts?
export function getXmlBuilder(options?: Partial<XmlBuilderOptions>): XMLBuilder {
	return new XMLBuilder({
		format: true,
		indentBy: '\t',
		ignoreAttributes: false,
		suppressBooleanAttributes: false,
		attributeNamePrefix,
		cdataPropName,
		textNodeName,
		...options
	});
}

// TODO: Move to content.ts?
/** Takes in a FormsEngine values object and creates the XML representation */
export function buildContentXml(values: LookupTable<unknown>, contentTypesLookup: LookupTable<ContentType>): string {
	const rootContentType: ContentType = contentTypesLookup[values[XmlKeys.contentTypeId] as string];
	const rootObjectType = rootContentType.type;
	const jObj = prepareValuesForXmlSerialising(rootContentType.fields, values, contentTypesLookup);
	rootObjectType === 'component' && (jObj[createAttrHint('id')] = jObj.objectId);
	const builder = getXmlBuilder();
	const xml = builder.build({ [`${rootObjectType}`]: jObj });
	return xml as string;
}
