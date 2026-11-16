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

// TODO: Why is disabled a control type? Doesn't seem to be in use.
export const disabledDescriptor: DescriptorContentType = {
	id: 'disabled',
	name: defineMessage({ defaultMessage: 'Disabled' }),
	description: defineMessage({ defaultMessage: 'Disabled field' }),
	sections: [
		createVirtualSection({
			id: 'properties',
			title: defineMessage({ defaultMessage: 'Options' }),
			fields: ['readonly']
		})
	],
	fields: {
		readonly: commonFieldPropertiesDescriptors['readonly']
	},
	metadata: {
		rootOnly: true
	}
};

export default disabledDescriptor;
