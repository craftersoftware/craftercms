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
import { JSXElementConstructor, lazy } from 'react';
import * as ReactDOM from 'react-dom';
import { createRoot } from 'react-dom/client';
import CrafterCMSNextBridge from '../components/CrafterCMSNextBridge/CrafterCMSNextBridge';
import { nou } from '../utils/object';
import * as babel from '../env/babel';
import * as rxjs from 'rxjs';
import { Observable, Subject } from 'rxjs';
import * as messages from './i18n-legacy';
import { translateElements } from './i18n-legacy';
import * as mui from '@mui/material';
import { createDefaultThemeOptions } from '../styles/theme';
import getStore, { CrafterCMSStore } from '../state/store';
import palette from '../styles/palette';
import {
	buildStoredLanguageKey,
	dispatchLanguageChange,
	getCurrentIntl,
	getStoredLanguage,
	intl$,
	setStoredLanguage
} from '../utils/i18n';
import { getHostToHostBus } from '../utils/subjects';
import { StandardAction } from '../models/StandardAction';
import { createCustomDocumentEventListener } from '../utils/dom';
import { components as studioUIComponents, services, utils } from './studioUI';
import logoIcon from '../assets/crafter-icon.svg';
import { IntlShape, MessageDescriptor } from 'react-intl';

const ErrorState = studioUIComponents.ErrorState;

/**
 *
 * To use from existing studio-ui code:
 *
 * Example 1 - Using components
 *
 * CrafterCMSNext
 *   .render(someElementOrSelector, 'AsyncVideoPlayer', { nonPlayableMessage })
 *   .then(() => {
 *     // Optional callback - you don't call .then(...) if you don't need a callback
 *     console.log('The AsyncVideoPlayer (react component) is now rendered.')
 *   });
 *
 * Example 2 - Using assets
 *
 * img.src = CrafterCMSNext.Asset.logoIcon
 *
 */

interface CodebaseBridge {
	React: typeof React;
	ReactDOM: typeof ReactDOM;
	ReactDOMClient: { createRoot: typeof createRoot };
	components: { [key: string]: JSXElementConstructor<any> };
	assets: { [key: string]: string };
	util: object;
	render: (
		container: string | Element,
		component: string | JSXElementConstructor<any>,
		props: object,
		isLegacy: boolean
	) => Promise<any>;
	renderBackgroundUI: (options: Record<string, any>) => Promise<any>;
	createLegacyCallbackListener: (id: string, listener: <Detail = any>(detail: Detail) => void) => () => void;
	rxjs: object;
	i18n: {
		intl: IntlShape;
		messages: Record<string, Record<string, MessageDescriptor>>;
		translateElements: typeof translateElements;
		getStoredLanguage: typeof getStoredLanguage;
		setStoredLanguage: typeof setStoredLanguage;
		buildStoredLanguageKey: typeof buildStoredLanguageKey;
		dispatchLanguageChange: typeof dispatchLanguageChange;
	};
	services: Record<string, Record<string, (...args) => any>>;
	mui: object;
	system: {
		createDefaultThemeOptions: typeof createDefaultThemeOptions;
		palette: typeof palette;
		store: CrafterCMSStore;
		getHostToHostBus(): Subject<StandardAction>;
		getStore(): Observable<CrafterCMSStore>;
	};
}

declare global {
	interface Window {
		/** @deprecated Please use `craftercms` instead */
		CrafterCMSNext: CodebaseBridge;
	}
}

export function updateIntl(nextIntl: IntlShape) {
	if (window.CrafterCMSNext) {
		window.CrafterCMSNext.i18n.intl = nextIntl;
	}
}

export function createCodebaseBridge() {
	const Bridge: CodebaseBridge = {
		// React
		React,
		ReactDOM,
		ReactDOMClient: { createRoot },

		rxjs,

		components: {
			...studioUIComponents,
			CrafterCMSNextBridge,
			SearchPage: lazy(() => import('../pages/Search')),
			Global: lazy(() => import('../pages/Global')),
			Preview: lazy(() => import('../pages/Preview')),
			SiteTools: lazy(() => import('../pages/SiteTools')),
			Login: lazy(() => import('../pages/Login')),
			PagesWidget: lazy(() => import('../components/PathNavigator/PathNavigator')),
			DeleteContentTypeButton: lazy(() => import('../pages/DeleteContentTypeButton')),
			PreviewCompatDialog: lazy(() => import('../components/PreviewCompatibilityDialog/PreviewCompatibilityDialog'))
		},

		system: {
			createDefaultThemeOptions,
			palette,
			store: null,
			getHostToHostBus,
			getStore
		},

		mui,

		assets: {
			logoIcon
		},

		util: { ...utils, babel },

		i18n: {
			intl: getCurrentIntl(),
			// @ts-expect-error `messages` is a module but the module return follows the Type above
			messages,
			translateElements,
			getStoredLanguage,
			setStoredLanguage,
			dispatchLanguageChange,
			buildStoredLanguageKey
		},

		services,

		render(
			container: string | Element,
			component: string | JSXElementConstructor<any>,
			props: object = {},
			isLegacy = true
		): Promise<any> {
			if (typeof component === 'string') {
				if (!Boolean(Bridge.components[component])) {
					console.warn(`The supplied component name ('${component}') is not a know component of CrafterCMSNext.`);
				}
			} else if (!Object.values(Bridge.components).includes(component)) {
				console.warn('The supplied module is not a know component of CrafterCMSNext.');
			}

			const element = typeof container === 'string' ? document.querySelector(container) : container;

			let Component: JSXElementConstructor<any> =
				typeof component === 'string' ? Bridge.components[component] : component;

			if (nou(Component)) {
				Component = function () {
					return (
						<ErrorState
							imageUrl="/studio/static-assets/images/warning_state.svg"
							message={`The supplied component name ('${component}') is not a know component of CrafterCMSNext. Please re-check supplied name ('${component}'), make sure you've build the app and created the component.`}
						/>
					);
				};
			}

			return new Promise((resolve, reject) => {
				try {
					const root = createRoot(element);
					const unmount = (options) => {
						root.unmount();
						options.removeContainer && element.parentNode.removeChild(element);
					};
					root.render(
						<CrafterCMSNextBridge
							mountGlobalDialogManager={!isLegacy}
							mountSnackbarProvider={!isLegacy}
							mountCssBaseline={!isLegacy}
						>
							<Component {...props} />
						</CrafterCMSNextBridge>
					);
					resolve({
						unmount: (options) => {
							options = Object.assign(
								{
									delay: false,
									removeContainer: false
								},
								options || {}
							);
							if (options.delay) {
								setTimeout(() => unmount(options), options.delay);
							} else {
								unmount(options);
							}
						}
					});
				} catch (e) {
					reject(e);
				}
			});
		},

		renderBackgroundUI(options) {
			const { mountLegacyConcierge = false } = options ?? {};
			const element = document.createElement('div');
			const root = createRoot(element);
			element.setAttribute('class', 'craftercms-background-ui');
			document.body.appendChild(element);
			return new Promise((resolve, reject) => {
				try {
					const unmount = () => {
						root.unmount();
						document.body.removeChild(element);
					};
					root.render(
						<CrafterCMSNextBridge
							mountCssBaseline={false}
							mountLegacyConcierge={mountLegacyConcierge}
							suspenseFallback=""
						/>
					);
					resolve({
						unmount: (options) => {
							options = Object.assign({ delay: false }, options || {});
							if (options.delay) {
								setTimeout(unmount, options.delay);
							} else {
								unmount();
							}
						}
					});
				} catch (e) {
					reject(e);
				}
			});
		},

		createLegacyCallbackListener: createCustomDocumentEventListener
	};

	const handler: ProxyHandler<CodebaseBridge> = {
		get(target, prop, receiver) {
			console.warn(
				`CrafterCMSNext is deprecated and will be removed on an upcoming release. Please use the 'window.craftercms' global instead.`
			);
			return Reflect.get(target, prop, receiver);
		}
	};

	const proxy = new Proxy(Bridge, handler);

	window.CrafterCMSNext = proxy;

	// The login screen 1. doesn't need redux at all 2. there's no token yet (i.e. not loggeed in)
	// and the store creation is dependent on successfully retrieving the JWT.
	if (!window.location.pathname.includes('/studio/login')) {
		getStore().subscribe((store) => {
			Bridge.system.store = store;
		});
	}
}

intl$.subscribe(updateIntl);
