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
 * NodeSelector shows the items it includes and only those: an update to any other item must not re-render it, an update
 * to an included item must. Its own form item is read when an action runs, so a lock change on the form's item doesn't
 * re-render it either.
 */

import '../../../../test/stringListDomSetup.mjs';
import '../../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const {
	React,
	FormHost,
	baseItems,
	createEntry,
	createItemsStore,
	fieldFor,
	formPath,
	mountTree,
	profiled,
	sourcePath,
	unmountAll,
	unrelatedPath,
	updateItems
} = await import('../lib/formItemTestHarness');
const { default: NodeSelector } = await import('./NodeSelector');

afterEach(unmountAll);

const included = {
	...baseItems()[sourcePath],
	systemType: 'component',
	mimeType: 'application/xml',
	stateMap: {},
	availableActionsMap: { edit: true }
};

describe('NodeSelector subscriptions', () => {
	it('re-renders for the items it includes and not for other items or the form’s own item', async () => {
		const store = createItemsStore({ ...baseItems(), [sourcePath]: included });
		const entry = createEntry(['nodes_o']);
		const counts: Record<string, number> = {};
		const host = await mountTree(
			store,
			React.createElement(
				FormHost,
				{ entry },
				profiled(
					counts,
					'selector',
					React.createElement(NodeSelector as never, {
						field: fieldFor('nodes_o', 'node-selector'),
						value: [{ key: sourcePath, value: 'Source', include: sourcePath }],
						setValue: () => undefined,
						readonly: false,
						autoFocus: false,
						inputId: 'x',
						labelId: 'y',
						contentType: { id: '/component/thing', fields: {} }
					})
				)
			)
		);
		assert.match(host.textContent, /Source/);
		const before = counts.selector;

		await updateItems(store, (items) => ({ ...items, [unrelatedPath]: { ...items[unrelatedPath], label: 'Changed' } }));
		await updateItems(store, (items) => ({
			...items,
			[formPath]: { ...items[formPath], lockOwner: { username: 'max' } }
		}));
		assert.equal(counts.selector, before);

		await updateItems(store, (items) => ({ ...items, [sourcePath]: { ...items[sourcePath], label: 'Renamed' } }));
		assert.equal(counts.selector, before + 1);
		assert.match(host.textContent, /Renamed/);
	});
});
