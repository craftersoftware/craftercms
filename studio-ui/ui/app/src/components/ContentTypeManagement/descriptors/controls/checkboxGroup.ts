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

import { createValidation, createVirtualSection, DescriptorContentType } from '../../utils';
import { immutableEmptyObject } from '../../../../utils/object';
import { defineMessage } from 'react-intl';
import { commonFieldPropertiesDescriptors } from './commonDescriptors';

export const checkboxGroupDescriptor: DescriptorContentType = {
	id: 'checkbox-group',
	name: defineMessage({ defaultMessage: 'Grouped Checkboxes' }),
	description: defineMessage({ defaultMessage: 'Multiple checkbox inputs' }),
	sections: [
		createVirtualSection({
			id: 'properties',
			title: defineMessage({ defaultMessage: 'Options' }),
			fields: ['datasource', 'selectAll', 'listDirection', 'readonly']
		}),
		createVirtualSection({
			id: 'constraints',
			title: defineMessage({ defaultMessage: 'Constraints' }),
			fields: ['minSize']
		})
	],
	fields: {
		datasource: {
			id: 'datasource',
			type: 'datasource:item:singleSelection',
			name: defineMessage({ defaultMessage: 'Data Source' }),
			defaultValue: undefined,
			validations: {
				type: createValidation('type', 'item')
			}
		},
		selectAll: {
			id: 'selectAll',
			type: 'boolean',
			name: defineMessage({ defaultMessage: 'Show select all' }),
			defaultValue: undefined,
			validations: immutableEmptyObject
		},
		listDirection: {
			id: 'listDirection',
			type: 'dropdown-static-values',
			name: defineMessage({ defaultMessage: 'List Direction' }),
			defaultValue: `[
				{
					"value": "horizontal",
					"label": "Horizontal",
					"selected": true
				},
				{
					"value": "vertical",
					"label": "Vertical",
					"selected": false
				}
			]`,
			validations: immutableEmptyObject
		},
		readonly: commonFieldPropertiesDescriptors['readonly'],
		minSize: {
			id: 'minSize',
			type: 'int',
			name: defineMessage({ defaultMessage: 'Minimum Selected' }),
			description: defineMessage({ defaultMessage: 'Enter 0 or leave blank for no minimum.' }),
			defaultValue: undefined,
			// See utils/countLimits.ts.
			validations: {
				itemCount: createValidation('itemCount', { role: 'min' })
			}
		}
	},
	metadata: {
		suffixes: ['_o']
	}
};

export default checkboxGroupDescriptor;
