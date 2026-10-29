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

export const nodeSelectorDescriptor: DescriptorContentType = {
	id: 'node-selector',
	name: defineMessage({ defaultMessage: 'Item Selector' }),
	description: defineMessage({ defaultMessage: 'Content item selection' }),
	sections: [
		createVirtualSection({
			id: 'properties',
			title: defineMessage({ defaultMessage: 'Options' }),
			fields: ['minSize', 'maxSize', 'itemManager', 'readonly', 'disableFlattening', 'useSingleValueFilename', 'useMVS']
		}),
		createVirtualSection({
			id: 'constraints',
			title: defineMessage({ defaultMessage: 'Constraints' }),
			fields: ['allowDuplicates']
		})
	],
	fields: {
		minSize: {
			id: 'minSize',
			type: 'int',
			name: defineMessage({ defaultMessage: 'Minimum Size' }),
			defaultValue: undefined,
			// 0 is no minimum. See utils/countLimits.ts.
			validations: {
				itemCount: createValidation('itemCount', { role: 'min', partner: 'maxSize' })
			}
		},
		maxSize: {
			id: 'maxSize',
			type: 'int',
			name: defineMessage({ defaultMessage: 'Maximum Size' }),
			description: defineMessage({
				defaultMessage: 'Leave blank for no maximum. The value must be an integer of 1 or more.'
			}),
			defaultValue: undefined,
			// 0 is not accepted. See utils/countLimits.ts.
			validations: {
				itemCount: createValidation('itemCount', { role: 'max', partner: 'minSize' })
			}
		},
		itemManager: {
			id: 'itemManager',
			type: 'datasource:item',
			name: defineMessage({ defaultMessage: 'Item Manager' }),
			defaultValue: undefined,
			validations: {
				type: createValidation('type', 'item')
			}
		},
		readonly: commonFieldPropertiesDescriptors['readonly'],
		disableFlattening: {
			id: 'disableFlattening',
			type: 'boolean',
			name: defineMessage({ defaultMessage: 'Disable Flattening for Search' }),
			defaultValue: undefined,
			validations: immutableEmptyObject
		},
		useSingleValueFilename: {
			id: 'useSingleValueFilename',
			type: 'boolean',
			name: defineMessage({ defaultMessage: 'Use single value filename (backward compat)' }),
			defaultValue: undefined,
			validations: immutableEmptyObject
		},
		useMVS: {
			id: 'useMVS',
			type: 'boolean',
			name: defineMessage({ defaultMessage: 'Use _mvs postfix (backward compat)' }),
			defaultValue: undefined,
			validations: immutableEmptyObject
		},
		allowDuplicates: {
			id: 'allowDuplicates',
			type: 'boolean',
			name: defineMessage({ defaultMessage: 'Allow Duplicates' }),
			defaultValue: undefined,
			validations: immutableEmptyObject
		}
	},
	metadata: {
		suffixes: ['_o']
	}
};

export default nodeSelectorDescriptor;
