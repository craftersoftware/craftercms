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

import { isValidElementType } from 'react-is';
import type { ComponentType } from 'react';
import LookupTable from '../models/LookupTable';
import { augmentTranslations } from '../utils/i18n';
import { components, plugins } from '../utils/constants';
import PluginDescriptor from '../models/PluginDescriptor';
import PluginFileBuilder from '../models/PluginFileBuilder';
import { WidgetRecord } from '../models/WidgetRecord';
import type PluginDescriptorWithSource from '../models/PluginDescriptorWithSource';
import {
	normalizeDataSourceBindings,
	registerControlDataSourceBindings
} from '../components/FormsEngine/dataSources/bindings';
import { dataSourceModuleRegistry, validateDataSourceModule } from '../components/FormsEngine/dataSources/registry';
import type { DataSourceBinding, DataSourceModule } from '../components/FormsEngine/dataSources/types';
import {
	getRegisteredControlContribution,
	registerControlContribution
} from '../components/FormsEngine/controls/registry';
import { controlMap } from '../components/FormsEngine/lib/controlMap';
import type { ControlProps } from '../components/FormsEngine/types';

const DEFAULT_FILE_NAME = 'index.js';

type ControlContributionCommit = {
	typeKey: string;
	Component: ComponentType<ControlProps>;
	bindings: readonly DataSourceBinding[];
};

function isPluginFileBuilder(target: any): target is PluginFileBuilder {
	return typeof target === 'object';
}

export function buildFileUrl(fileBuilder: PluginFileBuilder): string;
export function buildFileUrl(site: string, type: string, name: string): string;
export function buildFileUrl(site: string, type: string, name: string, file: string): string;
export function buildFileUrl(site: string, type: string, name: string, file: string, id: string): string;
export function buildFileUrl(
	siteOrBuilder: PluginFileBuilder | string,
	type?: string,
	name?: string,
	file?: string,
	id?: string
): string {
	let site = siteOrBuilder;
	if (isPluginFileBuilder(siteOrBuilder)) {
		const builder = siteOrBuilder;
		site = builder.site;
		type = builder.type;
		name = builder.name;
		file = builder.file;
		id = builder.id;
	}
	let url = `/studio/1/plugin/file?siteId=${site}&type=${type}&name=${name}&filename=${file ?? DEFAULT_FILE_NAME}`;

	if (id) {
		url += `&pluginId=${id}`;
	}

	return url;
}

export function createFileBuilder(site: string, type: string, name: string): PluginFileBuilder;
export function createFileBuilder(site: string, type: string, name: string, file: string): PluginFileBuilder;
export function createFileBuilder(
	site: string,
	type: string,
	name: string,
	file: string,
	id: string
): PluginFileBuilder;
export function createFileBuilder(
	site: string,
	type: string,
	name: string,
	file: string = DEFAULT_FILE_NAME,
	id?: string
): PluginFileBuilder {
	return {
		site,
		type,
		name,
		file,
		...(id ? { id } : {})
	};
}

export function importFile(fileBuilder: PluginFileBuilder): Promise<any>;
export function importFile(site: string, type: string, name: string): Promise<any>;
export function importFile(site: string, type: string, name: string, file: string): Promise<any>;
export function importFile(site: string, type: string, name: string, file: string, id: string): Promise<any>;
export function importFile(
	siteOrBuilder: PluginFileBuilder | string,
	type?: string,
	name?: string,
	file?: string,
	id?: string
): Promise<any> {
	// @ts-expect-error — methods share same signature, this is fine.
	let url = buildFileUrl(...arguments);
	if (import.meta.env.DEV && !hasProtocol(url)) {
		url = `${origin}${url}`;
	}
	return import(/* @vite-ignore */ url);
}

/**
 * Dynamic-imports a plugin file, requires a {@link PluginDescriptor} with a string `id`, then
 * {@link registerPlugin}. The same URL may be imported for widgets then FE; re-entry still installs
 * new controls / data sources. Not FE-specific — shared Studio plugin loader.
 */
export function importPlugin(fileBuilder: PluginFileBuilder): Promise<PluginDescriptor>;
export function importPlugin(site: string, type: string, name: string): Promise<PluginDescriptor>;
export function importPlugin(site: string, type: string, name: string, file: string): Promise<PluginDescriptor>;
export function importPlugin(
	site: string,
	type: string,
	name: string,
	file: string,
	id: string
): Promise<PluginDescriptor>;
export function importPlugin(
	siteOrBuilder: PluginFileBuilder | string,
	type?: string,
	name?: string,
	file?: string,
	id?: string
): Promise<PluginDescriptor> {
	// @ts-ignore — methods share the same signature(s)
	const args: [string, string, string, string, string] = arguments;
	// @ts-expect-error — methods share same signature, this is fine.
	const url = buildFileUrl(...arguments);
	return importFile(...args).then((module) => {
		const plugin: PluginDescriptor = module.plugin ?? module.default;
		if (!plugin?.id || typeof plugin.id !== 'string') {
			throw new Error(`Plugin file at "${url}" must export a PluginDescriptor with a string id.`);
		}
		// Always call registerPlugin: when the id is already known (e.g. widget host loaded first),
		// registerPlugin still installs any new FE controls/dataSources contributions.
		registerPlugin(plugin, isPluginFileBuilder(siteOrBuilder) ? siteOrBuilder : createFileBuilder(...args));
		return plugin;
	});
}

export function isPluginRegistered(plugin: PluginDescriptor): boolean {
	return plugins.has(plugin?.id);
}

/**
 * Registers widgets / locales and **always** installs FE `dataSources` / `controls`, even when
 * `plugin.id` was already registered (e.g. widget host loaded first without FE contributions).
 *
 * FE contributions are fully preflighted before any registry write so a mid-flight failure leaves
 * no partial DS/control state. Returns `false` if the id already existed; merges contributions onto
 * the stored descriptor. Prefer this over calling FE registries directly from plugin code.
 */
export function registerPlugin(plugin: PluginDescriptor, source?: PluginFileBuilder): boolean {
	const alreadyRegistered = plugins.has(plugin.id);
	const dataSources = plugin.dataSources;
	const controls = plugin.controls;

	// --- Preflight (no registry writes) ---
	const dsToCommit: DataSourceModule[] = [];
	if (dataSources) {
		for (const [typeKey, module] of Object.entries(dataSources)) {
			validateDataSourceModule(module);
			if (module.type !== typeKey) {
				throw new TypeError(
					`Plugin "${plugin.id}" dataSources key "${typeKey}" does not match module.type "${module.type}".`
				);
			}
			const existing = dataSourceModuleRegistry.get(module.type);
			if (existing && existing !== module) {
				throw new Error(
					`Plugin "${plugin.id}" cannot register data-source type "${module.type}": a different module is already registered.`
				);
			}
			if (!existing) {
				dsToCommit.push(module);
			}
		}
	}

	const controlsToCommit: ControlContributionCommit[] = [];
	if (controls) {
		for (const [typeKey, entry] of Object.entries(controls)) {
			if (!typeKey) {
				throw new TypeError(`Plugin "${plugin.id}" controls map contains an empty type key.`);
			}
			if (typeKey in controlMap) {
				throw new Error(
					`Plugin "${plugin.id}" cannot register control type "${typeKey}": it collides with a built-in control.`
				);
			}
			if (!entry || typeof entry !== 'object') {
				throw new TypeError(`Plugin "${plugin.id}" control "${typeKey}" must be a ControlPluginContribution object.`);
			}
			if (!isValidElementType(entry.Component)) {
				throw new TypeError(
					`Plugin "${plugin.id}" control "${typeKey}" must declare a valid React Component on ControlPluginContribution.Component.`
				);
			}
			const bindings = normalizeDataSourceBindings(entry.dataSourceBindings ?? []);
			const existing = getRegisteredControlContribution(typeKey);
			if (existing) {
				if (existing.pluginId !== plugin.id) {
					throw new Error(
						`Plugin "${plugin.id}" cannot register control type "${typeKey}": already registered by plugin "${existing.pluginId}".`
					);
				}
				if (existing.Component !== entry.Component) {
					throw new Error(
						`Plugin "${plugin.id}" cannot register control type "${typeKey}": a different component is already registered.`
					);
				}
			}
			controlsToCommit.push({ typeKey, Component: entry.Component, bindings });
		}
	}

	// --- Commit (only after both preflights succeed) ---
	dsToCommit.forEach((module) => {
		dataSourceModuleRegistry.register(module);
	});
	controlsToCommit.forEach(({ typeKey, Component, bindings }) => {
		registerControlContribution(typeKey, { Component, bindings, pluginId: plugin.id });
		registerControlDataSourceBindings(typeKey, bindings);
	});

	if (alreadyRegistered) {
		const existing = plugins.get(plugin.id);
		// Merge newly contributed FE fields onto the stored descriptor so later lookups see them.
		plugins.set(plugin.id, {
			...existing,
			...plugin,
			widgets: { ...existing?.widgets, ...plugin.widgets },
			locales: { ...existing?.locales, ...plugin.locales },
			utils: { ...existing?.utils, ...plugin.utils },
			dataSources: { ...existing?.dataSources, ...plugin.dataSources },
			controls: { ...existing?.controls, ...plugin.controls },
			source: existing?.source ?? source
		} as PluginDescriptorWithSource);
		registerComponents(plugin.widgets);
		augmentTranslations(plugin.locales);
		return false;
	}

	const extendedDescriptor = { ...plugin, source } as PluginDescriptorWithSource;
	plugins.set(plugin.id, extendedDescriptor);
	registerComponents(plugin.widgets);
	augmentTranslations(plugin.locales);
	// TODO: Allow externals?
	if (source) {
		plugin.stylesheets?.forEach((href) =>
			appendStylesheet(
				typeof href === 'string' ? (hasProtocol(href) ? href : buildFileUrl({ ...source, file: href })) : href
			)
		);
		plugin.scripts?.forEach((src) =>
			appendScript(typeof src === 'string' ? (hasProtocol(src) ? src : buildFileUrl({ ...source, file: src })) : src)
		);
	} else {
		console.error('Scripts & stylesheets not allowed for umd bundles');
	}
	return true;
}

export function registerComponents(widgets?: LookupTable<WidgetRecord>): void {
	if (!widgets) return;
	Object.entries(widgets).forEach(([id, widget]) => {
		// Skip registration if component with same id already exists
		if (!components.has(id)) {
			components.set(id, widget);
		} else {
			console.error(`Attempt to register a duplicate component id "${id}" skipped.`);
		}
	});
}

export function appendStylesheet(href: string): Promise<Event>;
export function appendStylesheet(attributes: object): Promise<Event>;
export function appendStylesheet(href: string | object): Promise<Event>;
export function appendStylesheet(href: string | object): Promise<Event> {
	return appendLoadable('link', { rel: 'stylesheet', ...(typeof href === 'string' ? { href } : href) });
}

export function appendScript(src: string): Promise<Event>;
export function appendScript(attributes: object): Promise<Event>;
export function appendScript(src: string | object): Promise<Event>;
export function appendScript(src: string | object): Promise<Event> {
	return appendLoadable('script', typeof src === 'string' ? { src } : src);
}

function appendLoadable(type: 'link' | 'script', attributes: object): Promise<Event> {
	return new Promise((resolve, reject) => {
		const element = document.createElement(type);
		for (let attr in attributes) {
			if (Object.prototype.hasOwnProperty.call(attributes, attr)) {
				element.setAttribute(attr, attributes[attr]);
			}
		}
		element.onload = resolve;
		element.onerror = reject;
		document.head.appendChild(element);
	});
}

function hasProtocol(url: string): boolean {
	return /^(http)(s?):\/\//.test(url);
}
