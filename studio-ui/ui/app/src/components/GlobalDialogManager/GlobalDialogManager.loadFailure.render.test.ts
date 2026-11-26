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
 * When the code of the History, View Version or Compare Versions dialog fails to load, GlobalDialogManager shows a message
 * in its place. Closing that message must dispatch the dialog's close action and, once the message is gone, its closed
 * action, which resets the dialog's slice. The three dialogs are replaced with stubs whose evaluation fails, which is how
 * a failed chunk request surfaces. This file must run in its own process (node:test does that per file).
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

type StubRender = { name: string; props: Record<string, unknown> };
const globals = globalThis as unknown as { __lazyLoads: string[]; __lazyRenders: StubRender[] };
globals.__lazyLoads = [];
globals.__lazyRenders = [];

const lazyModules = [
	'ViewVersionDialog',
	'CompareVersionsDialog',
	'HistoryDialog',
	'ItemActionsMenu',
	'ItemMegaMenu',
	'AuthMonitor',
	'UIBlocker'
];
const failing = ['ViewVersionDialog', 'CompareVersionsDialog', 'HistoryDialog'];
const stubSource = (name: string) =>
	failing.includes(name)
		? `globalThis.__lazyLoads.push('${name}'); throw new Error('Loading chunk failed');`
		: `globalThis.__lazyLoads.push('${name}');
	export default function Stub(props) { globalThis.__lazyRenders.push({ name: '${name}', props }); return null; }`;
const stubUrl = (name: string) => `data:text/javascript,${encodeURIComponent(stubSource(name))}`;
const stubSources = new Map(lazyModules.map((name) => [stubUrl(name), stubSource(name)]));
registerHooks({
	load(url, context, nextLoad) {
		return stubSources.has(url)
			? { format: 'module', source: stubSources.get(url), shortCircuit: true }
			: nextLoad(url, context);
	},
	resolve(specifier, context, nextResolve) {
		const importedByManager = context.parentURL?.endsWith('/GlobalDialogManager/GlobalDialogManager.tsx');
		const name = importedByManager ? lazyModules.find((moduleName) => specifier === `../${moduleName}`) : undefined;
		return name ? { url: stubUrl(name), format: 'module', shortCircuit: true } : nextResolve(specifier, context);
	}
});

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
const dialogActions = await import('../../state/actions/dialogs.ts');
const { default: GlobalDialogManager } = await import('./GlobalDialogManager.tsx');

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
let dispatched: Array<{ type: string }>;

beforeEach(() => {
	dispatched = [];
});

afterEach(async () => {
	mock.restoreAll();
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
});

async function mountManager() {
	const recorder = () => (next: (action: unknown) => unknown) => (action: { type: string }) => {
		dispatched.push(action);
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
			env: { ...initial.env, socketConnected: true }
		},
		middleware: (getDefault) => getDefault({ serializableCheck: false, immutableCheck: false }).concat(recorder)
	});
	const host = document.createElement('div');
	document.body.append(host);
	const root = createRoot(host);
	await act(async () => {
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
						React.createElement(SnackbarProvider, null, React.createElement(GlobalDialogManager))
					)
				)
			)
		);
	});
	mounted.push({ unmount: () => root.unmount(), host });
	const dispatch = (action: { type: string }) => act(async () => void store.dispatch(action));
	const settle = () => act(async () => void (await new Promise<void>((resolve) => setTimeout(resolve, 0))));
	return { store, dispatch, settle };
}

const wait = (ms: number) => act(async () => void (await new Promise<void>((resolve) => setTimeout(resolve, ms))));

describe('version dialogs in GlobalDialogManager when their code fails to load', () => {
	for (const { name, show, close, closed, slice } of [
		{
			name: 'HistoryDialog',
			show: dialogActions.showHistoryDialog,
			close: dialogActions.closeHistoryDialog,
			closed: dialogActions.historyDialogClosed,
			slice: 'history'
		},
		{
			name: 'ViewVersionDialog',
			show: dialogActions.showViewVersionDialog,
			close: dialogActions.closeViewVersionDialog,
			closed: dialogActions.viewVersionDialogClosed,
			slice: 'viewVersion'
		},
		{
			name: 'CompareVersionsDialog',
			show: dialogActions.showCompareVersionsDialog,
			close: dialogActions.closeCompareVersionsDialog,
			closed: dialogActions.compareVersionsDialogClosed,
			slice: 'compareVersions'
		}
	]) {
		it(`${name}: shows a message, and closing it dispatches the close action and then the closed action`, async () => {
			mock.method(console, 'error', () => {});
			const { store, dispatch, settle } = await mountManager();
			await dispatch(show({}));
			await settle();
			assert.ok(globals.__lazyLoads.includes(name));
			assert.equal(store.getState().dialogs[slice].open, true);
			const message = document.body.querySelector('[role="dialog"]');
			assert.match(message?.textContent ?? '', /could not be loaded/);
			assert.equal(
				dispatched.some((action) => action.type === closed.type),
				false
			);

			await act(async () => message.querySelector('button').click());
			assert.ok(
				dispatched.some((action) => action.type === close.type),
				'closing the message dispatches the close action'
			);
			assert.equal(store.getState().dialogs[slice].open, false);

			// Once the message has animated out, the dialog is reported closed so its slice is reset.
			await wait(600);
			assert.equal(document.body.querySelector('[role="dialog"]'), null);
			assert.equal(
				dispatched.filter((action) => action.type === closed.type).length,
				1,
				'the closed action is dispatched once'
			);
			assert.equal(store.getState().dialogs[slice].onClosed, undefined);
		});
	}
});
