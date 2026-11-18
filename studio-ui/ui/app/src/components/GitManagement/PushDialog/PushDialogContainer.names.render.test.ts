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
 * The push dialog's remote-branch select is named by its visible label. The label id is
 * remoteBranchToPushLabel; a labelId that still says Pull leaves both the combobox and the listbox unnamed.
 */

import '../../../../test/stringListDomSetup.mjs';
import '../../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

globalThis.localStorage ??= window.localStorage;

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { RawIntlProvider, createIntl } = await import('react-intl');
const { Provider } = await import('react-redux');
const { configureStore } = await import('@reduxjs/toolkit');
const { ThemeProvider, createTheme } = await import('@mui/material/styles');
const { PushDialogContainer } = await import('./PushDialogContainer.tsx');

const intl = createIntl({ locale: 'en', messages: {}, onError: () => undefined });
const theme = createTheme();

const store = configureStore({
	reducer: {
		sites: (
			state = {
				active: 'editorial',
				byId: { editorial: { id: 'editorial', uuid: 'site-uuid', name: 'Editorial' } }
			}
		) => state,
		user: (state = { username: 'admin' }) => state
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
	window.localStorage.clear();
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
						{ theme },
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

function labelText(labelledBy: string | null) {
	const ids = labelledBy?.split(/\s+/).filter(Boolean) ?? [];
	return ids
		.map((id) => document.getElementById(id)?.textContent ?? '')
		.join(' ')
		.replace(/\s+/g, ' ')
		.trim();
}

describe('push dialog remote branch select name', () => {
	it('names the combobox from the visible Remote Branch to Push label', async () => {
		const host = await render();
		const combobox = host.querySelector<HTMLElement>('[role="combobox"]');
		assert.ok(combobox, 'the remote branch combobox is missing');
		assert.equal(combobox.getAttribute('aria-labelledby'), 'remoteBranchToPushLabel');
		assert.equal(labelText(combobox.getAttribute('aria-labelledby')), 'Remote Branch to Push');
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
		assert.equal(labelText(listbox.getAttribute('aria-labelledby')), 'Remote Branch to Push');
	});
});
