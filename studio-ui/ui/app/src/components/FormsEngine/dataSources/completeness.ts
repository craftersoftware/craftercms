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

import { dataSourceDescriptors, type BuiltInDataSourceType } from '../../ContentTypeManagement/descriptors/dataSources';
import { dataSourceModuleRegistry } from './registry';
import { builtInDataSourceModules } from './modules';

/**
 * Diagnostic shape for TB descriptor ↔ FE module parity.
 * `ok` is true only when `missingModules` is empty (`extraModules` do not fail the check).
 */
export interface DataSourceRegistryCompletenessReport {
	descriptorTypes: string[];
	moduleTypes: string[];
	missingModules: string[];
	extraModules: string[];
	ok: boolean;
}

/**
 * Compares TB `dataSourceDescriptors` to FE built-in modules (+ the live registry).
 * Defaults ignore the dead `flash-desktop-upload` type. For CI / diagnostics, not runtime gating.
 */
export function checkBuiltInDataSourceRegistryCompleteness(
	options: { ignoreTypes?: readonly string[] } = {}
): DataSourceRegistryCompletenessReport {
	const ignore = new Set(options.ignoreTypes ?? ['flash-desktop-upload']);
	const descriptorTypes = (Object.keys(dataSourceDescriptors) as BuiltInDataSourceType[]).filter(
		(type) => !ignore.has(type)
	);
	const moduleTypes = builtInDataSourceModules.map((module) => module.type).filter((type) => !ignore.has(type));
	const moduleSet = new Set(moduleTypes);
	const descriptorSet = new Set(descriptorTypes);
	const missingModules = descriptorTypes.filter((type) => !moduleSet.has(type) && !dataSourceModuleRegistry.has(type));
	const extraModules = moduleTypes.filter((type) => !descriptorSet.has(type as BuiltInDataSourceType));
	return {
		descriptorTypes,
		moduleTypes,
		missingModules,
		extraModules,
		ok: missingModules.length === 0
	};
}
