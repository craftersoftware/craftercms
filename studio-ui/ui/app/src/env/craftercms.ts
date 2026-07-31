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

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { createRoot } from 'react-dom/client';
import * as reactJsxRuntime from 'react/jsx-runtime';
import * as MaterialUI from '@mui/material';
import * as ReactRedux from 'react-redux';
import * as ReactIntl from 'react-intl';
import * as rxjs from 'rxjs';
import { createAction } from '@reduxjs/toolkit';
import createEmotion from '@emotion/css/create-instance';
import { CrafterCMSStore, getStore, getStoreSync } from '../state/store';
import { registerPlugin } from '../services/plugin';
import { PluginDescriptor } from '../models/PluginDescriptor';
import { components, icons, services, utils } from './studioUI';
import { Observable } from 'rxjs';
import { formsEngineControlsHost, formsEngineDataSourcesHost } from '../components/FormsEngine/dataSources/host';

// TODO:
//  To avoid pre-loading all services and utils and ending up with a large app
//  bundle, these can be made observables of the actual artefact.
//  Then, services/utils, would be used in this fashion:
//  craftercms.services.configuration$.pipe(
//    switchMap((service) => service.fetchActiveTargetingModel())
//  ).subscribe((targetingModel) => {
//    // Do something with `targetingModel`
//  });

declare global {
	interface Window {
		craftercms: CrafterCMSGlobal;
	}
}

export interface CrafterCMSGlobal {
	libs: {
		React: typeof React;
		ReactDOM: typeof ReactDOM;
		ReactDOMClient: { createRoot: typeof createRoot };
		MaterialUI: typeof MaterialUI;
		ReactRedux: typeof ReactRedux;
		ReactIntl: typeof ReactIntl;
		createEmotion: typeof createEmotion;
		ReduxToolkit: { createAction: typeof createAction };
		// Include also package name aliases for builds that might use those
		// when invoking require('...') or define([...], factory).
		react: typeof React;
		reactJsxRuntime: typeof reactJsxRuntime;
		rxjs: typeof rxjs;
		'react-dom': typeof ReactDOM;
		'react-dom/client': CrafterCMSGlobal['libs']['ReactDOMClient'];
		'react/jsx-runtime': typeof reactJsxRuntime;
		'react-redux': typeof ReactRedux;
		'react-intl': typeof ReactIntl;
		'@mui/material': typeof MaterialUI;
		'@emotion/css/create-instance': typeof createEmotion;
		'@reduxjs/toolkit': { createAction: typeof createAction };
	};
	components: typeof components;
	icons: typeof icons;
	utils: typeof utils;
	services: typeof services;
	formsEngine: {
		dataSources: typeof formsEngineDataSourcesHost;
		controls: typeof formsEngineControlsHost;
	};
	getStore(): CrafterCMSStore;
	define: {
		(): void;
		amd: true;
	};
	store$(): Observable<CrafterCMSStore>;
}

let UND;

const ReduxToolkit = { createAction };
const ReactDOMClient = { createRoot };

export const libs: CrafterCMSGlobal['libs'] = {
	rxjs,
	React,
	ReactDOM,
	ReactDOMClient,
	ReactIntl,
	MaterialUI,
	ReactRedux,
	ReduxToolkit,
	createEmotion,
	react: React,
	reactJsxRuntime,
	'react/jsx-runtime': reactJsxRuntime,
	'react-dom': ReactDOM,
	'react-dom/client': ReactDOMClient,
	'react-redux': ReactRedux,
	'react-intl': ReactIntl,
	'@mui/material': MaterialUI,
	'@emotion/css/create-instance': createEmotion,
	'@reduxjs/toolkit': ReduxToolkit
};

// UMD builds wouldn't give the chance to track the file builder the plugin loads from
// unless the plugin descriptor provided the site, type, name & file args.
// An option would be including a query argument on the URL of the plugin with the expected ID e.g.
// `.../plugin/file?site=mySite&type=myType&name=myName&fileName=myFile&expectedPluginId=org.craftercms.samplePlugin`
// Upon receiving a call to `craftercms.define` and invoking the factory to get the plugin descriptor, get the id and
// try to find a script which matches `expectedPluginId=${pluginDescriptor.id}`. This might mean having to drop the
// use of dynamic import and use regular scripts as dynamic imports don't add a script to the DOM we could go find.
// Perhaps UMD shouldn't be supported; only support es module-style plugin bundle builds.
export const define = function (id, deps, factory) {
	// Anonymous modules
	if (typeof id !== 'string') {
		// Adjust args appropriately
		factory = deps;
		deps = id;
		id = null;
	}
	// This module may not have dependencies
	if (!Array.isArray(deps)) {
		factory = deps;
		deps = [];
	}
	const resolved = deps.map((dep) => {
		libs[dep] === UND &&
			console.error(
				`${
					id ? `The "${id}" plugin` : 'A plugin'
				} requires "${dep}" which is not provided by CrafterCMS. You should bundle this dependency with your plugin.`
			);
		return libs[dep];
	});
	const plugin: PluginDescriptor = factory.apply(null, resolved);
	registerPlugin(plugin);
} as CrafterCMSGlobal['define'];

define.amd = true;

export const craftercms: CrafterCMSGlobal = {
	libs,
	define,
	getStore: getStoreSync,
	components,
	icons,
	services,
	formsEngine: {
		dataSources: formsEngineDataSourcesHost,
		controls: formsEngineControlsHost
	},
	utils,
	store$: getStore
};

export const publishCrafterGlobal = () => {
	window.craftercms = craftercms;
};

export default craftercms;
