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

// TODO: Why is internal name a control type? Doesn't seem to be in use.
// We may want to have a separate descriptor without postfixes (since there is no post fixes for internal name), but use
// the same control (in control map).

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
			fields: ['required', 'pattern']
		})
	],
	fields: {
		maxlength: {
			id: 'maxlength',
			type: 'int',
			name: defineMessage({ defaultMessage: 'Max Length' }),
			defaultValue: undefined,
			validations: immutableEmptyObject
		},
		readonly: commonFieldPropertiesDescriptors['readonly'],
		tokenize: commonFieldPropertiesDescriptors['tokenize'],
		escapeContent: {
			id: 'escapeContent',
			type: 'boolean',
			name: 'escapeContent',
			defaultValue: undefined,
			validations: immutableEmptyObject
		},
		required: commonFieldPropertiesDescriptors['required'],
		pattern: {
			id: 'pattern',
			type: 'string',
			name: defineMessage({ defaultMessage: 'Match Pattern' }),
			defaultValue: undefined,
			validations: immutableEmptyObject
		}
	},
	metadata: {
		rootOnly: true
	}
};

export default internalNameDescriptor;
