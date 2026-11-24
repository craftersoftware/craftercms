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

import { createVirtualSection, DescriptorContentType } from '../../utils';
import { immutableEmptyObject } from '../../../../utils/object';
import { XmlKeys } from '../../../FormsEngine/lib/formConsts';
import { defineMessage } from 'react-intl';
import { commonFieldPropertiesDescriptors } from './commonDescriptors';

/**
 * Properties descriptor for the Internal Name system field.
 *
 * Internal Name is a system field that is stored in the content type XML with type `input` (not `internal-name`), so
 * this descriptor is never found by the stored field type. It defines which properties Type Builder lets you edit for
 * the field, and is selected by field identity (see `resolveFieldControlDescriptor`) when editing an existing field and
 * by `systemFieldsTypesMap` when inserting one.
 *
 * `required` is deliberately absent: the field is always required when the type defines it. FE1 hardcoded that, and
 * the Forms Engine minimum save requirements enforce it, so a toggle would have no effect. Any `required` constraint
 * already stored in the XML is left untouched. See craftersoftware/craftercms#9505.
 */
export const internalNameDescriptor: DescriptorContentType = {
	id: XmlKeys.internalName,
	name: defineMessage({ defaultMessage: 'Internal Name' }),
	description: defineMessage({
		defaultMessage: 'Internal name displayed for the item throughout the CMS (e.g. sidebar)'
	}),
	sections: [
		createVirtualSection({
			id: 'properties',
			title: defineMessage({ defaultMessage: 'Options' }),
			fields: ['maxlength', 'readonly', 'tokenize', 'escapeContent']
		}),
		createVirtualSection({
			id: 'constraints',
			title: defineMessage({ defaultMessage: 'Constraints' }),
			fields: ['pattern']
		})
	],
	// Defaults (maxlength, pattern) match the input descriptor on purpose: existing Internal Name fields were edited
	// through it, which showed and wrote these defaults. Leaving them undefined would change what open + save writes.
	fields: {
		maxlength: {
			id: 'maxlength',
			type: 'int',
			name: defineMessage({ defaultMessage: 'Max Length' }),
			defaultValue: 50,
			validations: immutableEmptyObject
		},
		readonly: commonFieldPropertiesDescriptors['readonly'],
		tokenize: commonFieldPropertiesDescriptors['tokenize'],
		escapeContent: {
			id: 'escapeContent',
			type: 'boolean',
			name: defineMessage({ defaultMessage: 'Escape Content' }),
			defaultValue: undefined,
			validations: immutableEmptyObject
		},
		pattern: {
			id: 'pattern',
			type: 'string',
			name: defineMessage({ defaultMessage: 'Match Pattern' }),
			defaultValue: '',
			validations: immutableEmptyObject
		}
	},
	metadata: {
		rootOnly: true
	}
};

export default internalNameDescriptor;
