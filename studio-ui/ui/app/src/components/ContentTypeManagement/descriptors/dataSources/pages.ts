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

import { immutableEmptyObject } from '../../../../utils/object';
import { createVirtualSection, DescriptorContentType } from '../../utils';
import { defineMessage } from 'react-intl';

export const pagesDataSourceDescriptor: DescriptorContentType = {
	id: 'pages',
	name: 'Pages',
	description: '',
	type: 'item',
	sections: [
		createVirtualSection({
			id: 'properties',
			title: defineMessage({ defaultMessage: 'Options' }),
			fields: [
				'allowEmbedded',
				'allowShared',
				'enableBrowse',
				'enableSearch',
				'baseRepoPath',
				'baseBrowsePath',
				'contentTypes',
				'tags',
				'sortBy',
				'sortOrder'
			]
		})
	],
	fields: {
		allowEmbedded: {
			id: 'allowEmbedded',
			type: 'boolean',
			name: defineMessage({ defaultMessage: 'Allow Embedded' }),
			defaultValue: true,
			validations: immutableEmptyObject
		},
		allowShared: {
			id: 'allowShared',
			type: 'boolean',
			name: defineMessage({ defaultMessage: 'Allow New Shared' }),
			defaultValue: true,
			validations: immutableEmptyObject
		},
		enableBrowse: {
			id: 'enableBrowse',
			type: 'boolean',
			name: defineMessage({ defaultMessage: 'Enable Browsing Shared' }),
			defaultValue: true,
			validations: immutableEmptyObject
		},
		enableSearch: {
			id: 'enableSearch',
			type: 'boolean',
			name: defineMessage({ defaultMessage: 'Enable Search' }),
			defaultValue: false,
			validations: immutableEmptyObject
		},
		baseRepoPath: {
			id: 'baseRepoPath',
			type: 'content-path-input',
			name: defineMessage({ defaultMessage: 'Path for New Items' }),
			defaultValue: '/site/website',
			validations: immutableEmptyObject
		},
		baseBrowsePath: {
			id: 'baseBrowsePath',
			type: 'content-path-input',
			name: defineMessage({ defaultMessage: 'Base Browse Path' }),
			defaultValue: '/site/website',
			validations: immutableEmptyObject
		},
		contentTypes: {
			id: 'contentTypes',
			type: 'contentTypes',
			name: defineMessage({ defaultMessage: 'Content Types' }),
			defaultValue: undefined,
			validations: immutableEmptyObject,
			properties: {
				type: { name: 'type', type: 'string', value: 'page' }
			}
		},
		tags: {
			id: 'tags',
			type: 'string',
			name: defineMessage({ defaultMessage: 'Tags' }),
			defaultValue: undefined,
			validations: immutableEmptyObject
		},
		sortBy: {
			id: 'sortBy',
			type: 'sort-dropdown',
			name: defineMessage({ defaultMessage: 'Sort By' }),
			defaultValue: '-AUTO-',
			validations: immutableEmptyObject,
			properties: {
				type: { name: 'type', type: 'string', value: 'sortBy' }
			}
		},
		sortOrder: {
			id: 'sortOrder',
			type: 'sort-dropdown',
			name: defineMessage({ defaultMessage: 'Sort Order' }),
			defaultValue: undefined,
			validations: immutableEmptyObject,
			properties: {
				type: { name: 'type', type: 'string', value: 'sortOrder' }
			}
		}
	}
};

export default pagesDataSourceDescriptor;
