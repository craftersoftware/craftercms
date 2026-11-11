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
 * The select-all checkbox keeps its name in every state the callers use: unchecked, indeterminate and checked, and it
 * is gone with showCheckbox false.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const { React, createItemsStore, baseItems, mountTree, unmountAll } =
	await import('../FormsEngine/lib/formItemTestHarness');
const { ActionsBar } = await import('./ActionsBar.tsx');

afterEach(() => {
	unmountAll();
});

async function render(extra: Record<string, unknown>) {
	return mountTree(
		createItemsStore(baseItems()),
		React.createElement(ActionsBar, {
			options: [
				{ id: 'delete', label: 'Delete selected' },
				{ id: 'clear', label: 'Clear' }
			],
			isIndeterminate: false,
			isChecked: false,
			onOptionClicked() {},
			onCheckboxChange() {},
			...extra
		} as never)
	);
}

const checkboxOf = (host: HTMLElement) => host.querySelector<HTMLInputElement>('input[type="checkbox"]');

describe('ActionsBar select-all checkbox', () => {
	for (const [state, extra] of [
		['unchecked', {}],
		['indeterminate', { isIndeterminate: true }],
		['checked', { isChecked: true }],
		['disabled', { disabled: true }]
	] as const) {
		it(`is named when ${state}`, async () => {
			const host = await render(extra);
			assert.equal(checkboxOf(host)?.getAttribute('aria-label'), 'Select all');
			assert.deepEqual(
				Array.from(host.querySelectorAll('button'), (button) => button.textContent),
				['Delete selected', 'Clear']
			);
		});
	}

	it('renders no checkbox when showCheckbox is false', async () => {
		const host = await render({ showCheckbox: false });
		assert.equal(checkboxOf(host), null);
	});
});
