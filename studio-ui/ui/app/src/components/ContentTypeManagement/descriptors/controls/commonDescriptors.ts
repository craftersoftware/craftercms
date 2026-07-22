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

import LookupTable from '../../../../models/LookupTable';
import { ContentTypeField } from '../../../../models';
import { XmlKeys } from '../../../FormsEngine/lib/formConsts';
import { immutableEmptyObject } from '../../../../utils/object';
import { createVirtualSection, DescriptorContentType, DescriptorField } from '../../utils';
import { defineMessage } from 'react-intl';

const dataSourceRootProperties = ['id', 'type', 'title', 'interface'];

export const systemFieldsSection = createVirtualSection({
	title: 'System Fields',
	fields: [XmlKeys.modelId, XmlKeys.fileName, XmlKeys.internalName, XmlKeys.disabled, XmlKeys.placeInNav]
});

export const systemFieldsDescriptors: LookupTable<ContentTypeField> = {
	[XmlKeys.modelId]: {
		id: XmlKeys.modelId,
		type: 'label',
		name: 'Unique Identifier',
		defaultValue: undefined,
		validations: immutableEmptyObject
	},
	[XmlKeys.fileName]: {
		id: XmlKeys.fileName,
		type: 'file-name',
		name: 'Page URL',
		defaultValue: undefined,
		validations: immutableEmptyObject
	},
	[XmlKeys.internalName]: {
		id: XmlKeys.internalName,
		type: 'input',
		name: 'Internal Name',
		defaultValue: undefined,
		validations: immutableEmptyObject
	},
	[XmlKeys.disabled]: {
		id: XmlKeys.disabled,
		type: 'boolean',
		name: 'Disabled',
		defaultValue: undefined,
		validations: immutableEmptyObject
	},
	[XmlKeys.placeInNav]: {
		id: XmlKeys.placeInNav,
		type: 'page-nav-order',
		name: 'Place in Navigation',
		defaultValue: undefined,
		validations: immutableEmptyObject
	}
};

export const defaultDataSourcesSection = createVirtualSection({
	id: `typeDataSourceSection`,
	title: 'Data Sources',
	fields: []
});

// Fields that are common to all controls, always rendered at the top of the controls.
export const commonControlFieldsDescriptors: LookupTable<DescriptorField> = {
	title: {
		id: 'title',
		type: 'string',
		name: defineMessage({ defaultMessage: 'Title' }),
		defaultValue: undefined,
		validations: {
			required: { id: 'required', level: 'required', value: true }
		}
	},
	id: {
		id: 'id',
		type: 'variable',
		name: defineMessage({ defaultMessage: 'Variable Name' }),
		defaultValue: undefined,
		validations: {
			required: { id: 'required', level: 'required', value: true }
		}
	},
	description: {
		id: 'description',
		type: 'textarea',
		name: defineMessage({ defaultMessage: 'Description' }),
		description: defineMessage({ defaultMessage: 'A description shown to the user on the form' }),
		defaultValue: undefined,
		validations: immutableEmptyObject
	},
	help: {
		id: 'help',
		type: 'rte',
		name: defineMessage({ defaultMessage: 'Help' }),
		description: defineMessage({ defaultMessage: 'An expanded description or help text with rich text capabilities' }),
		defaultValue: undefined,
		validations: immutableEmptyObject
	},
	defaultValue: {
		id: 'defaultValue',
		type: 'textarea',
		name: defineMessage({ defaultMessage: 'Default Value' }),
		defaultValue: undefined,
		validations: immutableEmptyObject
	}
};

// Fields that some controls have in common. Reused in control descriptors.
export const commonFieldPropertiesDescriptors: LookupTable<DescriptorField> = {
	tokenize: {
		id: 'tokenize',
		type: 'boolean',
		name: defineMessage({ defaultMessage: 'Tokenize for Indexing' }),
		defaultValue: undefined,
		validations: immutableEmptyObject
	},
	readonly: {
		id: 'readonly',
		type: 'boolean',
		name: defineMessage({ defaultMessage: 'Read Only' }),
		defaultValue: undefined,
		validations: immutableEmptyObject
	},
	required: {
		id: 'required',
		type: 'boolean',
		name: defineMessage({ defaultMessage: 'Required' }),
		defaultValue: false,
		validations: immutableEmptyObject
	}
};

export const typeBasicDetailsDescriptor: DescriptorContentType = {
	id: 'typeBasicDetailsDescriptor',
	name: defineMessage({ defaultMessage: 'Content Type Properties' }),
	description: '',
	sections: [
		createVirtualSection({
			id: 'properties',
			title: defineMessage({ defaultMessage: 'Basic Properties' }),
			fields: ['id', 'name', 'description', 'type', 'thumbnailFileName', 'mergeStrategy']
		}),
		createVirtualSection({
			id: 'quickCreate',
			title: defineMessage({ defaultMessage: 'Quick Create' }),
			fields: ['quickCreate', 'quickCreatePath']
		}),
		createVirtualSection({
			id: 'rendering',
			title: defineMessage({ defaultMessage: 'Rendering' }),
			fields: ['hasJsController', 'displayTemplate', 'isHeadless']
		}),
		// This section and paths field won't be available until 'config.xml' is removed from the content type.
		createVirtualSection({
			id: 'allowedDestinations',
			title: defineMessage({ defaultMessage: 'Allowed Destinations' }),
			fields: ['paths', 'delete-dependencies', 'copy-dependencies', 'previewable']
		})
	],
	fields: {
		id: {
			id: 'id',
			type: 'read-only-value',
			name: defineMessage({ defaultMessage: 'ID' }),
			description: '',
			helpText: '',
			defaultValue: undefined,
			validations: immutableEmptyObject
		},
		name: {
			id: 'name',
			type: 'string',
			name: defineMessage({ defaultMessage: 'Name' }),
			description: '',
			helpText: '',
			defaultValue: undefined,
			validations: immutableEmptyObject
		},
		description: {
			id: 'description',
			type: 'textarea',
			name: defineMessage({ defaultMessage: 'Description' }),
			description: '',
			helpText: '',
			defaultValue: undefined,
			validations: immutableEmptyObject
		},
		type: {
			id: 'type',
			type: 'read-only-value',
			name: defineMessage({ defaultMessage: 'Archetype' }),
			description: '',
			helpText: '',
			defaultValue: undefined,
			validations: immutableEmptyObject
		},
		quickCreate: {
			id: 'quickCreate',
			type: 'boolean',
			name: defineMessage({ defaultMessage: 'Enable Quick Create' }),
			description: '',
			helpText: '',
			defaultValue: undefined,
			validations: immutableEmptyObject
		},
		quickCreatePath: {
			id: 'quickCreatePath',
			type: 'path-with-macro-creator',
			name: defineMessage({ defaultMessage: 'Destination Path Pattern' }),
			description: '',
			helpText: '',
			defaultValue: undefined,
			validations: immutableEmptyObject
		},
		displayTemplate: {
			id: 'displayTemplate',
			type: 'template-selector',
			name: defineMessage({ defaultMessage: 'Display Template' }),
			description: '',
			helpText: '',
			defaultValue: undefined,
			validations: immutableEmptyObject
		},
		mergeStrategy: {
			id: 'mergeStrategy',
			type: 'merge-strategy-selector',
			name: defineMessage({ defaultMessage: 'Merge Strategy' }),
			description: defineMessage({ defaultMessage: 'The inheritance pattern to use with content of this type' }),
			helpText: '',
			defaultValue: undefined,
			validations: immutableEmptyObject
		},
		hasJsController: {
			id: 'hasJsController',
			type: 'type-js-controller-selector',
			name: defineMessage({ defaultMessage: 'Client-side Controller' }),
			description: '',
			helpText: '',
			defaultValue: undefined,
			validations: immutableEmptyObject
		},
		thumbnailFileName: {
			id: 'thumbnailFileName',
			type: 'type-image-selector',
			name: defineMessage({ defaultMessage: 'Thumbnail Image File Name' }),
			description: '',
			helpText: '',
			defaultValue: undefined,
			validations: immutableEmptyObject
		},
		isHeadless: {
			id: 'isHeadless',
			type: 'boolean',
			name: defineMessage({ defaultMessage: 'Is Headless Type' }),
			description: defineMessage({
				defaultMessage:
					'Check this to authorize this content type to leave the display template field empty as it is a headless type'
			}),
			helpText: '',
			defaultValue: undefined,
			validations: immutableEmptyObject
		},
		/* This field is for the destination paths of the content type. It won't be available until 'config.xml' is removed
		from the content type. Currently, `config.xml` can't be removed yet, since the back end still uses properties like
		`form`, `thumbnail`, even `paths`. */
		paths: {
			id: 'paths',
			type: 'type-destination-paths-selector',
			name: defineMessage({ defaultMessage: 'Paths' }),
			description: '',
			helpText: '',
			defaultValue: {
				includes: { pattern: [] },
				excludes: { pattern: [] }
			},
			validations: immutableEmptyObject
		},
		'delete-dependencies': {
			id: 'delete-dependencies',
			type: 'delete-dependencies',
			name: defineMessage({ defaultMessage: 'Delete References' }),
			description: '',
			helpText: '',
			defaultValue: { 'delete-dependency': [] },
			validations: immutableEmptyObject
		},
		'copy-dependencies': {
			id: 'copy-dependencies',
			type: 'copy-dependencies',
			name: defineMessage({ defaultMessage: 'Copy References' }),
			description: '',
			helpText: '',
			defaultValue: { 'copy-dependency': [] },
			validations: immutableEmptyObject
		},
		previewable: {
			id: 'previewable',
			type: 'boolean',
			name: defineMessage({ defaultMessage: 'Previewable' }),
			description: undefined,
			helpText: '',
			defaultValue: undefined,
			validations: immutableEmptyObject
		}
	}
};

export const sectionDescriptor: DescriptorContentType = {
	id: 'sectionDescriptor',
	name: defineMessage({ defaultMessage: 'Section Properties' }),
	description: null,
	sections: [
		createVirtualSection({
			id: 'properties',
			title: defineMessage({ defaultMessage: 'Basic Properties' }),
			fields: ['title', 'color', 'description', 'expandByDefault']
		})
	],
	fields: {
		title: {
			id: 'title',
			type: 'string',
			name: defineMessage({ defaultMessage: 'Title' }),
			description: '',
			helpText: '',
			defaultValue: undefined,
			validations: immutableEmptyObject
		},
		description: {
			id: 'description',
			type: 'textarea',
			name: defineMessage({ defaultMessage: 'Description' }),
			description: '',
			helpText: '',
			defaultValue: undefined,
			validations: immutableEmptyObject
		},
		color: {
			id: 'color',
			type: 'colorPicker',
			name: defineMessage({ defaultMessage: 'Color' }),
			description: defineMessage({
				defaultMessage:
					'Pick the color that this section should feature in the form. A small amount of transparency can help with dark mode.'
			}),
			helpText: '',
			defaultValue: undefined,
			validations: immutableEmptyObject,
			properties: {
				alpha: {
					name: 'Alpha',
					value: true,
					type: 'boolean'
				},
				format: {
					name: 'Format',
					value: 'rgb',
					type: 'string'
				}
			}
		},
		expandByDefault: {
			id: 'expandByDefault',
			type: 'boolean',
			name: defineMessage({ defaultMessage: 'Expand by default' }),
			description: defineMessage({
				defaultMessage: 'Check this to show the section expanded when the content type is displayed in the content form'
			}),
			helpText: '',
			defaultValue: undefined,
			validations: immutableEmptyObject
		}
	}
};
