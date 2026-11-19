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
 * The select-all tooltip title is a React element. Without describeChild, an open tooltip puts
 * aria-labelledby on the checkbox span, which does not allow it. The input keeps its own name.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { RawIntlProvider, createIntl } = await import('react-intl');
const { Provider } = await import('react-redux');
const { configureStore } = await import('@reduxjs/toolkit');
const { BrowseExternalAssetDialog } = await import('./BrowseExternalAssetDialog.tsx');

const intl = createIntl({ locale: 'en', messages: {}, onError: () => undefined });

globalThis.localStorage ??= window.localStorage;
globalThis.ShadowRoot ??= window.ShadowRoot ?? class ShadowRoot {};

class FakeXhr extends EventTarget {
	status = 200;
	statusText = 'OK';
	readyState = 4;
	responseType = '';
	response: unknown = null;
	responseText = '';
	upload = new EventTarget();
	open() {}
	setRequestHeader() {}
	getAllResponseHeaders() {
		return 'content-type: application/json';
	}
	getResponseHeader() {
		return 'application/json';
	}
	abort() {}
	send() {
		const body = { items: [] };
		this.response = this.responseType === 'json' ? body : JSON.stringify(body);
		this.responseText = JSON.stringify(body);
		setTimeout(() => this.dispatchEvent(new Event('load')), 0);
	}
}
(window as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = FakeXhr;
(globalThis as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = FakeXhr;

const store = configureStore({
	reducer: {
		sites: (state = { active: 'editorial' }) => state,
		user: (state = { username: 'ann' }) => state,
		env: (state = { authoringBase: '/studio', guestBase: '/studio' }) => state
	},
	middleware: (getDefault) => getDefault({ serializableCheck: false, immutableCheck: false })
});

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	await act(async () => {
		for (const { unmount, host } of mounted.splice(0)) {
			unmount();
			host.remove();
		}
	});
});

async function render() {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	mounted.push({ unmount: () => root.unmount(), host });
	await act(async () => {
		root.render(
			React.createElement(
				Provider,
				{ store },
				React.createElement(
					RawIntlProvider,
					{ value: intl },
					React.createElement(BrowseExternalAssetDialog, {
						open: true,
						path: '/assets',
						profileId: 's3',
						multiSelect: true,
						onClose() {}
					} as never)
				)
			)
		);
	});
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 50));
	});
	return host;
}

describe('external asset dialog select-all name', () => {
	it('keeps the input name and leaves the span unnamed while the tooltip is open', async () => {
		await render();
		const input = document.querySelector<HTMLInputElement>('input[type="checkbox"][aria-label="Select all"]');
		assert.ok(input, 'the select-all input has no name');
		const span = input.closest<HTMLElement>('.MuiCheckbox-root');
		assert.ok(span, 'select-all checkbox root');
		await act(async () => {
			span.dispatchEvent(new window.MouseEvent('mouseover', { bubbles: true }));
		});
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 200));
		});
		assert.equal(document.querySelectorAll('[role="tooltip"]').length, 1, 'the tooltip did not open');
		assert.equal(input.getAttribute('aria-label'), 'Select all');
		assert.equal(span.getAttribute('aria-label'), null);
		assert.equal(span.getAttribute('aria-labelledby'), null);
	});
});
