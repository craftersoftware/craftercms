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
 * The dashlet page picker is a MUI Select. Its closed text ("Page N") is the value, not a visible label, so the
 * accessible name does not repeat it (WCAG 2.5.3). The name is the static word "Page".
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { RawIntlProvider, createIntl } = await import('react-intl');
const { Pager } = await import('./dashletCommons.tsx');

const intl = createIntl({ locale: 'en', messages: {}, onError: () => undefined });

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	await act(async () => {
		for (const { unmount, host } of mounted.splice(0)) {
			unmount();
			host.remove();
		}
	});
});

async function render(currentPage = 0) {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	mounted.push({ unmount: () => root.unmount(), host });
	await act(async () => {
		root.render(
			React.createElement(
				RawIntlProvider,
				{ value: intl },
				React.createElement(Pager, {
					totalPages: 5,
					totalItems: 228,
					currentPage,
					rowsPerPage: 50,
					onPagePickerChange() {},
					onPageChange() {},
					onRowsPerPageChange() {}
				})
			)
		);
	});
	return host;
}

describe('dashlet page picker name', () => {
	it('names the page combobox Page, and shows the current page as its value', async () => {
		const host = await render(0);
		const comboboxes = host.querySelectorAll<HTMLElement>('[role="combobox"]');
		const pagePicker = Array.from(comboboxes).find((node) => !node.classList.contains('MuiTablePagination-select'));
		assert.ok(pagePicker, 'the page picker combobox is missing');
		assert.equal(pagePicker.getAttribute('aria-label'), 'Page');
		assert.equal(pagePicker.textContent?.replace(/\s+/g, ' ').trim(), 'Page 1');
	});

	it('keeps the name when the current page changes', async () => {
		const host = await render(2);
		const pagePicker = Array.from(host.querySelectorAll<HTMLElement>('[role="combobox"]')).find(
			(node) => !node.classList.contains('MuiTablePagination-select')
		);
		assert.equal(pagePicker?.getAttribute('aria-label'), 'Page');
		assert.equal(pagePicker?.textContent?.replace(/\s+/g, ' ').trim(), 'Page 3');
	});
});
