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
 * MUI's SwitchBase puts root-level aria props on its `<span>`, not the `<input>`, so the checkboxes of the dialog
 * are named through `slotProps.input`. The dialog renders in a portal, so the queries run against the document body.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

// MUI's focus trap checks ShadowRoot. jsdom exposes it on window, not as a Node global.
globalThis.ShadowRoot ??= window.ShadowRoot ?? class ShadowRoot {};

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { RawIntlProvider, createIntl } = await import('react-intl');
const { Provider } = await import('react-redux');
const { configureStore } = await import('@reduxjs/toolkit');
const { ContentLocalizationDialog } = await import('./ContentLocalizationDialog.tsx');

// The real createIntl, so a message without an id fails the test instead of getting one made up.
const intl = createIntl({ locale: 'en', messages: {}, onError: () => undefined });

const store = configureStore({
	reducer: {
		sites: (state = { active: 'editorial', byId: { editorial: { id: 'editorial', uuid: 'u1' } } }) => state,
		user: (state = { username: 'ann' }) => state,
		env: (state = { authoringBase: '/studio' }) => state,
		uiConfig: (state = { locale: { localeCode: 'en-US' } }) => state,
		content: (state = { itemsByPath: {}, itemsBeingFetchedByPath: {} }) => state,
		contentTypes: (state = { byId: {}, isFetching: false }) => state
	},
	middleware: (getDefault) => getDefault({ serializableCheck: false, immutableCheck: false })
});

const locales = [
	{ id: 'l1', localeCode: 'en', status: 'Live', path: '/site/website/index.xml' },
	{ id: 'l2', localeCode: 'es', status: 'Draft', path: '/site/website/es/index.xml' },
	{ id: 'l3', localeCode: 'xx', status: 'Draft', path: '/site/website/xx/index.xml' }
];

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
					React.createElement(ContentLocalizationDialog, {
						open: true,
						locales,
						rootPath: '/site/website',
						item: { path: '/site/website/index.xml', label: 'Home', systemType: 'page', stateMap: {}, previewUrl: '/' },
						onItemChange() {}
					} as never)
				)
			)
		);
	});
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 50));
	});
	return document.body;
}

const checkboxes = (body: HTMLElement) => Array.from(body.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
const checkboxNamed = (body: HTMLElement, name: string) =>
	checkboxes(body).find((input) => input.getAttribute('aria-label') === name);
const buttonNamed = (body: HTMLElement, name: string) =>
	Array.from(body.querySelectorAll<HTMLButtonElement>('button')).find(
		(button) => button.getAttribute('aria-label') === name
	);

describe('content localization dialog checkbox names', () => {
	it('names the header select-all checkbox on the input', async () => {
		const body = await render();
		assert.ok(checkboxNamed(body, 'Select all'), 'the select-all input has no name');
	});

	it('names each row checkbox after its locale, falling back to the locale code', async () => {
		const body = await render();
		assert.ok(checkboxNamed(body, 'Select English, US (en)'));
		assert.ok(checkboxNamed(body, 'Select Spanish, Spain (es)'));
		assert.ok(checkboxNamed(body, 'Select xx'));
		assert.equal(checkboxes(body).length, 4);
		assert.equal(
			checkboxes(body).filter((input) => !input.getAttribute('aria-label')).length,
			0,
			'a checkbox has no name'
		);
	});

	it('names each row options button after its locale', async () => {
		const body = await render();
		assert.ok(buttonNamed(body, 'Options for English, US (en)'));
		assert.ok(buttonNamed(body, 'Options for Spanish, Spain (es)'));
		assert.ok(buttonNamed(body, 'Options for xx'));
		assert.equal(buttonNamed(body, 'options'), undefined);
	});

	it('keeps the select-all checkbox named in the actions bar once a row is selected', async () => {
		const body = await render();
		await act(async () => {
			checkboxNamed(body, 'Select Spanish, Spain (es)').click();
		});
		const selectAll = checkboxes(body).filter((input) => input.getAttribute('aria-label') === 'Select all');
		assert.equal(selectAll.length, 1, 'the actions bar select-all has no name');
		assert.equal(checkboxNamed(body, 'Select Spanish, Spain (es)').checked, true);
	});
});
