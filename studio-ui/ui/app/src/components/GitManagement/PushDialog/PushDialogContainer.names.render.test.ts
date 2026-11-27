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
 * The remote-branch select's label id is remoteBranchToPushLabel. A mismatched labelId leaves the combobox and the
 * open listbox unnamed.
 */

import '../../../../test/stringListDomSetup.mjs';
import '../../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { RawIntlProvider, createIntl } = await import('react-intl');
const { Provider } = await import('react-redux');
const { configureStore } = await import('@reduxjs/toolkit');
const { ThemeProvider, createTheme } = await import('@mui/material/styles');
const { PushDialogContainer } = await import('./PushDialogContainer.tsx');
const { accessibleName } = await import('../../../../test/accessibleName.ts');

const intl = createIntl({ locale: 'en', messages: {}, onError: () => undefined });

// The branch preference helpers call the bare `localStorage` global. jsdom puts it on `window` only.
globalThis.localStorage = window.localStorage;

const store = configureStore({
	reducer: {
		sites: (
			state = {
				active: 'editorial',
				byId: { editorial: { id: 'editorial', uuid: 'site-uuid', name: 'Editorial' } }
			}
		) => state,
		user: (state = { username: 'ann' }) => state
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
					React.createElement(
						ThemeProvider,
						{ theme: createTheme() },
						React.createElement(PushDialogContainer, {
							branches: ['main', 'develop'],
							remoteName: 'origin',
							isSubmitting: false,
							onClose() {},
							onSubmittingChange() {}
						})
					)
				)
			)
		);
	});
	return host;
}

describe('push dialog remote branch names', () => {
	it('names the combobox from the Remote Branch to Push label', async () => {
		const host = await render();
		const combobox = host.querySelector<HTMLElement>('[role="combobox"]');
		assert.ok(combobox, 'the remote branch combobox is missing');
		assert.equal(combobox.getAttribute('aria-labelledby'), 'remoteBranchToPushLabel');
		assert.equal(accessibleName(combobox), 'Remote Branch to Push');
	});

	it('names the open listbox from the same label', async () => {
		const host = await render();
		const combobox = host.querySelector<HTMLElement>('[role="combobox"]');
		assert.ok(combobox, 'the remote branch combobox is missing');
		await act(async () => {
			combobox.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, button: 0 }));
		});
		const listbox = document.querySelector<HTMLElement>('[role="listbox"]');
		assert.ok(listbox, 'the remote branch listbox did not open');
		assert.equal(listbox.getAttribute('aria-labelledby'), 'remoteBranchToPushLabel');
		assert.equal(accessibleName(listbox), 'Remote Branch to Push');
	});
});
