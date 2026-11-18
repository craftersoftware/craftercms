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
 * The settings panel is a list of settings. Every element child of the ul is an li: helper text lives in its
 * row, and the section separators are the list item divider rather than an hr between items.
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
const { ThemeProvider, createTheme } = await import('@mui/material/styles');
const { createTestIntl } = await import('../../../test/createTestIntl.mjs');
const { getStudioPaletteOptions } = await import('../../styles/palette.ts');
const { PreviewSettingsPanel } = await import('./PreviewSettingsPanel.tsx');

const theme = createTheme({ palette: { mode: 'light', ...getStudioPaletteOptions('light') } });

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
		reducer: {
			preview: (
				state = { highlightMode: 'all', editMode: false, editModePadding: false, keyboardShortcutsEnabled: true }
			) => state,
			user: (state = { username: 'admin' }) => state
		},
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
				React.createElement(
					ThemeProvider,
					{ theme },
					React.createElement(RawIntlProvider, { value: createTestIntl() }, React.createElement(PreviewSettingsPanel))
				)
			)
		);
	});
	return host;
}

function itemWith(list: HTMLElement, text: string) {
	return Array.from(list.querySelectorAll(':scope > li')).find((item) => item.textContent?.includes(text));
}

describe('PreviewSettingsPanel list', () => {
	it('has only list items, with each helper inside its item and dividers on the items', async () => {
		const host = await render();
		const lists = host.querySelectorAll('ul');
		assert.equal(lists.length, 1);
		const list = lists[0];
		const children = Array.from(list.children);
		assert.equal(children.length, 5);
		children.forEach((child) => assert.equal(child.tagName, 'LI', child.outerHTML.slice(0, 160)));
		assert.equal(host.querySelector('hr'), null);
		assert.equal(list.querySelector(':scope > p, :scope > div, :scope > hr'), null);

		const editMode = itemWith(list, 'Edit Mode (e | m)');
		assert.ok(editMode?.querySelector('p')?.textContent?.includes('in-context editing'));
		assert.equal(editMode?.classList.contains('MuiListItem-divider'), false);

		const shortcuts = itemWith(list, 'Keyboard shortcuts');
		assert.ok(shortcuts?.querySelector('p')?.textContent?.includes('keyboard shortcuts'));
		assert.equal(shortcuts?.classList.contains('MuiListItem-divider'), true);

		const subheader = list.querySelector(':scope > li.MuiListSubheader-root');
		assert.equal(subheader?.textContent, 'Highlight Mode');

		const radios = list.querySelectorAll('input[type="radio"]');
		assert.equal(radios.length, 2);
		const highlight = radios[0].closest('li');
		assert.equal(highlight?.parentElement, list);
		assert.equal(radios[1].closest('li'), highlight);
		assert.ok(highlight?.querySelector('p')?.textContent?.includes('highlight movable'));
		assert.equal(highlight?.classList.contains('MuiListItem-divider'), true);

		const padding = itemWith(list, 'Padding mode (p)');
		assert.equal(padding?.tagName, 'LI');
		assert.ok(padding?.querySelector('p')?.textContent?.includes('Adds padding to collections'));
	});
});
