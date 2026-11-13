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
 * The dialog omits EnhancedDialog's header and the form draws the title, so the dialog names itself by pointing
 * aria-labelledby at the root form's title. That title has to exist in every state the form goes through:
 * loading, failed to prepare, and ready.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

globalThis.ShadowRoot ??= window.ShadowRoot ?? class ShadowRoot {};
// jsdom has none of these, and the ready form measures its layout.
window.HTMLElement.prototype.scroll = () => {};
Object.assign(globalThis, {
	ResizeObserver: class ResizeObserver {
		observe() {}
		unobserve() {}
		disconnect() {}
	}
});
Object.defineProperty(document, 'fonts', {
	value: { addEventListener() {}, removeEventListener() {}, ready: Promise.resolve() },
	configurable: true
});

// Nothing in these tests needs a response from the server.
class PendingXhr extends EventTarget {
	upload = new EventTarget();
	open() {}
	setRequestHeader() {}
	send() {}
	abort() {}
}
Object.assign(window, { XMLHttpRequest: PendingXhr });
Object.assign(globalThis, { XMLHttpRequest: PendingXhr });

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { RawIntlProvider } = await import('react-intl');
const { Provider } = await import('react-redux');
const { configureStore } = await import('@reduxjs/toolkit');
const { createTestIntl } = await import('../../../test/createTestIntl.mjs');
const { default: FormsEngineDialog } = await import('./FormsEngineDialog.tsx');

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
});

const contentType = {
	id: '/component/test',
	name: 'Test',
	type: 'component',
	fields: {},
	sections: [],
	dataSources: []
};

const typeWithRepeat = {
	...contentType,
	fields: {
		rows_o: {
			id: 'rows_o',
			name: 'Rows',
			type: 'repeat',
			validations: {},
			helpText: '',
			fields: { name_s: { id: 'name_s', name: 'Name', type: 'input', validations: {} } }
		}
	},
	sections: [{ title: 'Main', description: '', fields: ['rows_o'], expandByDefault: true }]
};

async function render(contentTypesById: Record<string, unknown> | null) {
	const store = configureStore({
		reducer: {
			env: (state = {}) => state,
			sites: (state = { active: 'editorial', byId: { editorial: { id: 'editorial', name: 'Editorial' } } }) => state,
			user: (state = { username: 'ada', rolesBySite: {}, permissionsBySite: {} }) => state,
			contentTypes: (state = { byId: contentTypesById, isFetching: false, error: null }) => state,
			content: (state = { itemsByPath: {}, itemsBeingFetchedByPath: {} }) => state,
			uiConfig: (state = { controls: {}, references: {} }) => state
		}
	});
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	await act(async () => {
		root.render(
			React.createElement(
				Provider,
				{ store } as never,
				React.createElement(
					RawIntlProvider,
					{ value: createTestIntl() },
					React.createElement(FormsEngineDialog, {
						open: true,
						onClose() {},
						formProps: { create: { path: '/site/components', contentTypeId: contentType.id } }
					} as never)
				)
			)
		);
	});
	mounted.push({ unmount: () => root.unmount(), host });
}

/** The element aria-labelledby points at, which must be rendered once. */
function labelElement() {
	const dialog = document.querySelector('[role="dialog"]');
	assert.ok(dialog, 'no element with role dialog');
	const labelledBy = dialog.getAttribute('aria-labelledby');
	assert.ok(labelledBy, 'the dialog has no aria-labelledby');
	const title = document.getElementById(labelledBy);
	assert.ok(title, 'aria-labelledby points at an element that is not rendered');
	assert.equal(document.querySelectorAll(`[id="${labelledBy}"]`).length, 1);
	return title;
}

describe('FormsEngineDialog accessible name', () => {
	it('is named by the loading title while the content types load', async () => {
		await render(null);
		assert.equal(labelElement().textContent?.trim(), 'Please wait');
	});

	it('is named by the error title when the form fails to prepare', async () => {
		await render({});
		assert.equal(labelElement().textContent?.trim(), 'Error');
	});

	it('is named by the form title once the form is ready', async () => {
		await render({ [contentType.id]: contentType });
		const title = labelElement();
		assert.equal(title.tagName, 'H2');
		assert.match(title.textContent ?? '', /Create new "Test" component/);
	});

	it('puts the id on the root form title and not on the title of a stacked form', async () => {
		await render({ [contentType.id]: typeWithRepeat });
		const rootTitle = labelElement();
		const add = document.querySelector<HTMLElement>('[aria-label="Add items to Rows"]');
		assert.ok(add, 'the repeat control did not render');
		await act(async () => {
			add.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
		});
		const drawer = document.querySelector('[data-area-id="stackedFormDrawer"]');
		assert.ok(drawer, 'the stacked form did not open');
		// jsdom runs no CSS transitions, so the drawer never reports that it finished opening.
		await act(async () => {
			document
				.querySelector('[data-area-id="stackedFormDrawerPaper"]')
				?.dispatchEvent(new window.Event('transitionend', { bubbles: true }));
		});
		await act(async () => new Promise((resolve) => setTimeout(resolve, 100)));
		const stackedTitle = [...drawer.querySelectorAll('h3')].find((heading) =>
			/Repeat Item/i.test(heading.textContent ?? '')
		);
		assert.ok(stackedTitle, 'the stacked form has no title');
		assert.equal(stackedTitle.id, '');
		assert.equal(labelElement(), rootTitle);
	});
});
