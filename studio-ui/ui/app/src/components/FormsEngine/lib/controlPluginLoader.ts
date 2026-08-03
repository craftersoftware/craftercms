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

import { type ComponentType, use } from 'react';
import type { FormDefinitionPlugin } from '../../../models/ContentType';
import type PluginDescriptor from '../../../models/PluginDescriptor';
import { buildFileUrl, importPlugin } from '../../../services/plugin';
import { getRegisteredControlContribution } from '../controls/registry';
import type { DataSourceBinding } from '../dataSources/types';
import type { ControlProps } from '../types';

export interface LoadedControlPlugin {
	/** Resolved control Component + bindings; `url` is the plugin file URL used for cache/errors. */
	Component: ComponentType<ControlProps>;
	bindings: readonly DataSourceBinding[];
	url: string;
}

/** Cache of in-flight / completed importPlugin calls, keyed by plugin file URL. */
const controlPluginCache = new Map<string, Promise<PluginDescriptor>>();

/** Cache of final LoadedControlPlugin promises, keyed by plugin URL + control type. */
const loadedControlPluginCache = new Map<string, Promise<LoadedControlPlugin>>();

function loadedCacheKey(url: string, controlType: string): string {
	return `${url}::${controlType}`;
}

/** Builds the Studio plugin file URL for a form-definition plugin ref (same shape as DS plugin load). */
export function buildControlPluginUrl(siteId: string, plugin: FormDefinitionPlugin): string {
	return buildFileUrl(siteId, plugin.type, plugin.name, plugin.filename, plugin.pluginId);
}

/**
 * Resolves a plugin control for `controlType` (`field.type`).
 *
 * Loads through the shared plugin system (`importPlugin` → `registerPlugin` →
 * `descriptor.controls`), then looks up the contribution by control type.
 * Cached by plugin file URL so one bundle can contribute multiple controls.
 * The final {@link LoadedControlPlugin} promise is also cached by URL + control type
 * so Suspense/`use` sees a stable promise across renders.
 * On miss after load, returns `errorComponent` instead of throwing so the form stays open.
 */
export function loadControlPluginModule(
	siteId: string,
	plugin: FormDefinitionPlugin,
	controlType: string,
	errorComponent: ComponentType<ControlProps>
): Promise<LoadedControlPlugin> {
	const builder = {
		site: siteId,
		type: plugin.type,
		name: plugin.name,
		file: plugin.filename,
		id: plugin.pluginId
	};
	const url = buildFileUrl(builder);
	const cacheKey = loadedCacheKey(url, controlType);

	const cached = loadedControlPluginCache.get(cacheKey);
	if (cached) return cached;

	// Fast path only when the registered contribution already belongs to this plugin.
	// A global hit from a different plugin (e.g. widget host) must not skip loading the
	// field's locator — that would render the wrong component for this field.
	const existing = getRegisteredControlContribution(controlType);
	if (existing && existing.pluginId === plugin.pluginId) {
		const resolved = Promise.resolve({ Component: existing.Component, bindings: existing.bindings, url });
		loadedControlPluginCache.set(cacheKey, resolved);
		return resolved;
	}

	let loading = controlPluginCache.get(url);
	if (!loading) {
		loading = importPlugin(builder).catch((reason) => {
			controlPluginCache.delete(url);
			loadedControlPluginCache.delete(cacheKey);
			console.error(
				// TODO: Docs or internal URL
				`An error occurred loading the control. The form attempted to load the control from \`${url}\`. Forms Engine v1 controls are not compatible with this version. If you haven't migrated this control, please check the migration guide at https://docs.craftercms.org/.\n\n`,
				reason
			);
			throw reason;
		});
		controlPluginCache.set(url, loading);
	}

	const result = loading
		.then((descriptor) => {
			const contribution = getRegisteredControlContribution(controlType);
			if (!contribution) {
				console.error(
					`Plugin "${descriptor.id}" loaded from "${url}" does not contribute control type "${controlType}". ` +
						`Add it to PluginDescriptor.controls.`
				);
				return { Component: errorComponent, bindings: [], url };
			}
			if (contribution.pluginId !== plugin.pluginId) {
				console.error(
					`Control type "${controlType}" is registered by plugin "${contribution.pluginId}", but field plugin locator ` +
						`points at "${plugin.pluginId}" (${url}). Refusing to use the mismatched contribution.`
				);
				return { Component: errorComponent, bindings: [], url };
			}
			return { Component: contribution.Component, bindings: contribution.bindings, url };
		})
		.catch(() => ({ Component: errorComponent, bindings: [], url }));

	loadedControlPluginCache.set(cacheKey, result);
	return result;
}

/**
 * Suspense-friendly hook for plugin control modules (`use` over {@link loadControlPluginModule}).
 * Must be rendered under a Suspense boundary.
 */
export function useControlPluginModule(
	siteId: string,
	plugin: FormDefinitionPlugin,
	controlType: string,
	errorComponent: ComponentType<ControlProps>
): LoadedControlPlugin {
	return use(loadControlPluginModule(siteId, plugin, controlType, errorComponent));
}
