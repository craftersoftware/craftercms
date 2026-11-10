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
import { defineMessage } from 'react-intl';
import { commonFieldPropertiesDescriptors } from './commonDescriptors';

export const forceHttpsDescriptor: DescriptorContentType = {
	id: 'forcehttps',
	name: defineMessage({ defaultMessage: 'Force HTTPS' }),
	description: defineMessage({ defaultMessage: 'Force HTTPS protocol' }),
	sections: [
		createVirtualSection({
			id: 'properties',
			title: defineMessage({ defaultMessage: 'Options' }),
			fields: ['readonly']
		})
	],
	fields: {
		id: {
			id: 'id',
			type: 'variable',
			name: defineMessage({ defaultMessage: 'Variable Name' }),
			defaultValue: 'forceHttps',
			validations: {
				required: { id: 'required', level: 'required', value: true }
			},
			properties: {
				readonly: { name: 'readonly', type: 'boolean', value: true }
			}
		},
		readonly: commonFieldPropertiesDescriptors['readonly']
	},
	metadata: {
		rootOnly: true
	}
};

export default forceHttpsDescriptor;
