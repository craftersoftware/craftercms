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
 * Sort order has no visible label. The combobox and the open listbox are both named "Sort order"
 * through SelectDisplayProps and the list slot, with no dangling aria-labelledby.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { RawIntlProvider, createIntl } = await import('react-intl');
const { SiteSearchSortOrder } = await import('./SiteSearchSortOrder.tsx');
const { accessibleName } = await import('../../../test/accessibleName.ts');

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

async function render() {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	mounted.push({ unmount: () => root.unmount(), host });
	await act(async () => {
		root.render(
			React.createElement(
				RawIntlProvider,
				{ value: intl },
				React.createElement(SiteSearchSortOrder, {
					sortBy: 'internalName',
					sortOrder: 'asc',
					handleFilterChange() {}
				})
			)
		);
	});
	return host;
}

describe('site search sort order names', () => {
	it('names the combobox and the open listbox Sort order, with no dangling aria-labelledby', async () => {
		const host = await render();
		const combobox = host.querySelector<HTMLElement>('[role="combobox"]');
		assert.ok(combobox, 'the sort order combobox is missing');
		assert.equal(accessibleName(combobox), 'Sort order');
		assert.equal(combobox.hasAttribute('aria-labelledby'), false, 'the combobox points at a label that is not shown');
		await act(async () => {
			combobox.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, button: 0 }));
		});
		const listbox = document.querySelector<HTMLElement>('[role="listbox"]');
		assert.ok(listbox, 'the sort order listbox did not open');
		assert.equal(accessibleName(listbox), 'Sort order');
		assert.equal(listbox.hasAttribute('aria-labelledby'), false, 'the listbox points at a label that is not shown');
	});
});
