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
import { defineMessage } from 'react-intl';
import { commonFieldPropertiesDescriptors } from './commonDescriptors';

export const fileNameDescriptor: DescriptorContentType = {
	id: 'file-name',
	name: defineMessage({ defaultMessage: 'File Name' }),
	description: defineMessage({ defaultMessage: 'A slug (url)' }),
	sections: [
		createVirtualSection({
			id: 'properties',
			title: defineMessage({ defaultMessage: 'Options' }),
			fields: ['maxlength', 'readonly', 'allowEditWithoutWarning']
		})
	],
	fields: {
		maxlength: {
			id: 'maxlength',
			type: 'int',
			name: defineMessage({ defaultMessage: 'Max Length' }),
			defaultValue: 50,
			validations: immutableEmptyObject
		},
		readonly: commonFieldPropertiesDescriptors['readonly'],
		allowEditWithoutWarning: {
			id: 'allowEditWithoutWarning',
			type: 'boolean',
			name: defineMessage({ defaultMessage: 'Allow Edit Without Warning' }),
			defaultValue: undefined,
			validations: immutableEmptyObject
		}
	},
	metadata: {
		rootOnly: true
	}
};

export default fileNameDescriptor;
