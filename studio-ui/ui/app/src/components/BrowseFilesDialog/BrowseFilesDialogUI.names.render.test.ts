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
 * MUI's SwitchBase spreads the props Tooltip clones onto its root `<span>`, not the `<input>`, so a Tooltip title
 * never names the checkbox. The name has to go on the input through `slotProps.input`, and then it is there whether
 * or not the tooltip is open.
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
const { BrowseFilesDialogUI } = await import('./BrowseFilesDialogUI.tsx');

// The real createIntl, so a message without an id fails the test instead of getting one made up.
const intl = createIntl({ locale: 'en', messages: {}, onError: () => undefined });

const store = configureStore({
	reducer: {
		sites: (state = { active: 'editorial', byId: { editorial: { id: 'editorial', uuid: 'u1' } } }) => state,
		user: (state = { username: 'ann' }) => state,
		env: (state = { authoringBase: '/studio' }) => state,
		uiConfig: (state = { locale: { localeCode: 'en-US' } }) => state,
		content: (state = { itemsByPath: {}, itemsBeingFetchedByPath: {} }) => state,
		contentTypes: (state = { byId: {}, isFetching: false }) => state,
		preview: (state = {}) => state,
		pathNavigatorTree: (state = {}) => state
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
					React.createElement(BrowseFilesDialogUI, {
						items: [],
						guestBase: '/studio',
						selectedCard: null,
						selectedArray: [],
						multiSelect: true,
						path: '/static-assets',
						currentPath: '/static-assets',
						searchParameters: {},
						setSearchParameters() {},
						limit: 5,
						offset: 0,
						keyword: '',
						total: 0,
						sortKeys: ['path'],
						allSelected: false,
						someSelected: false,
						isCurrentPathLeaf: false,
						onCardSelected() {},
						onCheckboxChecked() {},
						handleSearchKeyword() {},
						onPathSelected() {},
						treeSelectedPath: '',
						onSelectButtonClick() {},
						onChangePage() {},
						onChangeRowsPerPage() {},
						onCloseButtonClick() {},
						onRefresh() {},
						onUpload() {},
						onToggleViewMode() {},
						onSelectAll() {}
					} as never)
				)
			)
		);
	});
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 50));
	});
	return host;
}

const selectAllInput = (host: HTMLElement) =>
	host.querySelector<HTMLInputElement>('input[type="checkbox"][aria-label="Select all"]');

describe('browse files dialog select-all name', () => {
	it('names the select-all input, not just the wrapper the tooltip clones', async () => {
		const host = await render();
		const input = selectAllInput(host);
		assert.ok(input, 'the select-all input has no name');
		// The Tooltip clones its aria-label onto SwitchBase's root span, which does not name the checkbox.
		assert.equal(input.getAttribute('aria-label'), 'Select all');
	});

	it('keeps the name while the tooltip is open', async () => {
		const host = await render();
		const input = selectAllInput(host);
		assert.ok(input, 'the select-all input has no name');
		await act(async () => {
			input.dispatchEvent(new window.MouseEvent('mouseover', { bubbles: true }));
		});
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 200));
		});
		assert.equal(document.querySelectorAll('[role="tooltip"]').length, 1, 'the tooltip did not open');
		assert.equal(input.getAttribute('aria-label'), 'Select all');
	});
});
