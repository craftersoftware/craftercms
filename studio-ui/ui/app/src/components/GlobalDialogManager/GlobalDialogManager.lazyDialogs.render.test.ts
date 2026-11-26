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
 * The History, View Version and Compare Versions dialogs of GlobalDialogManager pull in heavy code (Monaco wrappers,
 * video.js) so their chunks must not be requested until the dialog is opened for the first time. Once opened they must
 * stay mounted while closing so the exit transition plays and `onClosed` is still delivered.
 *
 * Each lazily imported module is replaced with a stub that records when it is evaluated (the chunk download) and what
 * props it renders with. This file must run in its own process (node:test does that per file) because evaluated modules
 * stay cached, which is what the "not loaded yet" assertions rely on.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { afterEach, beforeEach, describe, it } from 'node:test';

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
const stubSource = (name: string) =>
	`globalThis.__lazyLoads.push('${name}');
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

const versionDialogs = ['HistoryDialog', 'ViewVersionDialog', 'CompareVersionsDialog'];
const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
let dispatched: Array<{ type: string }>;

beforeEach(() => {
	dispatched = [];
});

afterEach(async () => {
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

const lastRender = (name: string) => globals.__lazyRenders.filter((render) => render.name === name).at(-1);
const loadedVersionDialogs = () => globals.__lazyLoads.filter((name) => versionDialogs.includes(name));

describe('version dialogs in GlobalDialogManager', () => {
	it('does not request or render any of the three while they are closed', async () => {
		const { settle } = await mountManager();
		await settle();
		assert.deepEqual(loadedVersionDialogs(), []);
		assert.deepEqual(
			globals.__lazyRenders.filter((render) => versionDialogs.includes(render.name)),
			[]
		);
	});

	it('still loads the menus and monitors the manager always hosts', async () => {
		await mountManager();
		assert.ok(globals.__lazyLoads.includes('AuthMonitor'));
		assert.ok(globals.__lazyLoads.includes('UIBlocker'));
	});

	it('requests and renders the history dialog, and only that one, when it is opened', async () => {
		const { dispatch, settle } = await mountManager();
		await dispatch(dialogActions.showHistoryDialog({}));
		await settle();
		assert.deepEqual(loadedVersionDialogs(), ['HistoryDialog']);
		assert.equal(lastRender('HistoryDialog')?.props.open, true);
		assert.equal(typeof lastRender('HistoryDialog')?.props.onClosed, 'function');
	});

	it('requests and renders the view version dialog when it is opened', async () => {
		const { dispatch, settle } = await mountManager();
		await dispatch(dialogActions.showViewVersionDialog({}));
		await settle();
		assert.ok(loadedVersionDialogs().includes('ViewVersionDialog'));
		assert.equal(lastRender('ViewVersionDialog')?.props.open, true);
	});

	it('requests and renders the compare versions dialog when it is opened', async () => {
		const { dispatch, settle } = await mountManager();
		await dispatch(dialogActions.showCompareVersionsDialog({}));
		await settle();
		assert.ok(loadedVersionDialogs().includes('CompareVersionsDialog'));
		assert.equal(lastRender('CompareVersionsDialog')?.props.open, true);
	});

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
		it(`keeps ${name} mounted while closing, and delivers onClose and onClosed`, async () => {
			const { store, dispatch, settle } = await mountManager();
			await dispatch(show({}));
			await settle();
			const opened = lastRender(name);
			assert.equal(opened?.props.open, true);

			// The dialog asks to close (e.g. Esc or backdrop click).
			await act(async () => (opened.props.onClose as () => void)());
			assert.ok(
				dispatched.some((action) => action.type === close.type),
				'onClose dispatches the close action'
			);
			assert.equal(store.getState().dialogs[slice].open, false);
			assert.equal(lastRender(name)?.props.open, false, 'still mounted, now closed, so it can animate out');

			// The exit transition ended: the dialog reports it and its slice is reset.
			await act(async () => (lastRender(name).props.onClosed as () => void)());
			assert.ok(
				dispatched.some((action) => action.type === closed.type),
				'onClosed dispatches the closed action'
			);
			assert.equal(store.getState().dialogs[slice].onClosed, undefined);
			assert.equal(lastRender(name)?.props.open, false);

			// And it can be opened again without being loaded again.
			const loadsBefore = globals.__lazyLoads.length;
			await dispatch(show({}));
			await settle();
			assert.equal(lastRender(name)?.props.open, true);
			assert.equal(globals.__lazyLoads.length, loadsBefore);
		});
	}
});
