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

import { DATA_SOURCE_API_VERSION, type DataSourceModule } from './types';

/**
 * Runtime gate for built-in and plugin module contributions.
 *
 * Asserts `apiVersion`, a non-empty `type`, at least one interface, a `capabilities` array, and
 * `create()`. Call before registry insert so bad plugins fail at load time instead of during field
 * resolve.
 */
export function validateDataSourceModule(module: unknown): asserts module is DataSourceModule {
	if (!module || typeof module !== 'object') {
		throw new TypeError('A data-source module must export an object.');
	}
	const candidate = module as Partial<DataSourceModule>;
	if (candidate.apiVersion !== DATA_SOURCE_API_VERSION) {
		throw new TypeError(
			`Unsupported data-source API version "${String(candidate.apiVersion)}"; expected ${DATA_SOURCE_API_VERSION}.`
		);
	}
	if (!candidate.type || typeof candidate.type !== 'string') {
		throw new TypeError('A data-source module must declare a non-empty string "type".');
	}
	if (!Array.isArray(candidate.interfaces) || candidate.interfaces.length === 0) {
		throw new TypeError(`Data-source module "${candidate.type}" must declare at least one interface.`);
	}
	if (!Array.isArray(candidate.capabilities)) {
		throw new TypeError(`Data-source module "${candidate.type}" must declare its capabilities.`);
	}
	if (typeof candidate.create !== 'function') {
		throw new TypeError(`Data-source module "${candidate.type}" must implement create().`);
	}
}

/**
 * In-memory map of DS type id → {@link DataSourceModule}.
 *
 * One registration per type (a second write throws). Separates “what modules exist” from “how a
 * field’s records become instances” (`loadDataSourceModule` / `resolveFieldDataSources`).
 */
export class DataSourceModuleRegistry {
	readonly #modules = new Map<string, DataSourceModule>();

	register(module: DataSourceModule): void {
		validateDataSourceModule(module);
		if (this.#modules.has(module.type)) {
			throw new Error(`A data-source module is already registered for type "${module.type}".`);
		}
		this.#modules.set(module.type, module);
	}

	has(type: string): boolean {
		return this.#modules.has(type);
	}

	get(type: string): DataSourceModule | undefined {
		return this.#modules.get(type);
	}

	getAll(): readonly DataSourceModule[] {
		return Array.from(this.#modules.values());
	}
}

/** Process-wide singleton used by built-ins, `importPlugin` / `registerPlugin`, and FE hosts. */
export const dataSourceModuleRegistry = new DataSourceModuleRegistry();

/**
 * Registers a module on {@link dataSourceModuleRegistry}.
 *
 * Prefer `PluginDescriptor.dataSources` + `registerPlugin` for plugins; use this for Studio-shipped
 * modules and tests.
 */
export function registerDataSourceModule(module: DataSourceModule): void {
	dataSourceModuleRegistry.register(module);
}
