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
 * The workflow-state grid checkboxes sit in their own cells, outside a FormControlLabel.
 * Select-all is named directly. Each row takes its name from the visible item label.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { RawIntlProvider, createIntl } = await import('react-intl');
const { ItemStatesGridUI } = await import('./ItemStatesGridUI.tsx');

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

const item = {
	id: 1,
	label: 'Home',
	path: '/site/website/index.xml',
	systemType: 'page',
	mimeType: 'text/html',
	previewUrl: '/site/website/index.xml',
	childrenCount: 0,
	stateMap: {}
};

function accessibleName(host: HTMLElement, input: HTMLElement) {
	const labelledBy = input.getAttribute('aria-labelledby');
	if (labelledBy) {
		return labelledBy
			.split(/\s+/)
			.filter(Boolean)
			.map((id) => host.querySelector<HTMLElement>(`[id="${id}"]`)?.textContent ?? '')
			.join(' ')
			.replace(/\s+/g, ' ')
			.trim();
	}
	return input.getAttribute('aria-label') ?? '';
}

async function render() {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	mounted.push({ unmount: () => root.unmount(), host });
	const itemStates = Object.assign([item], { total: 1, limit: 10, offset: 0 });
	await act(async () => {
		root.render(
			React.createElement(
				RawIntlProvider,
				{ value: intl },
				React.createElement(ItemStatesGridUI, {
					itemStates,
					selectedItems: {},
					allItemsSelected: false,
					hasThisPageItemsChecked: false,
					isThisPageIndeterminate: false,
					onToggleSelectedItems() {},
					onItemSelected() {},
					onPageChange() {},
					onRowSelected() {}
				} as never)
			)
		);
	});
	return host;
}

describe('item state grid checkbox names', () => {
	it('names select-all and each row from the visible item label', async () => {
		const host = await render();
		const inputs = host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
		assert.equal(inputs.length, 2);
		assert.equal(accessibleName(host, inputs[0]), 'Select all');
		assert.equal(accessibleName(host, inputs[1]), 'Home');
		for (const input of inputs) {
			assert.equal(input.closest('.MuiCheckbox-root')?.getAttribute('aria-label'), null);
		}
	});
});
