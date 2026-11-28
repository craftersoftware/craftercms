/*
 * Copyright (C) 2007-2026 Crafter Software Corporation. All Rights Reserved.
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

import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ContentType } from '../../models/ContentType';
import type { DescriptorContentType } from './utils';

const { resolveCatalogDescriptor, resolveControlDescriptor, resolveDataSourceDescriptor } =
	await import('./catalogDescriptorLookup.ts');
const { controlDescriptors } = await import('./descriptors/controls/index.ts');
const { dataSourceDescriptors } = await import('./descriptors/dataSources/index.ts');
const { prepareSerializeToXmlTypeObject } = await import('./utils.ts');

function descriptor(id: string, marker: string, fieldType = 'string'): DescriptorContentType {
	return {
		id,
		name: marker,
		description: '',
		sections: [],
		fields: {
			enableSearch: {
				id: 'enableSearch',
				type: fieldType,
				name: marker,
				defaultValue: '',
				validations: {}
			}
		}
	};
}

describe('catalog descriptor precedence', () => {
	it('returns the built-in control when site config uses the same id', () => {
		const configDescriptor = descriptor('input', 'site override');
		const resolved = resolveControlDescriptor('input', configDescriptor);
		assert.equal(resolved, controlDescriptors.input);
		assert.equal(resolveCatalogDescriptor(controlDescriptors, 'input', configDescriptor), controlDescriptors.input);
	});

	it('returns the built-in data source when site config uses the same id', () => {
		const configDescriptor = descriptor('pages', 'site override', 'NOT-THE-BUILTIN');
		const resolved = resolveDataSourceDescriptor('pages', configDescriptor);
		assert.equal(resolved, dataSourceDescriptors.pages);
		assert.equal(
			resolveCatalogDescriptor(dataSourceDescriptors, 'pages', configDescriptor),
			dataSourceDescriptors.pages
		);
	});

	it('returns the config descriptor for a type that is not built in', () => {
		const control = descriptor('my-plugin-control', 'plugin control');
		const dataSource = descriptor('my-plugin-datasource', 'plugin data source');
		assert.equal(resolveControlDescriptor('my-plugin-control', control), control);
		assert.equal(resolveDataSourceDescriptor('my-plugin-datasource', dataSource), dataSource);
	});

	it('returns undefined when neither a built-in nor a config descriptor exists', () => {
		assert.equal(resolveControlDescriptor('missing-control', null), undefined);
		assert.equal(resolveDataSourceDescriptor('missing-datasource'), undefined);
	});

	it('serializes a built-in data source with the code descriptor when config overrides that id', () => {
		const type = {
			id: '/component/article',
			name: 'Article',
			description: '',
			type: 'component',
			sections: [],
			fields: {},
			dataSources: [
				{
					id: 'pagesDs',
					title: 'Pages',
					type: 'pages',
					interface: 'item',
					properties: { enableSearch: 'false' }
				}
			]
		} as ContentType;
		const serialized = prepareSerializeToXmlTypeObject(type, {
			controlDescriptors: {},
			dataSourceDescriptors: { pages: descriptor('pages', 'site override', 'NOT-THE-BUILTIN') }
		});
		const datasource = serialized.datasources.datasource;
		const entry = Array.isArray(datasource) ? datasource[0] : datasource;
		const properties = entry.properties.property;
		const enableSearch = (Array.isArray(properties) ? properties : [properties]).find(
			(property) => property.name === 'enableSearch'
		);
		assert.equal(enableSearch?.type, 'boolean');
	});
});
