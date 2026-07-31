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

import type {
	ContentTypeField,
	ContentTypeFieldValidation,
	ContentTypeSection,
	DataSource,
	LegacyDataSource,
	LegacyFormDefinitionField,
	NewContentTypeField,
	NewDataSource,
	ValidationKeys
} from '../../models';
import type LookupTable from '../../models/LookupTable';
import type { ContentType, SerializeToXmlContentTypeStructure } from '../../models/ContentType';
import { createLookupTable, noOp, pluckProps } from '../../utils/object';
import {
	FormsEngineFormApiContextProps,
	FormsEngineItemMetaContextProps,
	StableFormContextProps,
	StableGlobalContextProps
} from '../FormsEngine/lib/formsEngineContext';
import { buildSectionExpandedStateAtoms, setFieldAtoms } from '../FormsEngine/lib/formUtils';
import { RefObject } from 'react';
import { Subject } from 'rxjs';
import { createParsedValueForField } from '../FormsEngine/lib/valueRetrievers';
import { toBooleanString, toColor } from '../../utils/string';
import { getXmlBuilder, valueSerializersLookup } from '../FormsEngine/lib/valueSerializers';
import { nanoid } from 'nanoid';
import { commonDataSourceDescriptors, dataSourceDescriptors } from './descriptors/dataSources';
import type { ControlProps } from '../FormsEngine/types';
import { IntlShape } from 'react-intl';
import TranslationOrText from '../../models/TranslationOrText';
import { getFileNameFromPath } from '../../utils/path';
import type { Dispatch } from 'redux';
import { editController, editTemplate } from '../../state/actions/misc';
import { popDialog, pushDialog } from '../../state/actions/dialogStack';
import type { BuiltInControlType } from '../FormsEngine/lib/controlMap';
import { asArray } from '../../utils/array';
import { componentsDataSourceContentTypesPropertyNames, systemValidationsKeysMap } from '../../utils/contentType';
import { XmlKeys } from '../FormsEngine/lib/formConsts';
import { getPossibleTranslation } from '../../utils/i18n';
import { FormatXMLElementFn, PrimitiveType } from 'intl-messageformat';
import { commonControlFieldsDescriptors, defaultDataSourcesSection } from './descriptors/controls/commonDescriptors';

// TODO: assess which of the utils here should go to utils/contentType.ts, or other places (serializers, etc.)

export const DeserializerNullSymbol = Symbol(null);

export const NEW_FIELD_ID = '{NEW}';
export const NEW_DATASOURCE_ID = '{NEW}';
export const TYPE_TEMPLATE_BASE_PATH = '/templates/web';
export const CONTENT_TYPES_BASE_PATH = '/config/studio/content-types';
export const TYPE_GROOVY_CONTROLLER_BASE_PATH = '/config/studio/content-types';

// Some properties in ContentTypeField differ from the name in the XML.
// Descriptors for controls, sections, data sources, etc., declare their form fields with the XML name,
// so when mapping a field to its form values, those props with different names need to get mapped.
const contentTypeFieldToXmlNameMap = { name: 'title', helpText: 'help' };

type ContentTypeFieldProperties = keyof ContentTypeField;
const ignoredContentTypeFieldProps: Array<ContentTypeFieldProperties> = ['sortable', 'values', 'type'];

export type TypePropsToEdit = Pick<
	ContentType,
	| 'id'
	| 'name'
	| 'description'
	| 'type'
	| 'thumbnailFileName'
	| 'mergeStrategy'
	| 'quickCreate'
	| 'quickCreatePath'
	| 'hasJsController'
	| 'displayTemplate'
	| 'isHeadless'
	| 'paths'
	| 'sections'
	| 'delete-dependencies'
	| 'copy-dependencies'
	| 'previewable'
>;

type ContentTypeValuesObject = TypePropsToEdit & { groovyController: string };

export const typePropsToEdit: Array<keyof TypePropsToEdit> = [
	'id',
	'name',
	'description',
	'type',
	'thumbnailFileName',
	'mergeStrategy',
	'quickCreate',
	'quickCreatePath',
	'hasJsController',
	'displayTemplate',
	'isHeadless',
	'paths',
	'sections',
	'delete-dependencies',
	'copy-dependencies',
	'previewable'
];

// Some system fields resolve to other built-in controls, so we need to map them to the correct type
export const systemFieldsTypesMap: Partial<Record<BuiltInControlType, string>> = {
	[XmlKeys['disabled']]: 'checkbox',
	[XmlKeys['internalName']]: 'input'
};

// Some system fields have a pre-set id which is not editable.
export type readOnlyFieldIdsType = 'disabled' | 'file-name' | 'internal-name' | 'placeInNav' | 'navLabel';
export const readOnlyFieldsIds: readOnlyFieldIdsType[] = [
	XmlKeys['disabled'],
	XmlKeys['fileName'],
	XmlKeys['internalName'],
	XmlKeys['placeInNav'],
	XmlKeys['navLabel']
];

// Some system fields have a pre-set id. This map is to map the built-in control type to the id.
export const systemFieldsIdsMap: Partial<Record<BuiltInControlType, readOnlyFieldIdsType>> = {
	[XmlKeys['disabled']]: 'disabled',
	[XmlKeys['fileName']]: 'file-name',
	'auto-filename': 'file-name',
	[XmlKeys['internalName']]: 'internal-name',
	'page-nav-order': 'placeInNav'
	// 'locale-selector: 'locale-selector' // This one doesn't have a pre-set id
};

export function createTypeFormValuesObject(type: ContentType): ContentTypeValuesObject {
	const values: Partial<ContentTypeValuesObject> = pluckProps(type, false, ...typePropsToEdit);
	values.groovyController = 'controller.groovy';
	return values as ContentTypeValuesObject;
}

/**
 * Creates the form values object for a content type field. It produces a FormsEngine values object
 * for the virtual content type produced for each field.
 **/
export function createTypeFieldValuesObject(field: ContentTypeField): LookupTable<unknown> {
	const values: LookupTable<unknown> = {};
	let property: ContentTypeFieldProperties;
	for (property in field) {
		if (ignoredContentTypeFieldProps.includes(property)) continue;
		if (property === 'fields') {
			values.fields = {};
			for (const fieldId in field.fields) {
				values.fields[fieldId] = createTypeFieldValuesObject(field.fields[fieldId]);
			}
		} else if (property === 'properties') {
			populateFieldPropertiesValues(values, field.properties);
		} else if (property === 'validations') {
			populateFieldValidationsValues(values, field.validations);
		} else {
			// See notes on `contentTypeFieldToXmlNameMap` declaration.
			values[contentTypeFieldToXmlNameMap[property] ?? property] = field[property];
		}
	}
	return values;
}

export function populateFieldPropertiesValues(
	values: LookupTable<unknown>,
	properties: ContentTypeField['properties']
): void {
	for (const property in properties ?? {}) {
		if (property === 'plugin') {
			values[property] = properties[property];
			continue;
		}
		const propObject = properties[property];
		values[property] = propObject.value;
	}
}

export function populateFieldValidationsValues(
	values: LookupTable<unknown>,
	validations: ContentTypeField['validations']
): void {
	let validationKey: ValidationKeys;
	for (validationKey in validations ?? {}) {
		// The maxlength property is mapped from properties to `field.validations.maxLength` when parsing the API
		// response to a content type, which makes it be present in both field.properties & field.validations.
		// We're skipping the validation since the properties is the rawest (has the raw XML name `maxlength`)
		// 	TODO: Should we use upgrade manager to remove from properties and into constraints?
		if (validationKey === 'maxLength') continue;
		const validationObject = validations[validationKey as ValidationKeys];
		values[validationKey] = validationObject.value;
	}
}

export function populateDataSourcePropertiesValues(
	values: LookupTable<unknown>,
	properties: ContentTypeField['properties']
): void {
	for (const property in properties ?? {}) {
		if (property === 'plugin') {
			values[property] = properties[property];
			continue;
		}
		values[property] = properties[property];
	}
}

export function createDataSourceValuesObject(datasource: DataSource): LookupTable<unknown> {
	const values: LookupTable<unknown> = {};
	for (const property in datasource) {
		if (property === 'properties') {
			populateDataSourcePropertiesValues(values, datasource.properties);
		} else {
			values[property] = datasource[property];
		}
	}
	return values;
}

// values is a lookup table of values which needs to be set
export function reverseTypeFieldValuesObject(
	field: ContentTypeField,
	values: LookupTable<unknown>,
	descriptor: DescriptorContentType
): ContentTypeField {
	const fieldWithReversedValues: ContentTypeField = { ...field };
	let property: ContentTypeFieldProperties;
	for (property in field) {
		if (ignoredContentTypeFieldProps.includes(property)) continue;

		// It may happen that the original XML doesn't have some properties/validations that the field has (in the descriptor).
		// So we need to ge the defaults from the descriptor to ensure we don't drop them when retrieving the values.
		const defaults = getPropertiesAndValidationsFromDescriptor(descriptor);
		if (property === 'fields') {
			if (values.fields) {
				for (const fieldId in field.fields) {
					fieldWithReversedValues.fields[fieldId] = reverseTypeFieldValuesObject(
						field.fields[fieldId],
						values.fields[fieldId],
						descriptor
					);
				}
			}
		} else if (property === 'properties') {
			fieldWithReversedValues.properties = {};
			const properties = fieldWithReversedValues.properties;
			// 'field.properties' is the result of mapping the content type field (parseLegacyFormDefinitionFields)
			const mergedProperties = { ...defaults.properties, ...(field.properties ?? {}) };
			const datasourceFields = descriptor.fields;

			for (const property in mergedProperties) {
				// A stored property that's no longer in the descriptor would get cleaned/dropped up by this check.
				if (property !== 'plugin' && !(property in values)) {
					continue;
				}
				if (property === 'plugin') {
					properties[property] = mergedProperties[property];
					continue;
				}
				const fieldDescriptor = datasourceFields[property];
				if (!fieldDescriptor) {
					// TODO: remove - development purposes
					console.log('Warning: property not found in descriptor', property, field.id);
					// Drop unknown/obsolete property not present in descriptor
					continue;
				}
				properties[property] = { ...mergedProperties[property] };
				// Serialize field properties
				const serializer = valueSerializersLookup[fieldDescriptor.type];
				properties[property].value = serializer
					? serializer(fieldDescriptor, values[property])
					: (values[property] as never);
			}
		} else if (property === 'validations') {
			fieldWithReversedValues.validations = { ...field.validations };
			const validations = fieldWithReversedValues.validations;
			const mergedValidations = { ...defaults.validations, ...(field.validations ?? {}) };
			let validationKey: ValidationKeys;
			for (validationKey in mergedValidations) {
				validations[validationKey as ValidationKeys] = { ...mergedValidations[validationKey as ValidationKeys] };
				validations[validationKey as ValidationKeys].value =
					// TODO: Should we use upgrade manager to remove from properties and into constraints?
					// The maxlength property is mapped from properties to `field.validations` as `maxLength`.
					values[validationKey === 'maxLength' ? 'maxlength' : validationKey];
			}
		} else {
			// See notes on `contentTypeFieldToXmlNameMap` declaration.
			// @ts-expect-error: TS is unable to determine the match between types here
			fieldWithReversedValues[property] = values[contentTypeFieldToXmlNameMap[property] ?? property];
		}
	}
	return fieldWithReversedValues;
}

export type PartialContentType = Pick<ContentType, 'id' | 'name' | 'description' | 'sections' | 'fields'> & {
	dataSources?: DataSource[];
};

export type DescriptorContentType = Pick<ContentType, 'id'> & {
	dataSources?: DataSource[];
	name: TranslationOrText;
	description: TranslationOrText;
	sections: DescriptorSection[];
	fields: LookupTable<DescriptorField>;
	type?: 'image' | 'item' | 'audio' | 'flash' | 'video' | 'transcoded-video';
	metadata?: {
		suffixes?: string[];
		additionalFields?: string[];
	};
};

export type DescriptorSection = Omit<ContentTypeSection, 'title' | 'description'> & {
	title: TranslationOrText;
	description: TranslationOrText;
};

export type DescriptorField = Omit<ContentTypeField, 'name' | 'description' | 'fields'> & {
	name: TranslationOrText;
	description?: TranslationOrText;
	helpText?: TranslationOrText;
	fields?: LookupTable<DescriptorField>;
	validations: Partial<DescriptorFieldValidations>;
};

export type DescriptorFieldValidationKeys = ValidationKeys | 'root' | 'regex' | 'type';

export type DescriptorContentTypeFieldValidation = Omit<ContentTypeFieldValidation, 'id'> & {
	id: DescriptorFieldValidationKeys;
};

export type DescriptorFieldValidations = Record<DescriptorFieldValidationKeys, DescriptorContentTypeFieldValidation>;

export interface TypeBuilderControl extends Omit<ControlProps, 'field'> {
	field: ContentTypeField & {
		validations: Partial<DescriptorFieldValidations>;
	};
}

export function createEmptyTypeStructure(mixin?: Partial<ContentType>): ContentType {
	return {
		id: null,
		type: undefined,
		name: null,
		description: null,
		dataSources: null,
		displayTemplate: null,
		mergeStrategy: null,
		quickCreate: null,
		quickCreatePath: null,
		hasJsController: null,
		thumbnailFileName: null,
		isHeadless: null,
		paths: null,
		'delete-dependencies': null,
		'copy-dependencies': null,
		previewable: false,
		fields: {},
		sections: [],
		...mixin
	};
}

export function createVirtualTypeForField(
	controlDescriptor: DescriptorContentType,
	formatMessage: IntlShape['formatMessage']
): ContentType {
	const translatedControlDescriptor = applyTranslations(
		{
			...controlDescriptor,
			fields: {
				...commonControlFieldsDescriptors,
				...controlDescriptor.fields
			},
			sections: [
				{
					id: 'properties',
					color: null,
					title: 'Basic Properties',
					description: '',
					fields: Object.keys(commonControlFieldsDescriptors),
					expandByDefault: true
				},
				...(controlDescriptor.sections ?? [])
			]
		},
		formatMessage
	);
	return createEmptyTypeStructure(translatedControlDescriptor);
}

export function createVirtualTypeForSection(
	descriptor: DescriptorContentType,
	formatMessage: IntlShape['formatMessage']
): ContentType {
	const translatedDescriptor = applyTranslations(
		{
			...descriptor,
			fields: descriptor.fields,
			sections: descriptor.sections
		},
		formatMessage
	);
	return createEmptyTypeStructure(translatedDescriptor);
}

export function createVirtualTypeForDataSource(
	dataSourceDescriptor: DescriptorContentType,
	formatMessage: IntlShape['formatMessage']
): ContentType {
	const translatedDataSourceDescriptor = applyTranslations(
		{
			...dataSourceDescriptor,
			fields: {
				...commonDataSourceDescriptors,
				...dataSourceDescriptor.fields
			},
			sections: [
				{
					id: 'properties',
					color: null,
					title: 'Basic Properties',
					description: '',
					fields: Object.keys(commonDataSourceDescriptors),
					expandByDefault: true
				},
				...(dataSourceDescriptor.sections ?? [])
			]
		},
		formatMessage
	);
	return createEmptyTypeStructure(translatedDataSourceDescriptor);
}

export function createVirtualSection<K extends ContentTypeSection | DescriptorSection>(
	sectionData: Partial<K> & Pick<K, 'title' | 'fields'>
): K {
	const title = JSON.stringify(
		typeof sectionData.title === 'object' ? sectionData.title.defaultMessage : sectionData.title
	);
	return {
		id: sectionData?.id || nanoid(),
		description: '',
		expandByDefault: true,
		...sectionData,
		color: sectionData?.color ?? toColor(title)
	} as K;
}

type VirtualDataSourceFields = (ContentTypeField & { validations: Partial<DescriptorFieldValidations> }) &
	Partial<NewContentTypeField>;
export function createVirtualDataSourceFields(type: ContentType): LookupTable<VirtualDataSourceFields> {
	const dataSourceFields: LookupTable<VirtualDataSourceFields> = {};
	for (const dataSource of type.dataSources ?? []) {
		dataSourceFields[dataSource.id] = {
			...((dataSource as NewDataSource).NEW && { NEW: true }),
			id: dataSource.id,
			type: dataSource.type,
			name: dataSource.title,
			defaultValue: undefined,
			validations: {
				type: createValidation('type', dataSource.interface)
			}
		};
	}
	return dataSourceFields;
}

export const fooStableGlobalContext: StableGlobalContextProps = Object.freeze<StableGlobalContextProps>({
	formsStackData: [],
	api: {
		pushForm: noOp,
		popForm: noOp,
		updateProps: noOp,
		setStateCache: noOp
	}
});

export function createVirtualTypeFormContext(
	type: ContentType,
	values: LookupTable<unknown>,
	contentTypesLookup: LookupTable<ContentType>,
	mixin?: Partial<StableFormContextProps>
): StableFormContextProps {
	const context = createStableFormContextProps({ type });
	const contextRef: RefObject<StableFormContextProps> = { current: context };
	const contentTypeFields = type.fields;
	const formValues: LookupTable<unknown> = {};
	context.atoms.valueByFieldId = {};
	context.atoms.validationByFieldId = {};
	context.changedFieldIds = new Set();
	context.originalValues = values;
	context.fieldUpdates$ = mixin.fieldUpdates$ ?? new Subject();
	Object.values(contentTypeFields).forEach((field) => {
		formValues[field.id] = createParsedValueForField(values[field.id], field, contentTypesLookup);
		setFieldAtoms(contextRef, type, type.fields, field.id, context.atoms, formValues[field.id]);
	});
	return context;
}

export function createFieldFormContextApi(): FormsEngineFormApiContextProps {
	const api: FormsEngineFormApiContextProps = {
		rollback() {},
		rollbackField() {},
		setValuesCheckpoint() {}
	};
	return api;
}

export function createFieldItemMetaContext(type: ContentType): FormsEngineItemMetaContextProps {
	const context: FormsEngineItemMetaContextProps = {
		id: '',
		path: '',
		sourceMap: null,
		pathInSite: '',
		contentType: type,
		contentObject: {},
		contentXml: null
	};
	return context;
}

export const createStableFormContextProps = (
	{
		type
	}: {
		type: ContentType;
	},
	createRootTypeSections: boolean = false
) => {
	const context: StableFormContextProps = {
		atoms: {
			expandedStateBySectionId: buildSectionExpandedStateAtoms(type.sections),
			isSubmitting: undefined,
			hasPendingChanges: undefined,
			readonly: undefined,
			lockResult: undefined,
			valueByFieldId: undefined,
			validationByFieldId: undefined,
			versionComment: undefined,
			collapseToC: undefined,
			useCollapsedToC: undefined,
			isLargeContainer: undefined,
			tableOfContentsDrawerOpen: undefined,
			closeAfterSave: undefined,
			minimizeAfterSave: undefined
		},
		changedFieldIds: null,
		fieldUpdates$: null,
		itemMeta: createFieldItemMetaContext(type), // TODO: Property may be removed from this context altogether
		originalValues: null,
		props: null,
		state: null
	};
	if (createRootTypeSections) {
		Object.assign(
			context.atoms.expandedStateBySectionId,
			buildSectionExpandedStateAtoms([defaultDataSourcesSection as ContentTypeSection])
		);
	}
	return context;
};

export function makeIntoTypeFieldStructPath(fieldPath: string): string {
	return fieldPath
		.split('.')
		.map((piece) => `${piece}.fields`)
		.join('.')
		.replace(/.fields$/, '');
}

export function prepareSerializeToXmlTypeObject(
	type: ContentType,
	configDescriptors?: {
		controlDescriptors: LookupTable<DescriptorContentType>;
		dataSourceDescriptors: LookupTable<DescriptorContentType>;
	}
): SerializeToXmlContentTypeStructure {
	return {
		'content-type': type.id,
		title: type.name,
		controller: toBooleanString(type.hasJsController),
		description: type.description,
		objectType: type.type,
		quickCreate: toBooleanString(type.quickCreate),
		quickCreatePath: type.quickCreatePath,
		imageThumbnail: type.thumbnailFileName,
		paths: type.paths,
		'delete-dependencies': type['delete-dependencies'],
		'copy-dependencies': type['copy-dependencies'],
		previewable: type.previewable,
		properties: {
			property: [
				{
					label: 'Display Template',
					name: 'display-template',
					type: 'template',
					value: type.displayTemplate
				},
				{
					label: 'No Template Required',
					name: 'no-template-required',
					type: 'boolean',
					value: toBooleanString(type.isHeadless)
				},
				{
					label: 'Merge Strategy',
					name: 'merge-strategy',
					type: 'string',
					value: type.mergeStrategy
				}
			]
		},
		sections: {
			section: type.sections.map((section) => ({
				id: section.id,
				title: section.title,
				description: section.description,
				defaultOpen: toBooleanString(section.expandByDefault),
				fields: {
					field: section.fields.map((fieldId) => convertFieldStructToXmlStruct(type.fields[fieldId]))
				},
				color: section.color
			}))
		},
		datasources:
			type.dataSources?.length > 0
				? {
						datasource: type.dataSources?.map((ds) =>
							convertDataSourceStructToXmlStruct(ds, configDescriptors?.dataSourceDescriptors)
						)
					}
				: null
	};
}

export function buildContentTypeXml(serializeTypeStructureObject: SerializeToXmlContentTypeStructure): string {
	const builder = getXmlBuilder({ suppressEmptyNode: true });
	return builder.build({ form: serializeTypeStructureObject });
}

function convertFieldStructToXmlStruct(field: ContentTypeField): Required<LegacyFormDefinitionField> {
	const minOccurs = field.properties?.minOccurs?.value as string;
	const maxOccurs = field.properties?.maxOccurs?.value as string;

	// 'plugin' comes in 'field.properties'. (see ContentTypeField['properties'], but it's a separate object in the XML.
	let plugin: LegacyFormDefinitionField['plugin'];
	const properties: LegacyFormDefinitionField['properties'] = field.properties
		? ({
				property: Object.entries(field.properties ?? {})
					.filter(([key, value]) => {
						if (key === 'plugin') plugin = value as LegacyFormDefinitionField['plugin'];
						return key !== 'plugin';
					})
					.map(([, value]) => value)
			} as LegacyFormDefinitionField['properties'])
		: undefined;

	const invertedSystemValidationsNames = [
		...Object.values(systemValidationsKeysMap),
		...componentsDataSourceContentTypesPropertyNames
	];

	const constraints =
		field.validations && Object.keys(field.validations).length > 0
			? {
					constraint: Object.values(field.validations)
						.map((validation) => ({
							name: validation.id,
							value: validation.value,
							type: typeof validation.value
						}))
						.filter((validation) => !invertedSystemValidationsNames.includes(validation.name))
				}
			: undefined;

	// Note: `undefined` suppresses nodes in the XML, empty strings doesn't.
	return {
		id: field.id,
		title: field.name,
		description: field.description,
		defaultValue: field.defaultValue,
		type: field.type,
		help: field.helpText,
		iceId: undefined, // TODO: drop?
		// region Repeat Groups
		maxOccurs,
		minOccurs,
		fields: field.fields
			? {
					field: Object.values(field.fields).map((value) => convertFieldStructToXmlStruct(value))
				}
			: undefined,
		// endregion
		plugin,
		properties,
		constraints
	};
}

const propertiesSimpleTypes = ['checkbox', 'input', 'numeric-input'];
function convertDataSourceStructToXmlStruct(
	dataSource: DataSource,
	configDataSourceDescriptors?: LookupTable<DescriptorContentType>
): Required<LegacyDataSource> {
	const descriptor = configDataSourceDescriptors?.[dataSource.type] ?? dataSourceDescriptors[dataSource.type];
	return {
		id: dataSource.id,
		interface: dataSource.interface,
		title: dataSource.title,
		type: dataSource.type,
		plugin: dataSource.plugin,
		properties: {
			// TODO: Ideally, suppress these objects into simple key-value pairs.
			//   <properties>
			//     <property>
			//       <name>enableSearchExisting</name>
			//       <value>true</value>
			//       <type>boolean</type>
			//     </property>
			//  ===>
			//    <properties>
			//      <enableSearchExisting>true</enableSearchExisting>
			// TODO: note type usage in `services/contentTypes.ts, parseLegacyFormDefinition when parsing the data sources`
			property: Object.entries(dataSource?.properties ?? {}).map(([name, value]) => {
				let type = descriptor?.fields?.[name]?.type ?? typeof value;
				// some properties are simple types, so we need to get the proper type.
				if (propertiesSimpleTypes.includes(type)) {
					type = typeof value;
				}
				return { name, value, type };
			})
		}
	};
}

export function createValidation<T = unknown>(
	key: DescriptorFieldValidationKeys,
	value: T,
	level?: ContentTypeFieldValidation['level']
): DescriptorContentTypeFieldValidation {
	return {
		id: key,
		value,
		level: level ?? 'required'
	};
}

export function applyTranslations(
	descriptor: DescriptorContentType,
	formatMessage: IntlShape['formatMessage']
): PartialContentType {
	const translatedSections = descriptor.sections.map((section) => ({
		...section,
		title: translateIfMessageDescriptor(section['title'], formatMessage),
		description: translateIfMessageDescriptor(section['description'], formatMessage)
	}));

	const translatedFieldsArray = Object.values(descriptor.fields).map((field) => {
		return {
			...field,
			name: translateIfMessageDescriptor(field['name'], formatMessage),
			description: translateIfMessageDescriptor(field['description'], formatMessage)
		};
	});
	const translatedFieldsLookup = createLookupTable(translatedFieldsArray, 'id');

	return {
		...descriptor,
		name: translateIfMessageDescriptor(descriptor['name'], formatMessage),
		description: translateIfMessageDescriptor(descriptor['description'], formatMessage),
		sections: translatedSections,
		fields: translatedFieldsLookup as unknown as LookupTable<ContentTypeField>
	};
}

export function translateIfMessageDescriptor(
	titleOrDescriptor: TranslationOrText,
	formatMessage: IntlShape['formatMessage'],
	// TODO: Fix FormatXMLElementFn generics
	values?: Record<string, PrimitiveType | FormatXMLElementFn<any, any>>
): string {
	const value = getPossibleTranslation(titleOrDescriptor, formatMessage, values);
	// TODO: Ignoring non string values. Must adjust to not ignore and actually handle either here or at the consumer level.
	return typeof value === 'string' ? value : '';
}

export function editTypeTemplate(path: string, dispatch: Dispatch) {
	const fileName = getFileNameFromPath(path);
	const pathNoFileName = path.slice(0, path.lastIndexOf(fileName));

	dispatch(
		editTemplate({
			path: pathNoFileName,
			fileName,
			mode: 'ftl',
			openOnSuccess: true
		})
	);
}

export function createTypeTemplate(basePath: string, dispatch, onCreated: (item) => void) {
	const id = nanoid();
	dispatch(
		pushDialog({
			id,
			component: 'craftercms.components.CreateFileDialog',
			props: {
				path: basePath,
				type: 'template',
				onClose: () => dispatch(popDialog({ id })),
				onCreated: (item) => {
					onCreated(item);
					dispatch(popDialog({ id }));
				}
			}
		})
	);
}

export function editTypeController(
	basePath: string,
	contentTypeId: string,
	dispatch: Dispatch,
	type: 'groovy' | 'javascript'
) {
	const fileName = type === 'groovy' ? 'controller.groovy' : 'form-controller.js';
	// editController creates the config file if it doesn't exist.
	dispatch(
		editController({
			path: `${basePath}${contentTypeId}/`,
			fileName,
			mode: type,
			contentType: contentTypeId,
			openOnSuccess: true
		})
	);
}

export const isComposedPath = (path: string): boolean => {
	return path.includes('.');
};

function getSubFieldFromType(parentField: ContentTypeField, fieldIdPath: string): ContentTypeField {
	if (isComposedPath(fieldIdPath)) {
		// If still composed, we need to find the root field and get the field recursively
		const rootFieldId = fieldIdPath.split('.').shift();
		return getSubFieldFromType(parentField.fields[rootFieldId], fieldIdPath.replace(`${rootFieldId}.`, ''));
	} else {
		return parentField.fields[fieldIdPath];
	}
}

export function getFieldFromType(type: ContentType, fieldIdPath: string): ContentTypeField {
	if (isComposedPath(fieldIdPath)) {
		const rootFieldId = fieldIdPath.split('.').shift();
		return getSubFieldFromType(type.fields[rootFieldId], fieldIdPath.replace(`${rootFieldId}.`, ''));
	} else {
		return type.fields[fieldIdPath];
	}
}

export function getSectionFromType(type: ContentType, sectionId: string): ContentTypeSection | undefined {
	return type.sections.find((section) => section.id === sectionId);
}

export function getPropertiesAndValidationsFromDescriptor(descriptor: DescriptorContentType): {
	properties: ContentTypeField['properties'];
	validations: ContentTypeField['validations'];
} {
	const properties = {};
	const validations = {};
	if (!descriptor || !descriptor.sections || !descriptor.fields) {
		return { properties, validations };
	}

	const sections = createLookupTable(descriptor.sections);
	const propertiesFieldIds = sections.properties?.fields ?? [];
	propertiesFieldIds.forEach((field) => {
		const fieldDescriptor = descriptor.fields?.[field];
		if (!fieldDescriptor) return;
		properties[field] = {
			name: field,
			value: descriptor.fields[field]?.defaultValue,
			type: fieldDescriptor.type
		};
	});

	const constraintsFieldIds = (asArray(sections.constraints?.fields) as DescriptorFieldValidationKeys[]) ?? [];
	constraintsFieldIds.forEach((field) => {
		validations[field] = {
			...createValidation(field, descriptor.fields[field]?.defaultValue)
		};
	});

	return { properties, validations };
}
