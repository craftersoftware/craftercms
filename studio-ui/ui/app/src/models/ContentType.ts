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

import { LookupTable } from './LookupTable';
import { XmlKeys } from '../components/FormsEngine/lib/formConsts';
import type { DescriptorFieldValidationKeys } from '../components/ContentTypeManagement/utils';

export interface ContentTypeFieldValidation<T = any> {
	id: ValidationKeys | DescriptorFieldValidationKeys;
	value: T;
	level: 'required' | 'suggestion';
}

export type ValidationKeys =
	| 'allowedContentTypeTags'
	| 'allowedContentTypes'
	| 'allowedEmbeddedContentTypes'
	| 'allowedSharedContentTypes'
	| 'allowedSharedExistingContentTypes'
	| 'minCount'
	| 'maxCount'
	| 'maxLength'
	| 'readOnly'
	| 'required'
	| 'width'
	| 'height'
	| 'minWidth'
	| 'minHeight'
	| 'maxWidth'
	| 'maxHeight'
	| 'minValue'
	| 'maxValue'
	| 'dropTargetsNotFound'
	| 'registerNotFound'
	| 'allowImagesFromRepo'
	| 'allowImageUpload'
	| 'allowVideosFromRepo'
	| 'allowVideoUpload'
	| 'allowAudioUpload'
	| 'allowAudioFromRepo'
	| 'pattern'
	| 'allowDuplicates'
	| 'addMedia'
	| 'minSize';

export type ContentTypeFieldValidations = Record<ValidationKeys, ContentTypeFieldValidation>;

export interface ValidationResult {
	id?: string;
	message?: string;
	level?: 'required' | 'suggestion' | 'info';
	values?: object;
}

export interface ContentTypeField {
	id: string;
	name: string;
	description?: string;
	type: string;
	sortable?: boolean;
	validations: Partial<ContentTypeFieldValidations>;
	properties?: Partial<
		// region
		{ plugin: LegacyFormDefinitionField['plugin'] } & Record<
			// These are just some of the possibilities...
			| 'size'
			| 'maxlength'
			| 'readonly'
			| 'allowEditWithoutWarning'
			| 'tokenized'
			| 'escapeContent'
			| 'minSize'
			| 'maxSize'
			| 'itemManager'
			| 'disableFlattening'
			| 'useSingleValueFilename'
			| 'contentTypes'
			| 'tags'
			| 'useMVS'
			| 'rows'
			| 'allowResize'
			| 'width'
			| 'height'
			| 'thumbnailWidth'
			| 'thumbnailHeight'
			| 'imageManager'
			| 'forceRootBlockPTag'
			| 'forcePTags'
			| 'forceBRTags'
			| 'supportedChannels'
			| 'rteConfiguration'
			| 'videoManager'
			| 'datasource'
			| 'selectAll'
			| 'listDirection'
			| 'showDate'
			| 'showTime'
			| 'showClear'
			| 'showNowLink'
			| 'populate'
			| 'allowPastDate'
			| 'populateDateExp'
			| 'useCustomTimezone'
			| 'readonlyEdit'
			| 'cols'
			| 'minOccurs'
			| 'maxOccurs'
			| 'emptyvalue'
			| 'maxValue'
			| 'minValue'
			| 'autoGrow'
			| 'fileManager'
			| string,
			{
				name: string;
				value: string | boolean | number;
				type: string;
			}
		>
		// endregion
	>;
	defaultValue: any;
	fields?: LookupTable<ContentTypeField>;
	values?: { label: string; value: string }[];
	helpText?: string;
	// localized: boolean;
	// disabled: boolean;
	// readOnly: boolean;
	// mapsTo: string;
	// mapsToType: string;
	// mapsToTarget: string;
	// editor: string;
}

export interface ContentTypeRepeatField extends ContentTypeField {
	fields: LookupTable<ContentTypeField>;
}

export interface NewContentTypeField extends ContentTypeField {
	NEW?: true;
}

export interface FormDefinitionPlugin {
	type: string;
	name: string;
	filename: string;
	pluginId: string;
}

export interface DataSource {
	id: string;
	type: string;
	title: string;
	interface: string;
	properties: LookupTable;
	plugin?: FormDefinitionPlugin;
}

export interface NewDataSource extends DataSource {
	NEW?: true;
}

export type LegacyComponentType = 'component' | 'page' | 'file';

export interface ContentType {
	id: string;
	name: string;
	description: string;
	type: LegacyComponentType;
	quickCreate: boolean;
	quickCreatePath: string;
	displayTemplate: string;
	mergeStrategy: string;
	// ∨∨∨ Added during TypeBuilder 2 ∨∨∨
	// icon
	hasJsController: boolean; // TODO: Should this one be the file name, like `thumbnailFileName`?
	thumbnailFileName: string;
	isHeadless: boolean; // TODO: Consider removing this property.
	// TODO: Renaming this property to something more meaningful. "Paths" of what?? e.g. allowedCreationPaths?
	//  Possibly split into `allowedTypeCreationBlacklist` and `allowedTypeCreationWhitelist`?
	//  `creationPathBlacklist`, `creationPathWhitelist`?
	paths: {
		excludes?: { pattern: string[] };
		includes?: { pattern: string[] };
	};
	'delete-dependencies': {
		'delete-dependency': {
			pattern: string;
			'remove-empty-folder': boolean;
		}[];
	};
	'copy-dependencies': {
		'copy-dependency': {
			pattern: string;
			target: string;
		}[];
	};
	previewable: boolean;
	// ^^^ Added during TypeBuilder 2 ^^^
	sections: ContentTypeSection[];
	fields: LookupTable<ContentTypeField>;
	dataSources: DataSource[];
}

/**
 * A ContentType that may be brand new (hasn't been stored) or existing. The `NEW` property present
 * denotes a new content type that hasn't been saved yet.
 **/
export interface PossibleContentTypeDraft extends ContentType {
	NEW?: true;
}

export interface ContentTypeBasicDetails {
	controller: boolean;
	imageThumbnail: string;
	[XmlKeys.templateNotRequired]: boolean;
	paths: {
		excludes: Array<{ pattern: string }>;
		includes: Array<{ pattern: string }>;
	};
}

export interface ContentTypeSection {
	// ∨∨∨ Added during TypeBuilder 2 ∨∨∨
	id: string;
	color: string;
	// ^^^ Added during TypeBuilder 2 ^^^
	title: string;
	fields: string[];
	description: string;
	expandByDefault: boolean;
}

export interface LegacyFormDefinitionProperty {
	label?: string; // => display name
	name: string; // => id
	type: string;
	value: string;
}

export interface LegacyFormDefinitionField {
	id: string;
	title: string;
	description: string;
	defaultValue: string;
	type: string;
	help: string;
	iceId: string;
	constraints: { constraint: LegacyFormDefinitionProperty | Array<LegacyFormDefinitionProperty> };
	properties: { property: LegacyFormDefinitionProperty | Array<LegacyFormDefinitionProperty> };
	fields?: { field: LegacyFormDefinitionField | Array<LegacyFormDefinitionField> };
	plugin: FormDefinitionPlugin;
	// Repeat groups carry these both at the top and inside "properties" (duplicated)
	minOccurs?: string;
	maxOccurs?: string;
}

export interface LegacyFormDefinitionSection {
	// ∨∨∨ Added during TypeBuilder 2 ∨∨∨
	color?: string;
	// ^^^ Added during TypeBuilder 2 ^^^
	defaultOpen: 'true' | 'false';
	description: string;
	fields: {
		field: LegacyFormDefinitionField | Array<LegacyFormDefinitionField>;
	};
	title: string;
}

// With the TypeBuilder 2, we added ids to sections
export interface LegacyFormDefinitionSectionWithId extends LegacyFormDefinitionSection {
	id: string;
}

export interface LegacyDataSource {
	id: string; // id within the form
	title: string; // display name for authors
	type: string; // data source id
	interface: string; // ?
	properties: { property: LegacyFormDefinitionProperty[] | LegacyFormDefinitionProperty };
	plugin?: FormDefinitionPlugin;
}

// Note: nearly identical to `LegacyFormDefinition`
export interface SerializeToXmlContentTypeStructure {
	'content-type': string;
	title: string;
	description: string;
	objectType: string;
	imageThumbnail: string;
	// ∨∨∨ config.xml ∨∨∨
	controller: 'true' | 'false';
	quickCreate: 'true' | 'false';
	quickCreatePath: string;
	paths: {
		excludes?: { pattern: string[] };
		includes?: { pattern: string[] };
	};
	'delete-dependencies': ContentType['delete-dependencies'];
	'copy-dependencies': ContentType['copy-dependencies'];
	// ^^^ config.xml ^^^
	// TODO: Can we move these to the root or drop `label` and `type`?
	properties: {
		property: [
			{
				name: 'display-template';
				value: string;
				label: 'Display Template';
				type: 'template';
			},
			{
				name: 'no-template-required';
				value: 'true' | 'false';
				label: 'No Template Required';
				type: 'boolean';
			},
			{
				name: 'merge-strategy';
				value: string;
				label: 'Merge Strategy';
				type: 'string';
			}
		];
	};
	sections: { section: Array<LegacyFormDefinitionSectionWithId> };
	datasources: { datasource: Array<LegacyDataSource> };
	previewable: boolean;
}

// Note: nearly identical to SerializeToXmlContentTypeObject
// TODO: Changes in TypeBuilder2 XML may require revisiting as this is likely a deserialized XML response.
//   If this is simply the backend deserializing *form-definition.xml*, we *might* be able to merge the two or for one to extend from the other.
export interface LegacyFormDefinition {
	// As returned by `/studio/api/1/services/api/1/site/get-configuration.json?site=${site}&path=/content-types/.../form-definition.xml`
	'content-type': string; // e.g. /page/home
	title: string; // e.g. Page - Home
	description: string; // e.g. ""
	objectType: string; // e.g. page
	imageThumbnail: string; // e.g. page-home.png
	quickCreate: 'true' | 'false';
	quickCreatePath: string; // e.g. /site/pages
	// ∨∨∨ config.xml ∨∨∨
	controller: 'true' | 'false';
	paths: ContentType['paths'];
	// ^^^ config.xml ^^^
	sections: { section: LegacyFormDefinitionSection | Array<LegacyFormDefinitionSection> };
	properties: { property: LegacyFormDefinitionProperty | Array<LegacyFormDefinitionProperty> };
	datasources: { datasource: LegacyDataSource | Array<LegacyDataSource> };
	previewable: string;
}

// As returned by `/studio/api/1/services/api/1/content/get-content-types.json?site=${site}`
export interface LegacyContentType {
	allowedRoles: string[];
	contentAsFolder: boolean;
	copyDepedencyPattern: string[];
	deleteDependencyPattern: string[];
	form: string; // The type id (legacyType.form === legacyType.name)
	formPath: string;
	imageThumbnail: string;
	label: string;
	lastUpdated: string;
	modelInstancePath: string;
	name: string; // The type id (legacyType.form === legacyType.name)
	noThumbnail: boolean;
	nodeRef: any;
	pathExcludes: string[];
	pathIncludes: string[];
	previewable: boolean;
	quickCreate: boolean;
	quickCreatePath: string;
	type: LegacyComponentType;
	useRoundedFolder: string;
}

export interface ComponentsDatasource extends LegacyDataSource {
	properties: LegacyDataSource['properties'] & {
		allowEmbedded: boolean;
		allowShared: boolean;
		baseBrowsePath: string;
		baseRepositoryPath: string;
		contentTypes: string;
		enableBrowse: boolean;
		enableSearch: boolean;
		tags: string;
	};
}

export default ContentType;
