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

import '../../../../test/stringListDomSetup.mjs';
import '../../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const { atom } = await import('jotai');
const React = await import('react');
const { PageNavOrder } = await import('./PageNavOrder.tsx');
const { FormHost, baseItems, createEntry, createItemsStore, fieldFor, mountTree, unmountAll } =
	await import('../lib/formItemTestHarness.ts');

afterEach(() => {
	unmountAll();
});

describe('PageNavOrder without an internal-name field', () => {
	it('opens instead of reading a missing internal-name atom', async () => {
		const items = baseItems();
		// No path, so the control does not ask the server for nav order. The crash under test is the missing atom.
		items['/site/website/about/index.xml'] = { ...items['/site/website/about/index.xml'], path: '' };
		const store = createItemsStore(items);
		const entry = createEntry(['placeInNav', 'orderDefault_f']);
		entry.atoms.fileName = atom('');
		const host = await mountTree(
			store,
			React.createElement(
				FormHost,
				{ entry },
				React.createElement(PageNavOrder, {
					field: fieldFor('placeInNav', 'page-nav-order'),
					value: false,
					setValue: () => undefined,
					autoFocus: false,
					readonly: false,
					contentType: { id: '/page/no-internal-name', name: 'Page', fields: {} } as never,
					inputId: 'place-in-nav',
					labelId: 'place-in-nav-label'
				})
			)
		);
		assert.match(host.textContent ?? '', /Label of placeInNav/);
	});
});
