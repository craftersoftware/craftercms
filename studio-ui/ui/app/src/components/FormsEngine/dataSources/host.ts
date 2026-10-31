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
import {
	getPluginControlValidator,
	getPluginControlValueRetriever,
	getPluginControlValueSerializer,
	getRegisteredControlContribution
} from '../controls/registry';
import { dataSourceModuleRegistry, registerDataSourceModule } from './registry';
import { DATA_SOURCE_API_VERSION } from './types';
import { FormsEngineField } from '../components/FormsEngineField';
import { useFieldValue } from '../lib/formsEngineContext';
import {
	XML_ATTRIBUTE_PREFIX,
	XML_CDATA_KEY,
	XML_ITEM_LIST_ATTRIBUTE,
	XML_LIST_ITEM_KEY,
	XML_TEXT_KEY
} from '../lib/controlValueTypes';

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
 *
 * `FormsEngineField` is the field chrome built-in controls use (label, required/invalid
 * state, validity messages, field menu, inheritance notice). The host wraps plugin controls
 * in it by default. A contribution that sets `fieldChrome: false` renders bare and wraps its
 * input in `FormsEngineField` itself, using the `inputId` / `labelId` control props.
 *
 * `useFieldValue(fieldId)` is the supported way for plugin controls to access sibling
 * fields — e.g. a descriptor-declared additional field such as `{id}_tz` (date/time) or
 * `{id}_bk`. It returns `[value, setValue, exists]` (`exists` is `false` when the field
 * wasn't initialized, instead of throwing) and keeps the atom map and Jotai internal.
 * The hook must be the host's own instance, so it is exposed here rather than
 * imported/bundled by the plugin.
 */
export const formsEngineControlsHost = {
	registerDataSourceBindings: registerControlDataSourceBindings,
	getDataSourceBindings: getControlDataSourceBindings,
	getControl: getRegisteredControlContribution,
	getValueRetriever: getPluginControlValueRetriever,
	getValueSerializer: getPluginControlValueSerializer,
	getValidator: getPluginControlValidator,
	useFieldValue,
	FormsEngineField,
	/** Special keys a `valueSerializer` may use in the shape it returns. See the plugins doc. */
	xmlKeys: {
		attributePrefix: XML_ATTRIBUTE_PREFIX,
		cdata: XML_CDATA_KEY,
		text: XML_TEXT_KEY,
		listItem: XML_LIST_ITEM_KEY,
		itemListAttribute: XML_ITEM_LIST_ATTRIBUTE
	}
};
