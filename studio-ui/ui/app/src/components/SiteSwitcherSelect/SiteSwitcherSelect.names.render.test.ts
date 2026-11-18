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
 * The project switcher has no visible label. The combobox and the open listbox are both named "Select site".
 * The listbox is named only through labelId, which this select does not have.
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
const { default: SiteSwitcherSelect } = await import('./SiteSwitcherSelect.tsx');

const intl = createIntl({ locale: 'en', messages: {}, onError: () => undefined });

const store = configureStore({
	reducer: {
		sites: (
			state = {
				byId: {
					editorial: { id: 'editorial', name: 'Editorial', state: 'READY' }
				}
			}
		) => state,
		env: (state = { authoringBase: '/studio', useBaseDomain: false }) => state
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
					React.createElement(SiteSwitcherSelect, { site: 'editorial' })
				)
			)
		);
	});
	return host;
}

describe('project switcher select names', () => {
	it('names the combobox Select site', async () => {
		const host = await render();
		const combobox = host.querySelector<HTMLElement>('[role="combobox"]');
		assert.ok(combobox, 'the project switcher combobox is missing');
		assert.equal(combobox.getAttribute('aria-label'), 'Select site');
	});

	it('names the open listbox Select site', async () => {
		const host = await render();
		const combobox = host.querySelector<HTMLElement>('[role="combobox"]');
		assert.ok(combobox, 'the project switcher combobox is missing');
		await act(async () => {
			combobox.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, button: 0 }));
		});
		const listbox = document.querySelector<HTMLElement>('[role="listbox"]');
		assert.ok(listbox, 'the project switcher listbox did not open');
		assert.equal(listbox.getAttribute('aria-label'), 'Select site');
		assert.equal(listbox.hasAttribute('aria-labelledby'), false, 'the listbox points at a label that is not shown');
	});
});
