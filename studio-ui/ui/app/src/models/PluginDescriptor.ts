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
import type { SxProps, Theme } from '@mui/material/styles';
import WidgetRecord from './WidgetRecord';
import type { DataSourceBinding, DataSourceModule } from '../components/FormsEngine/dataSources/types';
import type { AnyValue, ControlProps } from '../components/FormsEngine/types';
import type { ValueRetriever, ValueSerializer } from '../components/FormsEngine/lib/controlValueTypes';
import type { Validator } from '../components/FormsEngine/lib/validators';

/**
 * FE2 control contribution on a PluginDescriptor.
 * Map keys on `controls` must equal the control type id (`field.type`).
 */
export interface ControlPluginContribution<V = unknown> {
	/** React control component; must accept ControlProps. */
	Component: ComponentType<ControlProps<V>>;
	/**
	 * Whether the host wraps `Component` in `FormsEngineField` (label, required and invalid state, validity
	 * messages, field menu). Defaults to `true`. Set `false` to render the component bare and wrap it yourself
	 * with `craftercms.formsEngine.controls.FormsEngineField`, using the `inputId` and `labelId` props.
	 */
	fieldChrome?: boolean;
	/** `sx` for the default `FormsEngineField` wrapper. Ignored when `fieldChrome` is `false`. */
	fieldSx?: SxProps<Theme>;
	/** Optional; same shapes as built-in `controlDataSourceBindings` entries. */
	dataSourceBindings?: DataSourceBinding | readonly DataSourceBinding[];
	/**
	 * Optional XML → form value conversion for this control type.
	 * Must be registered before form bootstrap parses content (FE preloads plugin locators).
	 * Falls back to identity (pass-through) when omitted.
	 */
	valueRetriever?: ValueRetriever<V>;
	/**
	 * Optional form value → XML-serialiser shape for this control type.
	 * Used on save via `valueSerializers`; falls back to pass-through when omitted.
	 */
	valueSerializer?: ValueSerializer<V>;
	/**
	 * Optional type-specific validator for this control type.
	 * Required/empty checks remain host-owned in `validateFieldValue`.
	 * FE preloads plugin locators before form bootstrap so validators are registered in time.
	 */
	validator?: Validator<V>;
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
	 * The map holds contributions of different value types, so it does not tie an entry's `V` to its component
	 * and hooks. Check an entry with `satisfies ControlPluginContribution<V>`.
	 */
	controls?: Record<string, ControlPluginContribution<AnyValue>>;
	// themes: Array<{ id: string; name: string; themeOptions: ThemeOptions[] }>;
}

export default PluginDescriptor;
