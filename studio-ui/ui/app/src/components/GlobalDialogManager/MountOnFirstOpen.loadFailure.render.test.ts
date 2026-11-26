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
 * When the code of a dialog hosted by MountOnFirstOpen fails to load (a lazy chunk request that fails), the failure must
 * stay inside the host: siblings keep rendering, the user gets a message with a way to close the dialog, and the next
 * time the dialog opens the code is requested again.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';

Object.defineProperty(globalThis, 'ShadowRoot', { value: window.ShadowRoot, configurable: true, writable: true });

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { IntlProvider } = await import('react-intl');
const { ThemeProvider, createTheme } = await import('@mui/material/styles');
const { lazyWithRetry } = await import('../../utils/lazyWithRetry.ts');
const { MountOnFirstOpen } = await import('./MountOnFirstOpen.tsx');

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];

afterEach(async () => {
	mock.restoreAll();
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
});

function setup() {
	const network = { online: false };
	const events = { chunkRequests: 0, closes: 0, closed: 0 };
	const LazyDialog = lazyWithRetry(() => {
		events.chunkRequests++;
		return network.online
			? Promise.resolve({
					default: function Dialog(props: { open: boolean }) {
						return React.createElement('div', { 'data-testid': 'dialog', 'data-open': String(props.open) });
					}
				})
			: Promise.reject(new Error('Loading chunk failed'));
	});
	const host = document.createElement('div');
	document.body.append(host);
	const root = createRoot(host);
	mounted.push({ unmount: () => root.unmount(), host });
	const render = (open: boolean) =>
		act(async () => {
			root.render(
				React.createElement(
					ThemeProvider,
					{ theme: createTheme() },
					React.createElement(
						IntlProvider,
						{ locale: 'en', messages: {} },
						React.createElement('main', null, 'page'),
						React.createElement(
							MountOnFirstOpen,
							{ open, onClose: () => void events.closes++, onClosed: () => void events.closed++ },
							React.createElement(LazyDialog, { open })
						),
						React.createElement('footer', null, 'sibling')
					)
				)
			);
		});
	const alert = () => document.body.querySelector('[role="dialog"]');
	return { network, events, host, render, alert };
}

describe('MountOnFirstOpen when the dialog code fails to load', () => {
	it('keeps the failure inside, shows a message and leaves the siblings rendered', async () => {
		mock.method(console, 'error', () => {});
		const { render, alert, host } = setup();
		await render(false);
		await render(true);
		assert.match(alert()?.textContent ?? '', /could not be loaded/);
		assert.equal(host.querySelector('main')?.textContent, 'page');
		assert.equal(host.querySelector('footer')?.textContent, 'sibling');
	});

	it('lets the user close the dialog from the message', async () => {
		mock.method(console, 'error', () => {});
		const { render, alert, events } = setup();
		await render(true);
		const button = alert()?.querySelector('button');
		assert.ok(button);
		await act(async () => button.click());
		assert.equal(events.closes, 1);
	});

	it('requests the code again, and shows the dialog, the next time it opens', async () => {
		mock.method(console, 'error', () => {});
		const { network, render, events, alert, host } = setup();
		await render(true);
		await render(false);
		const afterFailure = events.chunkRequests;
		network.online = true;
		await render(true);
		assert.equal(events.chunkRequests, afterFailure + 1);
		assert.equal(host.querySelector('[data-testid="dialog"]')?.getAttribute('data-open'), 'true');
		assert.equal(alert(), null);
	});

	it('does not request the code again while it stays closed after the failure', async () => {
		mock.method(console, 'error', () => {});
		const { render, events } = setup();
		await render(true);
		const afterFailure = events.chunkRequests;
		await render(false);
		await render(false);
		assert.equal(events.chunkRequests, afterFailure);
	});

	it('calls onClosed once, after the message is gone, so the dialog state can be reset', async () => {
		mock.method(console, 'error', () => {});
		const { render, events, alert } = setup();
		await render(true);
		assert.equal(events.closed, 0);
		await render(false);
		await act(async () => void (await new Promise<void>((resolve) => setTimeout(resolve, 600))));
		assert.equal(alert(), null);
		assert.equal(events.closed, 1);
		await render(false);
		assert.equal(events.closed, 1);
	});

	it('does not call onClosed when the dialog opens again before the message has gone, as that retry owns the state', async () => {
		mock.method(console, 'error', () => {});
		const { render, events } = setup();
		await render(true);
		await render(false);
		await render(true);
		await act(async () => void (await new Promise<void>((resolve) => setTimeout(resolve, 600))));
		assert.equal(events.closed, 0);
	});
});
