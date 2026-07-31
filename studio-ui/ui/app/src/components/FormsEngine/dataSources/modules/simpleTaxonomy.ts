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

import { firstValueFrom } from 'rxjs';
import { fetchContentDOM } from '../../../../services/content';
import { asArray } from '../../../../utils/array';
import { deserialize } from '../../../../utils/xml';
import { DATA_SOURCE_API_VERSION, type DataSourceListItem, type DataSourceModule } from '../types';
import { createInstanceFromRecord, defineDataSourceModule } from '../defineModule';
import { expandPathOrRaw } from '../pathUtils';
import { propString } from '../moduleHelpers';

function itemsFromTaxonomyDoc(doc: XMLDocument): DataSourceListItem[] {
	const itemsNode = doc.querySelector(':scope > items');
	if (!itemsNode) {
		throw new Error('Taxonomy content is missing an <items> element.');
	}
	const deserialized = deserialize(itemsNode) as { items?: { item?: unknown } };
	const items = asArray(deserialized?.items?.item);
	return items.map((item, index) => {
		if (!item || typeof item !== 'object') {
			throw new Error(`Taxonomy item at index ${index} is invalid.`);
		}
		const record = item as Record<string, unknown>;
		const key = String(record.key ?? '');
		const value = String(record.value ?? '');
		if (!key && !value) {
			throw new Error(`Taxonomy item at index ${index} is missing key/value.`);
		}
		return { ...record, key, value };
	});
}

export const simpleTaxonomyDataSourceModule: DataSourceModule = defineDataSourceModule({
	apiVersion: DATA_SOURCE_API_VERSION,
	type: 'simpleTaxonomy',
	interfaces: ['options'],
	capabilities: ['list'],
	create({ record }) {
		const componentPath = propString(record, 'componentPath');
		return createInstanceFromRecord(record, simpleTaxonomyDataSourceModule, {
			capabilities: ['list'],
			getActions: () => [],
			async list(ctx) {
				if (!componentPath) {
					throw new Error(`Data source "${record.id}" (simpleTaxonomy) requires componentPath.`);
				}
				const path = expandPathOrRaw(ctx, componentPath);
				const doc = await firstValueFrom(fetchContentDOM(ctx.siteId, path));
				return itemsFromTaxonomyDoc(doc);
			}
		});
	}
});

export default simpleTaxonomyDataSourceModule;
