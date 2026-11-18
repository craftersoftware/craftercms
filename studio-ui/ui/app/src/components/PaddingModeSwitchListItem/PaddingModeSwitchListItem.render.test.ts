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
 * The padding mode row is a list item only where the caller puts it in a list.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { RawIntlProvider } = await import('react-intl');
const { Provider } = await import('react-redux');
const { configureStore } = await import('@reduxjs/toolkit');
const { default: List } = await import('@mui/material/List');
const { createTestIntl } = await import('../../../test/createTestIntl.mjs');
const { PaddingModeSwitchListItem } = await import('./PaddingModeSwitchListItem.tsx');

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	await act(async () => {
		for (const { unmount, host } of mounted.splice(0)) {
			unmount();
			host.remove();
		}
	});
});

async function render(element: React.ReactElement) {
	const store = configureStore({
		reducer: { preview: (state = { editModePadding: false }) => state },
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
				React.createElement(RawIntlProvider, { value: createTestIntl() }, element)
			)
		);
	});
	return host;
}

describe('PaddingModeSwitchListItem', () => {
	it('renders a div when it is a standalone widget, so no list item sits outside a list', async () => {
		const host = await render(React.createElement(PaddingModeSwitchListItem));
		assert.equal(host.querySelector('li'), null);
		assert.ok(host.querySelector('div.MuiListItem-root input[type="checkbox"]'));
	});

	it('renders an li when the caller places it in a list', async () => {
		const host = await render(
			React.createElement(List, null, React.createElement(PaddingModeSwitchListItem, { component: 'li' }))
		);
		assert.equal(host.querySelectorAll('ul > li.MuiListItem-root').length, 1);
		assert.equal(host.querySelectorAll('li').length, 1);
	});

	it('keeps the helper text inside the list item, so the list has no other element children', async () => {
		const host = await render(
			React.createElement(
				List,
				null,
				React.createElement(PaddingModeSwitchListItem, { component: 'li', showHelperText: true, showIcon: false })
			)
		);
		const list = host.querySelector('ul');
		assert.ok(list);
		const children = Array.from(list.children);
		assert.equal(children.length, 1);
		assert.equal(children[0].tagName, 'LI');
		const helper = children[0].querySelector('p');
		assert.ok(helper?.textContent?.includes('Adds padding to collections'));
		assert.equal(list.querySelector(':scope > p'), null);
	});
});
