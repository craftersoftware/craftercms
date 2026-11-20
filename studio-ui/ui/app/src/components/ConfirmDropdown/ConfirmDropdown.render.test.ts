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
 * The icon button is named by `iconLabel`, then by a string `iconTooltip`, and only falls back to "Confirm" when
 * neither is a string.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const { React, mountTree, unmountAll, createItemsStore, baseItems } =
	await import('../FormsEngine/lib/formItemTestHarness');
const { ConfirmDropdown } = await import('./ConfirmDropdown.tsx');
const { default: DeleteRounded } = await import('@mui/icons-material/DeleteRounded');

afterEach(() => {
	unmountAll();
});

async function nameOf(extra: Record<string, unknown>) {
	const host = await mountTree(
		createItemsStore(baseItems()),
		React.createElement(ConfirmDropdown, {
			icon: DeleteRounded,
			cancelText: 'No',
			confirmText: 'Yes',
			onConfirm() {},
			...extra
		} as never)
	);
	return host.querySelector('button')?.getAttribute('aria-label');
}

describe('ConfirmDropdown icon button name', () => {
	it('uses a string iconTooltip', async () => {
		assert.equal(await nameOf({ iconTooltip: 'Delete Title' }), 'Delete Title');
	});

	it('prefers an explicit iconLabel', async () => {
		assert.equal(await nameOf({ iconTooltip: 'Delete', iconLabel: 'Delete Title' }), 'Delete Title');
	});

	it('falls back to Confirm when the tooltip is not a string', async () => {
		assert.equal(await nameOf({ iconTooltip: React.createElement('b', null, 'Delete') }), 'Confirm');
		assert.equal(await nameOf({}), 'Confirm');
	});

	it('keeps the node tooltip while naming the button with iconLabel', async () => {
		assert.equal(
			await nameOf({ iconTooltip: React.createElement('b', null, 'Delete'), iconLabel: 'Delete Title' }),
			'Delete Title'
		);
	});
});
