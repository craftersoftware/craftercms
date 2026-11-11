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
 * The select-all checkbox, the row checkboxes and the enable switch are named. The row controls carry the token label,
 * since they repeat on every row.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

// TokenManagement reaches the Redux store, which reads Vite's import.meta.env. Node has no such object.
const { registerHooks } = await import('node:module');
registerHooks({
	load(url, context, nextLoad) {
		const result = nextLoad(url, context);
		if (url.includes('/ui/app/src/') && result.source) {
			result.source = String(result.source).replaceAll('import.meta.env', '({ DEV: true, BASE_URL: "" })');
		}
		return result;
	}
});

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { RawIntlProvider, createIntl } = await import('react-intl');
const { Provider } = await import('react-redux');
const { configureStore } = await import('@reduxjs/toolkit');
const { TokenManagement } = await import('./TokenManagement.tsx');

// The real createIntl, so a message without an id fails the test instead of getting one made up.
const intl = createIntl({ locale: 'en', messages: {}, onError: () => undefined });

const tokens = [
	{ id: 1, label: 'CI build', token: 'a', createdOn: '2026-01-01T00:00:00Z', expiresAt: null, enabled: true },
	{ id: 2, label: 'Deploy', token: 'b', createdOn: '2026-01-02T00:00:00Z', expiresAt: null, enabled: false }
];

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
		const body = { response: { code: 0 }, tokens };
		this.response = this.responseType === 'json' ? body : JSON.stringify(body);
		this.responseText = JSON.stringify(body);
		setTimeout(() => this.dispatchEvent(new Event('load')), 0);
	}
}
(window as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = FakeXhr;
(globalThis as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = FakeXhr;

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
	const store = configureStore({
		reducer: { sites: (state = { active: 'editorial' }) => state },
		middleware: (getDefault) => getDefault({ serializableCheck: false, immutableCheck: false })
	});
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	mounted.push({ unmount: () => root.unmount(), host });
	await act(async () => {
		root.render(
			React.createElement(
				Provider,
				{ store },
				React.createElement(RawIntlProvider, { value: intl }, React.createElement(TokenManagement))
			)
		);
	});
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 50));
	});
	return host;
}

const labelsOf = (host: HTMLElement, selector: string) =>
	Array.from(host.querySelectorAll<HTMLInputElement>(selector), (input) => input.getAttribute('aria-label'));

describe('TokenManagement control names', () => {
	it('names the select-all and row checkboxes', async () => {
		const host = await render();
		assert.deepEqual(labelsOf(host, 'input[type="checkbox"]:not([role="switch"])'), [
			'Select all',
			'Select CI build',
			'Select Deploy'
		]);
	});

	it('names each enable switch for its token', async () => {
		const host = await render();
		const switches = labelsOf(host, 'input[role="switch"]');
		assert.deepEqual(switches, ['Enable CI build', 'Enable Deploy']);
	});

	it('leaves one visible select-all checkbox once a token is checked', async () => {
		const host = await render();
		const selectAll = () =>
			Array.from(host.querySelectorAll<HTMLInputElement>('input[aria-label="Select all"]')).filter(
				(input) => window.getComputedStyle(input.closest('.MuiCheckbox-root') ?? input).visibility !== 'hidden'
			);
		assert.equal(selectAll().length, 1);
		await act(async () => {
			host.querySelector<HTMLInputElement>('input[aria-label="Select CI build"]')?.click();
		});
		assert.equal(host.querySelectorAll('input[aria-label="Select all"]').length, 2, 'the bar and the header');
		assert.equal(selectAll().length, 1, 'the header checkbox is hidden under the bar');
	});
});
