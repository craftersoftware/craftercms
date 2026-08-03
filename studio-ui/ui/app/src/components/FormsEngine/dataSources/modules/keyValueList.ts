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

import { DATA_SOURCE_API_VERSION, type DataSourceListItem, type DataSourceModule } from '../types';
import { createInstanceFromRecord, defineDataSourceModule } from '../defineModule';
import { normalizeListItem, propString } from '../moduleHelpers';
import { asArray } from '../../../../utils/array';

function parseKeyValueOptions(raw: string): DataSourceListItem[] {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (cause) {
		throw new Error('Unable to parse key-value-list options JSON.', { cause });
	}
	return asArray(parsed as DataSourceListItem | DataSourceListItem[]).map((item, index) =>
		normalizeListItem(item, index, 'key-value-list options')
	);
}

export const keyValueListDataSourceModule: DataSourceModule = defineDataSourceModule({
	apiVersion: DATA_SOURCE_API_VERSION,
	type: 'key-value-list',
	interfaces: ['options'],
	capabilities: ['list'],
	create({ record }) {
		const optionsRaw = propString(record, 'options');
		return createInstanceFromRecord(record, keyValueListDataSourceModule, {
			capabilities: ['list'],
			getActions: () => [],
			async list() {
				if (!optionsRaw) {
					throw new Error(`Data source "${record.id}" (key-value-list) has no options property.`);
				}
				return parseKeyValueOptions(optionsRaw);
			}
		});
	}
});

export default keyValueListDataSourceModule;
