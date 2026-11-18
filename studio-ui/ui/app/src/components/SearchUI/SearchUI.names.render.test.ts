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
const { SearchUI } = await import('./SearchUI.tsx');

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
		search: (state = {}) => state
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

const baseProps = {
	mode: 'select',
	embedded: false,
	desktopScreen: true,
	areAllSelected: false,
	error: null,
	isFetching: false,
	sortBy: 'internalName',
	sortOrder: 'asc',
	searchParameters: { limit: 9 },
	currentView: 'card',
	keyword: '',
	checkedFilters: {},
	drawerOpen: false,
	searchResults: { items: [], total: 0, facets: [], offset: 0 },
	selectedPath: null,
	selected: [],
	guestBase: '/studio',
	selectionOptions: {},
	preselectedLookup: {},
	handleSearchKeyword() {},
	toggleDrawer() {},
	handleChangeView() {},
	handleFilterChange() {},
	clearFilter() {},
	clearFilters() {},
	onSelectedPathChanges() {},
	onCheckedFiltersChanges() {},
	handleSelectAll() {},
	handleChangePage() {},
	handleChangeRowsPerPage() {},
	onPreview() {},
	handleSelect() {},
	onHeaderButtonClick() {},
	onActionClicked() {},
	handleClearSelected() {},
	onClose() {},
	onAcceptSelection() {}
};

async function mount(overrides: Record<string, unknown> = {}) {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	mounted.push({ unmount: () => root.unmount(), host });
	const element = (extra: Record<string, unknown>) =>
		React.createElement(
			Provider,
			{ store },
			React.createElement(
				RawIntlProvider,
				{ value: intl },
				React.createElement(SearchUI, { ...baseProps, ...overrides, ...extra } as never)
			)
		);
	await act(async () => {
		root.render(element({}));
	});
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 60));
	});
	return {
		host,
		async update(extra: Record<string, unknown>) {
			await act(async () => {
				root.render(element(extra));
			});
		}
	};
}

async function render() {
	return (await mount()).host;
}

const selectAllInput = (host: HTMLElement) =>
	host.querySelector<HTMLInputElement>('input[type="checkbox"][aria-label="Select all on this page"]');

describe('search rows-per-page name', () => {
	it('names the rows-per-page combobox "Items per page" without rendering a visible label', async () => {
		const host = (await mount({ searchParameters: { limit: 9, offset: 0 } })).host;
		const combobox = host.querySelector<HTMLElement>('.MuiTablePagination-select[role="combobox"]');
		assert.ok(combobox, 'the rows-per-page combobox is missing');
		const ids = combobox.getAttribute('aria-labelledby')?.split(/\s+/).filter(Boolean) ?? [];
		const name =
			combobox.getAttribute('aria-label') ??
			ids
				.map((id) => host.querySelector<HTMLElement>(`[id="${id}"]`)?.textContent ?? '')
				.join(' ')
				.replace(/\s+/g, ' ')
				.trim();
		assert.match(name, /^Items per page$/);
		const pagination = host.querySelector<HTMLElement>('.MuiTablePagination-root');
		assert.ok(pagination, 'the pagination toolbar is missing');
		assert.doesNotMatch(pagination.textContent ?? '', /Items per page/);
		assert.equal(
			pagination.querySelector('.MuiTablePagination-selectLabel')?.textContent ?? '',
			'',
			'a visible rows-per-page label is rendered'
		);
		assert.equal(combobox.hasAttribute('aria-labelledby'), false, 'the combobox points at a label that is not shown');
	});
});

describe('search rows-per-page listbox name', () => {
	it('names the open listbox "Items per page" with no dangling aria-labelledby', async () => {
		const host = (await mount({ searchParameters: { limit: 9, offset: 0 } })).host;
		const combobox = host.querySelector<HTMLElement>('.MuiTablePagination-select[role="combobox"]');
		assert.ok(combobox, 'the rows-per-page combobox is missing');
		await act(async () => {
			combobox.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, button: 0 }));
		});
		const listbox = document.querySelector<HTMLElement>('[role="listbox"]');
		assert.ok(listbox, 'the rows-per-page listbox did not open');
		assert.equal(listbox.getAttribute('aria-label'), 'Items per page');
		assert.equal(listbox.hasAttribute('aria-labelledby'), false, 'the listbox points at a label that is not shown');
	});
});

describe('search select-all name', () => {
	it('names the select-all input, not just the wrapper the tooltip clones', async () => {
		const host = await render();
		const input = selectAllInput(host);
		assert.ok(input, 'the select-all input has no name');
		assert.equal(input.getAttribute('aria-label'), 'Select all on this page');
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
		assert.equal(input.getAttribute('aria-label'), 'Select all on this page');
	});
});

describe('search results status', () => {
	const items = (count: number) =>
		Array.from({ length: count }, (_, i) => ({
			path: `/site/website/p${i}`,
			name: `p${i}`,
			type: 'Page',
			mimeType: 'text/html',
			previewUrl: '',
			lastModifier: 'ann',
			lastModified: '2026-01-01T00:00:00Z',
			size: 1,
			snippets: {}
		}));
	const status = (host: HTMLElement) => host.querySelector('[role="status"]')?.textContent;
	const page = (offset: number, count: number, total = 34) => ({ items: items(count), total, facets: [], offset });

	it('announces the range of the loaded response', async () => {
		const { host } = await mount({ searchParameters: { limit: 9, offset: 9 }, searchResults: page(9, 9) });
		assert.equal(status(host), '10-18 of 34 results');
	});

	it('does not build the range from the requested offset while the previous page is still shown', async () => {
		const { host, update } = await mount({ searchParameters: { limit: 9, offset: 0 }, searchResults: page(0, 9) });
		assert.equal(status(host), '1-9 of 34 results');
		// Paging forward: the offset parameter changes before the request starts, so the old items are still shown.
		await update({ searchParameters: { limit: 9, offset: 9 } });
		assert.equal(status(host), '1-9 of 34 results');
		await update({ searchParameters: { limit: 9, offset: 9 }, isFetching: true });
		assert.equal(status(host), '');
		await update({ searchParameters: { limit: 9, offset: 9 }, searchResults: page(9, 9) });
		assert.equal(status(host), '10-18 of 34 results');
	});

	it('announces the right range when going back from a short last page', async () => {
		const { host, update } = await mount({ searchParameters: { limit: 9, offset: 27 }, searchResults: page(27, 7) });
		assert.equal(status(host), '28-34 of 34 results');
		await update({ searchParameters: { limit: 9, offset: 18 } });
		assert.equal(status(host), '28-34 of 34 results');
		await update({ searchParameters: { limit: 9, offset: 18 }, isFetching: true });
		assert.equal(status(host), '');
		await update({ searchParameters: { limit: 9, offset: 18 }, searchResults: page(18, 9) });
		assert.equal(status(host), '19-27 of 34 results');
	});

	it('falls back to the search parameters when the response carries no offset', async () => {
		const { offset: _omitted, ...plain } = page(9, 9);
		const { host } = await mount({ searchParameters: { limit: 9, offset: 9 }, searchResults: plain });
		assert.equal(status(host), '10-18 of 34 results');
	});

	it('falls back to zero when neither the response nor the parameters carry an offset', async () => {
		const { offset: _omitted, ...plain } = page(0, 9);
		const { host } = await mount({ searchParameters: { limit: 9 }, searchResults: plain });
		assert.equal(status(host), '1-9 of 34 results');
	});

	it('announces the range for the last short page itself', async () => {
		const { host } = await mount({ searchParameters: { limit: 9, offset: 30 }, searchResults: page(30, 4) });
		assert.equal(status(host), '31-34 of 34 results');
	});
});
