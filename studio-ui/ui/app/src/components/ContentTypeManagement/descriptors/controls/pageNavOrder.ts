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

export const pageNavOrderDescriptor: DescriptorContentType = {
	id: 'page-nav-order',
	name: defineMessage({ defaultMessage: 'Page Order' }),
	description: defineMessage({ defaultMessage: 'Controls page ordering in navigation' }),
	sections: [
		createVirtualSection({
			id: 'properties',
			title: defineMessage({ defaultMessage: 'Options' }),
			fields: ['readonly']
		}),
		createVirtualSection({
			id: 'constraints',
			title: defineMessage({ defaultMessage: 'Constraints' }),
			fields: ['required']
		})
	],
	fields: {
		readonly: commonFieldPropertiesDescriptors['readonly'],
		required: commonFieldPropertiesDescriptors['required']
	},
	metadata: {
		// Root-only: placeInNav / orderDefault_f belong on the content type, not inside repeats.
		rootOnly: true,
		// FE1 stores nav sort order in this sibling tag; FE2 treats it as an additional field atom.
		additionalFields: ['orderDefault_f']
	}
};

export default pageNavOrderDescriptor;
