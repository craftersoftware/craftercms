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
 * The Options and Filter buttons repeat on every tree row, so their names carry the row's item.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const { React, createItemsStore, baseItems, mountTree, settle, unmountAll } =
	await import('../FormsEngine/lib/formItemTestHarness');
const { act } = await import('react');
const { SimpleTreeView } = await import('@mui/x-tree-view/SimpleTreeView');
const { PathNavigatorTreeItem } = await import('./PathNavigatorTreeItem.tsx');

afterEach(() => {
	unmountAll();
});

const path = '/site/website';
const item = {
	id: 'website-id',
	path,
	label: 'Website',
	systemType: 'folder',
	mimeType: 'application/vnd.craftercms.folder',
	childrenCount: 2,
	stateMap: {},
	availableActionsMap: {}
};

async function render() {
	const host = await mountTree(
		createItemsStore(baseItems()),
		React.createElement(
			SimpleTreeView,
			{ defaultExpandedItems: [path] },
			React.createElement(PathNavigatorTreeItem, {
				path,
				itemsByPath: { [path]: item },
				keywordByPath: {},
				totalByPath: { [path]: 0 },
				childrenByParentPath: {},
				errorByPath: {},
				onLabelClick() {},
				onIconClick() {},
				onOpenItemMenu() {},
				onFilterChange() {},
				onMoreClick() {}
			} as never)
		)
	);
	await act(async () => {
		host.querySelector('section[role="button"]')?.dispatchEvent(new window.MouseEvent('mouseover', { bubbles: true }));
	});
	await settle();
	return host;
}

describe('PathNavigatorTreeItem row button names', () => {
	it('names the Options and Filter buttons for the item', async () => {
		const host = await render();
		const labels = Array.from(host.querySelectorAll('button[aria-label]'), (button) =>
			button.getAttribute('aria-label')
		);
		assert.ok(labels.includes('Options for Website'), labels.join(' | '));
		assert.ok(labels.includes('Filter Website'), labels.join(' | '));
		assert.equal(labels.includes('Options'), false);
		assert.equal(labels.includes('Filter'), false);
	});
});
