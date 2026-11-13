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
 * aria-labelledby at the h2 that shows the user's name.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, it } from 'node:test';

globalThis.ShadowRoot ??= window.ShadowRoot ?? class ShadowRoot {};

// The membership editor requests groups on mount. These requests never answer, which is enough to name the dialog.
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
const { default: EditUserDialog } = await import('./EditUserDialog.tsx');

const store = configureStore({ reducer: { sites: (state = { byId: {}, active: null }) => state } });
const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
});

it('names the edit user dialog by its visible title', async () => {
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
					React.createElement(EditUserDialog, {
						open: true,
						onClose() {},
						onUserEdited() {},
						passwordRequirementsMinComplexity: 0,
						user: {
							id: 1,
							firstName: 'Ada',
							lastName: 'Lovelace',
							email: 'ada@example.com',
							username: 'ada',
							enabled: true,
							externallyManaged: true
						}
					} as never)
				)
			)
		);
	});
	mounted.push({ unmount: () => root.unmount(), host });
	const dialog = document.querySelector('[role="dialog"]');
	assert.ok(dialog, 'no element with role dialog');
	const labelledBy = dialog.getAttribute('aria-labelledby');
	assert.ok(labelledBy, 'the dialog has no aria-labelledby');
	const title = document.getElementById(labelledBy);
	assert.ok(title, 'aria-labelledby points at an element that is not rendered');
	assert.equal(title.tagName, 'H2');
	assert.equal(title.textContent?.trim(), 'Ada Lovelace');
	assert.equal(document.querySelectorAll(`[id="${labelledBy}"]`).length, 1);
});
