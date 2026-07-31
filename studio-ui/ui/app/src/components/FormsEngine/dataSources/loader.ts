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

import type { DataSource } from '../../../models/ContentType';
import { buildFileUrl, importPlugin } from '../../../services/plugin';
import { registerBuiltInDataSourceModules } from './modules';
import { dataSourceModuleRegistry, type DataSourceModuleRegistry } from './registry';
import type { DataSourceModule } from './types';

/**
 * Resolves a DataSourceModule for a form-definition record.
 *
 * Built-ins come from the registry. Plugin types are loaded through the shared
 * plugin system (`importPlugin` → `registerPlugin` → `descriptor.dataSources`),
 * then looked up by `record.type`. This file is not a parallel plugin loader.
 */
export async function loadDataSourceModule(
	siteId: string,
	record: DataSource,
	registry: DataSourceModuleRegistry = dataSourceModuleRegistry
): Promise<DataSourceModule> {
	// Built-ins must be present regardless of which entry point pulled the runtime in. Consumers
	// import the granular modules (not the `dataSources` barrel), so registration can't rely on it.
	if (registry === dataSourceModuleRegistry) registerBuiltInDataSourceModules();
	const registered = registry.get(record.type);
	if (registered) return registered;

	if (!record.plugin) {
		throw new Error(`No data-source module is registered for type "${record.type}".`);
	}

	const builder = {
		site: siteId,
		type: record.plugin.type,
		name: record.plugin.name,
		file: record.plugin.filename,
		id: record.plugin.pluginId
	};
	const url = buildFileUrl(builder);
	const plugin = await importPlugin(builder);
	const contributed = registry.get(record.type);
	if (!contributed) {
		throw new Error(
			`Plugin "${plugin.id}" loaded from "${url}" does not contribute data-source type "${record.type}". ` +
				`Add it to PluginDescriptor.dataSources (keyed by type id).`
		);
	}
	return contributed;
}
