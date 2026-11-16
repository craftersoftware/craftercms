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
 * The connection-lost effect of GlobalDialogManager: after 5 s without the socket it fetches the help page, then
 * either shows the persistent warning toast (fetch ok) or blocks the UI (fetch failed). If the effect is cleaned up
 * first (socket back, sign-out, site switch), the late fetch must do neither. Mounted with the real root reducer,
 * the real SnackbarProvider and a fake clock and fetch.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

// GlobalDialogManager lazy-loads the dialogs and menus it hosts. None take part in the connection handling, and
// they pull in editors that do not load under node:test, so each one resolves to an empty component.
const lazyModules = [
	'ViewVersionDialog',
	'CompareVersionsDialog',
	'HistoryDialog',
	'ItemActionsMenu',
	'ItemMegaMenu',
	'AuthMonitor',
	'UIBlocker'
];
const emptyComponent = 'data:text/javascript,export default () => null;';
registerHooks({
	resolve(specifier, context, nextResolve) {
		const resolved = nextResolve(specifier, context);
		const importedByManager = context.parentURL?.endsWith('/GlobalDialogManager/GlobalDialogManager.tsx');
		return importedByManager && lazyModules.some((name) => specifier === `../${name}`)
			? { url: emptyComponent, shortCircuit: true }
			: resolved;
	},
	load(url, context, nextLoad) {
		return url === emptyComponent
			? { format: 'module', source: 'export default () => null;', shortCircuit: true }
			: nextLoad(url, context);
	}
});

// The shared DOM setup does not expose ShadowRoot, and MUI feature-detects it on mount.
Object.defineProperty(globalThis, 'ShadowRoot', { value: window.ShadowRoot, configurable: true, writable: true });

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { Provider } = await import('react-redux');
const { configureStore } = await import('@reduxjs/toolkit');
const { IntlProvider } = await import('react-intl');
const { SnackbarProvider } = await import('notistack');
const { ThemeProvider, createTheme } = await import('@mui/material/styles');

const { default: reducer } = await import('../../state/reducers/root.ts');
const { blockUI, unblockUI } = await import('../../state/actions/system.ts');
const { NotistackVariant } = await import('../NotistackVariant/NotistackVariant.tsx');
const { default: GlobalDialogManager } = await import('./GlobalDialogManager.tsx');

const HELP_PATH = '/help/socket-connection-error';
const TITLE = 'Connection with the server interrupted';

interface PendingFetch {
	resolve(): void;
	reject(): void;
}

let helpFetches: PendingFetch[];
let actions: Array<{ type: string }>;
let mounted: Array<{ unmount(): void; host: HTMLElement }>;
const realFetch = globalThis.fetch;

beforeEach(() => {
	helpFetches = [];
	actions = [];
	mounted = [];
	mock.timers.enable({ apis: ['setTimeout'] });
	globalThis.fetch = ((input: string) => {
		if (!String(input).endsWith(HELP_PATH)) return new Promise(() => {});
		return new Promise((resolve, reject) => {
			helpFetches.push({
				resolve: () => resolve({ ok: true, text: async () => '' }),
				reject: () => reject(new Error('network down'))
			});
		});
	}) as typeof fetch;
});

afterEach(async () => {
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
	mock.timers.reset();
	globalThis.fetch = realFetch;
});

async function mountManager() {
	const recorder = () => (next: (action: unknown) => unknown) => (action: { type: string }) => {
		actions.push(action);
		return next(action);
	};
	const initial = reducer(undefined, { type: '@@test/init' });
	const store = configureStore({
		reducer,
		preloadedState: {
			...initial,
			auth: { ...initial.auth, active: true },
			user: { username: 'admin', rolesBySite: {}, permissionsBySite: {}, preferences: null } as never,
			sites: { ...initial.sites, active: 'editorial' },
			env: { ...initial.env, socketConnected: false }
		},
		middleware: (getDefault) => getDefault({ serializableCheck: false, immutableCheck: false }).concat(recorder)
	});
	const host = document.createElement('div');
	document.body.append(host);
	const root = createRoot(host);
	const render = (withManager: boolean) =>
		act(async () => {
			root.render(
				React.createElement(
					Provider,
					{ store },
					React.createElement(
						IntlProvider,
						{ locale: 'en', messages: {} },
						React.createElement(
							ThemeProvider,
							{ theme: createTheme() },
							React.createElement(
								SnackbarProvider,
								{ Components: { warning: NotistackVariant } },
								withManager ? React.createElement(GlobalDialogManager) : null
							)
						)
					)
				)
			);
		});
	await render(true);
	mounted.push({ unmount: () => root.unmount(), host });
	return { unmountManager: () => render(false), store };
}

const advancePastTimeout = () => act(async () => mock.timers.tick(5000));
const settle = () => act(async () => void (await new Promise<void>((resolve) => process.nextTick(resolve))));
const blockedActions = () => actions.filter((action) => action.type === blockUI.type);
const toast = () => document.body.textContent?.includes(TITLE) ?? false;

describe('connection lost handling in GlobalDialogManager', () => {
	it('fetches the help page only after the 5 s delay', async () => {
		await mountManager();
		assert.equal(helpFetches.length, 0);
		await advancePastTimeout();
		assert.equal(helpFetches.length, 1);
	});

	it('shows the warning toast when the help page loads', async () => {
		await mountManager();
		await advancePastTimeout();
		helpFetches[0].resolve();
		await settle();
		assert.equal(toast(), true);
		assert.ok(document.querySelector('[role="alert"]'), 'a warning is an alert');
		assert.equal(blockedActions().length, 0);
	});

	it('blocks the UI when the help page fails to load', async () => {
		await mountManager();
		await advancePastTimeout();
		helpFetches[0].reject();
		await settle();
		assert.equal(blockedActions().length, 1);
		assert.equal(toast(), false);
	});

	it('neither shows the toast nor blocks the UI when the effect was cleaned up before the fetch resolved', async () => {
		const { unmountManager } = await mountManager();
		await advancePastTimeout();
		assert.equal(helpFetches.length, 1);
		await unmountManager();
		helpFetches[0].resolve();
		await settle();
		assert.equal(toast(), false, 'no toast after cleanup');
		assert.equal(blockedActions().length, 0, 'the UI is not blocked');
	});

	it('does not block the UI when the effect was cleaned up before the fetch failed', async () => {
		const { unmountManager } = await mountManager();
		await advancePastTimeout();
		await unmountManager();
		const unblocks = actions.filter((action) => action.type === unblockUI.type).length;
		helpFetches[0].reject();
		await settle();
		assert.equal(blockedActions().length, 0, 'the UI is not blocked');
		assert.equal(toast(), false);
		assert.equal(unblocks, 1, 'cleanup unblocks the UI when no toast was shown');
	});
});
