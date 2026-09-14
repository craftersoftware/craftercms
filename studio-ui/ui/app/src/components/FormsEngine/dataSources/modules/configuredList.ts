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
import { fetchConfigurationDOM } from '../../../../services/configuration';
import { asArray } from '../../../../utils/array';
import { deserialize } from '../../../../utils/xml';
import { DATA_SOURCE_API_VERSION, type DataSourceListItem, type DataSourceModule } from '../types';
import { createInstanceFromRecord, defineDataSourceModule } from '../defineModule';
import { propString } from '../moduleHelpers';

function selectedDropdownValue(raw: string | undefined, fallback: string): string {
	if (!raw) return fallback;
	try {
		const parsed = JSON.parse(raw) as Array<{ value?: string; label?: string; selected?: boolean }>;
		const selected = asArray(parsed).find((opt) => opt?.selected);
		return String(selected?.value ?? selected?.label ?? fallback);
	} catch {
		return raw || fallback;
	}
}

function parseConfiguredListItems(doc: XMLDocument): DataSourceListItem[] {
	const root = deserialize(doc.documentElement) as Record<string, unknown>;
	// Legacy shape: <list><values><item key=".." value=".."/></values></list> or similar.
	const values =
		(root as { values?: { item?: unknown } }).values ??
		(root as { list?: { values?: { item?: unknown } } }).list?.values ??
		(root as { items?: { item?: unknown } }).items;
	if (!values) {
		throw new Error('Configured list XML did not contain a values/items collection.');
	}
	const items = asArray((values as { item?: unknown }).item);
	if (!items.length) {
		throw new Error('Configured list XML contains no items.');
	}
	return items.map((item, index) => {
		if (!item || typeof item !== 'object') {
			throw new Error(`Configured list item at index ${index} is invalid.`);
		}
		const record = item as Record<string, unknown>;
		const key = String(record.key ?? '');
		const value = String(record.value ?? '');
		if (!key && !value) {
			throw new Error(`Configured list item at index ${index} is missing key/value.`);
		}
		return { ...record, key, value };
	});
}

function sortListItems(items: DataSourceListItem[], sort: string): DataSourceListItem[] {
	if (!sort || sort === 'None' || sort === 'none') return items;
	const copy = items.slice();
	copy.sort((a, b) => {
		const av = String(a.value);
		const bv = String(b.value);
		if (av === bv) return 0;
		return av > bv ? 1 : -1;
	});
	if (sort === 'descending' || sort === 'Descending') {
		copy.reverse();
	}
	return copy;
}

export const configuredListDataSourceModule: DataSourceModule = defineDataSourceModule({
	apiVersion: DATA_SOURCE_API_VERSION,
	type: 'configured-list',
	interfaces: ['options'],
	capabilities: ['list'],
	create({ record }) {
		const listName = propString(record, 'listName').trim();
		const sort = selectedDropdownValue(propString(record, 'sort') || undefined, 'None');
		return createInstanceFromRecord(record, configuredListDataSourceModule, {
			capabilities: ['list'],
			getActions: () => [],
			async list(ctx) {
				if (!listName) {
					throw new Error(`Data source "${record.id}" (configured-list) requires listName.`);
				}
				const configPath = `/form-control-config/configured-lists/${listName}.xml`;
				const doc = await firstValueFrom(fetchConfigurationDOM(ctx.siteId, configPath, 'studio'));
				if (!doc?.documentElement) {
					throw new Error(`Configured list "${listName}" was empty or could not be loaded from ${configPath}.`);
				}
				return sortListItems(parseConfiguredListItems(doc), sort);
			}
		});
	}
});

export default configuredListDataSourceModule;
