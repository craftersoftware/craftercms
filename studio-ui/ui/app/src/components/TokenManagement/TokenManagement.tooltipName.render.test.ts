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
 * The row Delete dropdown repeats on every row, so its name carries the token label. A React element tooltip title
 * would copy the tooltip text onto the button as `aria-label` while open, replacing the name; a string title copies
 * the same string and the button keeps its own name.
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

const deleteButtonFor = (host: HTMLElement, name: string) =>
	Array.from(host.querySelectorAll<HTMLButtonElement>('button[aria-label]')).find(
		(button) => button.getAttribute('aria-label') === `Delete ${name}`
	);

/** Hovering opens the tooltip; focus does too, but jsdom reports no focus-visible. */
async function openTooltip(button: HTMLButtonElement) {
	await act(async () => {
		button.dispatchEvent(new window.MouseEvent('mouseover', { bubbles: true }));
	});
	// The enter delay is asynchronous.
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 200));
	});
}

const tooltipOpenFor = (button: HTMLButtonElement) =>
	Array.from(document.querySelectorAll('[role="tooltip"]')).find(
		(tooltip) => tooltip.textContent === button.getAttribute('data-test-tooltip-text')
	) ?? document.getElementById(button.getAttribute('aria-labelledby') ?? '');

describe('TokenManagement Delete name with the tooltip open', () => {
	it('keeps the token in the name while the tooltip is open', async () => {
		const host = await render();
		const button = deleteButtonFor(host, 'CI build');
		assert.ok(button, 'no Delete button named for the token');
		await openTooltip(button);
		assert.equal(
			document.querySelectorAll('[role="tooltip"]').length,
			1,
			'the tooltip did not open, so the name was not checked against an open tooltip'
		);
		assert.equal(button.getAttribute('aria-label'), 'Delete CI build');
		// A React element title points aria-labelledby at the tooltip, which replaces the button's own name.
		assert.equal(button.getAttribute('aria-labelledby'), null);
	});

	it('names each row for its own token', async () => {
		const host = await render();
		assert.ok(deleteButtonFor(host, 'CI build'));
		assert.ok(deleteButtonFor(host, 'Deploy'));
		assert.equal(
			Array.from(host.querySelectorAll('button')).some(
				(target) => target.textContent.trim() === '' && target.getAttribute('aria-label') === 'Delete'
			),
			false,
			'a Delete button was named for the action only'
		);
	});
});
