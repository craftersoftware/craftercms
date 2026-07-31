/*
 * Copyright (C) 2007-2022 Crafter Software Corporation. All Rights Reserved.
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

import type { ComponentType } from 'react';
import WidgetRecord from './WidgetRecord';
import type { DataSourceBinding, DataSourceModule } from '../components/FormsEngine/dataSources/types';
import type { ControlProps } from '../components/FormsEngine/types';

/**
 * FE2 control contribution on a PluginDescriptor.
 * Map keys on `controls` must equal the control type id (`field.type`).
 */
export interface ControlPluginContribution {
	/** React control component; must accept ControlProps. */
	Component: ComponentType<ControlProps>;
	/** Optional; same shapes as built-in `controlDataSourceBindings` entries. */
	dataSourceBindings?: DataSourceBinding | readonly DataSourceBinding[];
}

export interface PluginDescriptor {
	/** Stable plugin identity; used for registry keys and duplicate detection — must be a non-empty string. */
	id: string;
	// name: string;
	// version: string;
	// description: string;
	// author: string;
	// logo: string;
	locales?: Record<string, object>;
	// apps: Array<{ route: string; widget: { id: string; configuration: any } }>;
	widgets?: Record<string, WidgetRecord>;
	scripts?: Array<string | object>;
	stylesheets?: Array<string | object>;
	/**
	 * Author-contributed helpers (lib-style). Stored on the registered descriptor;
	 * eager load without widgets is still an open follow-up — see plugins companion §9.
	 */
	utils?: Record<string, unknown>;
	/**
	 * FE2 data-source modules contributed by this plugin, keyed by DS type id.
	 * `registerPlugin` validates and installs each into the data-source module registry.
	 */
	dataSources?: Record<string, DataSourceModule>;
	/**
	 * FE2 control contributions, keyed by control type id (`field.type`).
	 * `registerPlugin` validates and installs each into the control contribution registry.
	 */
	controls?: Record<string, ControlPluginContribution>;
	// themes: Array<{ id: string; name: string; themeOptions: ThemeOptions[] }>;
}

export default PluginDescriptor;
