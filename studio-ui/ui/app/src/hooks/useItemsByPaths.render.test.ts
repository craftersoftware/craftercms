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

import '../../test/stringListDomSetup.mjs';
import '../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const { React, baseItems, createItemsStore, formPath, mount, sourcePath, unmountAll, unrelatedPath, updateItems } =
	await import('../components/FormsEngine/lib/formItemTestHarness');
const { useItemsByPaths } = await import('./useItemsByPaths');

afterEach(unmountAll);

function Reader({ paths, seen }: { paths: string[]; seen: Array<Record<string, { label?: string } | undefined>> }) {
	seen.push(useItemsByPaths(paths));
	return null;
}

describe('useItemsByPaths', () => {
	it('returns the stored item of each path, and undefined for a path that is not stored', async () => {
		const store = createItemsStore(baseItems());
		const seen: Array<Record<string, { label?: string } | undefined>> = [];
		await mount(store, React.createElement(Reader, { paths: [formPath, '/missing'], seen }));
		assert.equal(seen.at(-1)[formPath].label, 'About');
		assert.equal(seen.at(-1)['/missing'], undefined);
	});

	it('re-renders for an update to a watched item and not for any other item', async () => {
		const store = createItemsStore(baseItems());
		const seen: Array<Record<string, { label?: string } | undefined>> = [];
		await mount(store, React.createElement(Reader, { paths: [formPath, sourcePath], seen }));
		const before = seen.length;

		await updateItems(store, (items) => ({ ...items, [unrelatedPath]: { ...items[unrelatedPath], label: 'Changed' } }));
		assert.equal(seen.length, before, 'an unwatched item changed');

		await updateItems(store, (items) => ({ ...items, [sourcePath]: { ...items[sourcePath], label: 'Renamed' } }));
		assert.equal(seen.length, before + 1);
		assert.equal(seen.at(-1)[sourcePath].label, 'Renamed');
	});

	it('follows a change of paths, ignores duplicates and an equal list in a new array', async () => {
		const store = createItemsStore(baseItems());
		const seen: Array<Record<string, { label?: string } | undefined>> = [];
		const { rerender } = await mount(store, React.createElement(Reader, { paths: [formPath], seen }));
		let before = seen.length;
		await rerender(React.createElement(Reader, { paths: [formPath, formPath], seen }));
		assert.deepEqual(Object.keys(seen.at(-1)), [formPath], 'duplicates collapse');
		before = seen.length;

		await updateItems(store, (items) => ({ ...items, [sourcePath]: { ...items[sourcePath], label: 'Renamed' } }));
		assert.equal(seen.length, before, 'not watching it yet');

		await rerender(React.createElement(Reader, { paths: [formPath, sourcePath], seen }));
		assert.equal(seen.at(-1)[sourcePath].label, 'Renamed');
	});

	it('handles an empty list', async () => {
		const store = createItemsStore(baseItems());
		const seen: Array<Record<string, { label?: string } | undefined>> = [];
		await mount(store, React.createElement(Reader, { paths: [], seen }));
		assert.deepEqual(seen.at(-1), {});
	});
});
