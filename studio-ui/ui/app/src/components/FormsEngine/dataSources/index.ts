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

/**
 * FormsEngine data-source public surface.
 *
 * Importing this barrel registers built-in modules once and (in development) warns on TB/FE module
 * gaps. Prefer granular imports in FE runtime when you do not want the registration side effect;
 * {@link loadDataSourceModule} also calls `registerBuiltInDataSourceModules` when consumers skip
 * this barrel.
 */

export * from './actionAdapters';
export * from './bindings';
export * from './completeness';
export * from './defineModule';
export * from './loader';
export * from './pathUtils';
export * from './registry';
export * from './services';
export * from './types';
export * from './useFieldDataSources';
export { registerBuiltInDataSourceModules, builtInDataSourceModules } from './modules';

import { checkBuiltInDataSourceRegistryCompleteness } from './completeness';
import { registerBuiltInDataSourceModules } from './modules';

// Side-effect: importing FormsEngine/dataSources registers built-ins once.
registerBuiltInDataSourceModules();

if (process.env.NODE_ENV !== 'production') {
	const report = checkBuiltInDataSourceRegistryCompleteness();
	if (!report.ok) {
		console.warn('[FormsEngine] Built-in data-source modules missing for TB descriptors:', report.missingModules);
	}
}
