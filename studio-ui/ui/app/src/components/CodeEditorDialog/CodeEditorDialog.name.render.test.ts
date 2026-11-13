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
 * The dialog omits EnhancedDialog's header and draws its own, so it names itself by pointing
 * aria-labelledby at the DialogHeader title. The title is a skeleton until the item is fetched, and stays one
 * if the fetch never succeeds, so a visually hidden title keeps the name from being empty.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

globalThis.ShadowRoot ??= window.ShadowRoot ?? class ShadowRoot {};

// The requests for the item's content never answer, which is how a slow or failed fetch looks to the dialog.
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
const { default: CodeEditorDialog } = await import('./CodeEditorDialog.tsx');

const path = '/templates/web/page.ftl';
const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
});

async function render(itemsByPath: Record<string, unknown>) {
	const store = configureStore({
		reducer: {
			env: (state = {}) => state,
			sites: (state = { active: 'editorial', byId: {} }) => state,
			user: (state = { username: 'ada' }) => state,
			content: (state = { itemsByPath, itemsBeingFetchedByPath: { [path]: true } }) => state,
			contentTypes: (state = { byId: null, isFetching: true, error: null }) => state,
			uiConfig: (state = { references: {} }) => state
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
					React.createElement(CodeEditorDialog, { open: true, path, onClose() {}, onMinimize() {} } as never)
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

describe('CodeEditorDialog accessible name', () => {
	it('is named by the dialog title while the item has not loaded', async () => {
		await render({});
		const title = labelElement();
		assert.equal(title.tagName, 'H2');
		assert.equal(title.textContent?.trim(), 'Code Editor');
	});

	it('is named by the item label once the item has loaded', async () => {
		await render({ [path]: { path, label: 'page.ftl', state: 'NEW', lockOwner: null } });
		const title = labelElement();
		assert.equal(title.textContent?.trim(), 'page.ftl');
	});
});
