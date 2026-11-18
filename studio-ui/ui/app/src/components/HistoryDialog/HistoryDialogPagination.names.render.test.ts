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
 * The rows-per-page select has no visible label (`labelRowsPerPage=""`), so TablePagination's `aria-labelledby` points
 * at an empty element. The combobox and the open listbox are named directly instead.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { IntlProvider } = await import('react-intl');
const { HistoryDialogPagination } = await import('./HistoryDialogPagination.tsx');

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
});

async function render() {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	await act(async () => {
		root.render(
			React.createElement(
				IntlProvider,
				{ locale: 'en', messages: {}, onError() {} },
				React.createElement(HistoryDialogPagination, {
					count: 45,
					page: 0,
					rowsPerPage: 10,
					onPageChanged() {},
					onRowsPerPageChange() {}
				})
			)
		);
	});
	mounted.push({ unmount: () => root.unmount(), host });
	return host;
}

describe('history pagination rows-per-page names', () => {
	it('names the combobox "Items per page" with no dangling aria-labelledby', async () => {
		const host = await render();
		const combobox = host.querySelector<HTMLElement>('.MuiTablePagination-select[role="combobox"]');
		assert.ok(combobox, 'the rows-per-page combobox is missing');
		assert.equal(combobox.getAttribute('aria-label'), 'Items per page');
		assert.equal(combobox.hasAttribute('aria-labelledby'), false, 'the combobox points at a label that is not shown');
		assert.equal(host.querySelector('.MuiTablePagination-selectLabel')?.textContent ?? '', '');
	});

	it('names the open listbox "Items per page" with no dangling aria-labelledby', async () => {
		const host = await render();
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
