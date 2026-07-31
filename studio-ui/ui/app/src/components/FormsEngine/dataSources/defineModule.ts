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
import type { DataSourceInstance, DataSourceModule } from './types';

/**
 * Identity helper that types an object literal as {@link DataSourceModule} without a cast.
 *
 * Does not register the module — pair with {@link registerDataSourceModule} for built-ins, or
 * contribute via `PluginDescriptor.dataSources` + `registerPlugin` for plugins. Use at export
 * sites so the IDE checks `apiVersion`, `interfaces`, `capabilities`, and `create` as you write.
 *
 * Equivalent to `satisfies DataSourceModule` when no separate `: DataSourceModule` annotation is
 * present; call sites may keep both for consistency with other module files.
 */
export function defineDataSourceModule(module: DataSourceModule): DataSourceModule {
	return module;
}

type InstanceExtras = Pick<DataSourceInstance, 'getActions'> &
	Partial<Pick<DataSourceInstance, 'interfaces' | 'capabilities' | 'list' | 'edit' | 'refreshItem' | 'flags'>>;

/**
 * Builds a {@link DataSourceInstance} from the form-definition record + module metadata.
 *
 * Fills identity (`id` / `title` from the record, `type` / default `interfaces` / `capabilities`
 * from the module) and merges runtime hooks from `extras`. Prefer this over hand-rolling instances
 * so TB config and FE module metadata stay aligned; `extras` may narrow interfaces/capabilities or
 * attach `list` / `edit` / `refreshItem` / `flags` when the instance differs from the module defaults.
 */
export function createInstanceFromRecord(
	record: DataSource,
	module: DataSourceModule,
	extras: InstanceExtras
): DataSourceInstance {
	return {
		id: record.id,
		type: module.type,
		title: record.title,
		interfaces: extras.interfaces ?? module.interfaces,
		capabilities: extras.capabilities ?? module.capabilities,
		getActions: extras.getActions,
		list: extras.list,
		edit: extras.edit,
		refreshItem: extras.refreshItem,
		flags: extras.flags
	};
}
