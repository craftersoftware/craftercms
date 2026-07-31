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

import { getControlDataSourceBindings, registerControlDataSourceBindings } from './bindings';
import { getRegisteredControlContribution } from '../controls/registry';
import { dataSourceModuleRegistry, registerDataSourceModule } from './registry';
import { DATA_SOURCE_API_VERSION } from './types';

/**
 * Public runtime surface for the data-source *module registry* (built-ins and
 * plugin contributions). Instance-scoped services are supplied to
 * DataSourceModule.create().
 *
 * Authoring extensions ship as PluginDescriptor bundles; `registerPlugin`
 * installs `descriptor.dataSources` into this registry. Prefer
 * `importPlugin` / `registerPlugin` over calling `register` from plugin code.
 * See docs/type-builder-forms-engine-plugins.md §9.
 */
export const formsEngineDataSourcesHost = {
	apiVersion: DATA_SOURCE_API_VERSION,
	register: registerDataSourceModule,
	get: dataSourceModuleRegistry.get.bind(dataSourceModuleRegistry),
	getAll: dataSourceModuleRegistry.getAll.bind(dataSourceModuleRegistry)
};

/**
 * Public runtime surface for control-extension binding metadata and contributions.
 * Prefer contributing controls via `PluginDescriptor.controls` (loaded through
 * `importPlugin` / `registerPlugin`). Eager binding registration remains available
 * for UMD-style loaders.
 */
export const formsEngineControlsHost = {
	registerDataSourceBindings: registerControlDataSourceBindings,
	getDataSourceBindings: getControlDataSourceBindings,
	getControl: getRegisteredControlContribution
};
