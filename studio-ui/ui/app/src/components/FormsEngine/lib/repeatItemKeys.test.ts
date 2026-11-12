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
 * Repeat rows keep one key per item object, and remove and reorder build from the stored array.
 * The key ids live in a WeakMap, so they are not on the items that get saved.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import '../../../../test/registerTsLoader.mjs';

const {
	carryReplacedItem,
	createRepeatItemKeys,
	findRepeatItemIndex,
	removeRepeatItem,
	repeatItemKeysFor,
	repeatOccurrenceKeys
} = await import('./repeatItemKeys.ts');
const { reorderRepeatItems, repeatSortItems } = await import('../controls/repeatItemDisplay.ts');

describe('createRepeatItemKeys', () => {
	it('gives each item its own key and returns the same one for the same object', () => {
		const keys = createRepeatItemKeys<Record<string, unknown>>();
		const [a, b] = [{ name: 'a' }, { name: 'b' }];
		assert.notEqual(keys.keyOf(a), keys.keyOf(b));
		assert.equal(keys.keyOf(a), keys.keyOf(a));
	});

	it('keeps the key with the item after a reorder or a delete', () => {
		const keys = createRepeatItemKeys<Record<string, unknown>>();
		const items = [{ name: 'a' }, { name: 'b' }, { name: 'c' }];
		const before = new Map(items.map((item) => [item, keys.keyOf(item)]));
		const reordered = [items[2], items[0], items[1]];
		for (const item of reordered) assert.equal(keys.keyOf(item), before.get(item));
		const afterDelete = removeRepeatItem(reordered, 0);
		for (const item of afterDelete) assert.equal(keys.keyOf(item), before.get(item));
	});

	it('does not add anything to the item', () => {
		const keys = createRepeatItemKeys<Record<string, unknown>>();
		const item = { name: 'a' };
		keys.keyOf(item);
		assert.deepEqual(Object.keys(item), ['name']);
		assert.equal(JSON.stringify(item), '{"name":"a"}');
	});

	it('carries the key to the object that replaces an edited item, and only once', () => {
		const keys = createRepeatItemKeys<Record<string, unknown>>();
		const original = { name: 'a' };
		const edited = { name: 'a2' };
		const key = keys.keyOf(original);
		keys.carry(original, edited);
		assert.equal(keys.keyOf(edited), key);
		const other = { name: 'b' };
		const otherKey = keys.keyOf(other);
		keys.carry(original, other);
		assert.equal(keys.keyOf(other), otherKey);
	});

	it('gives a replaced item that was never keyed one, so the open item can still be found', () => {
		const keys = createRepeatItemKeys<Record<string, unknown>>();
		const original = { name: 'a' };
		const edited = { name: 'a2' };
		keys.carry(original, edited);
		assert.equal(keys.keyOf(edited), keys.keyOf(original));
		assert.equal(findRepeatItemIndex([edited], original, keys), 0);
	});

	it('has no key for a value that is not an object', () => {
		const keys = createRepeatItemKeys<unknown>();
		assert.equal(keys.keyOf(null), undefined);
		assert.equal(keys.keyOf('text'), undefined);
	});
});

describe('removeRepeatItem', () => {
	it('removes from a copy and leaves the source array alone', () => {
		const source = [{ n: 1 }, { n: 2 }, { n: 3 }];
		const next = removeRepeatItem(source, 1);
		assert.deepEqual(next, [{ n: 1 }, { n: 3 }]);
		assert.equal(source.length, 3);
	});
});

describe('repeatItemKeysFor', () => {
	it('is one instance per owner', () => {
		const owner = {};
		assert.equal(repeatItemKeysFor(owner), repeatItemKeysFor(owner));
		assert.notEqual(repeatItemKeysFor(owner), repeatItemKeysFor({}));
	});
});

describe('carryReplacedItem', () => {
	it('moves the key of the replaced item to the new object', () => {
		const keys = createRepeatItemKeys<Record<string, unknown>>();
		const previous = [{ n: 'a' }, { n: 'b' }];
		const next = [previous[0], { n: 'b2' }];
		const key = keys.keyOf(previous[1]);
		carryReplacedItem(keys, previous, next, 1);
		assert.equal(keys.keyOf(next[1]), key);
	});

	it('does nothing without keys, an index or an array', () => {
		const keys = createRepeatItemKeys<Record<string, unknown>>();
		const previous = [{ n: 'a' }];
		const next = [{ n: 'a2' }];
		carryReplacedItem(undefined, previous, next, 0);
		carryReplacedItem(keys, previous, next, undefined);
		carryReplacedItem(keys, undefined, next, 0);
		carryReplacedItem(keys, previous, undefined, 0);
		assert.notEqual(keys.keyOf(next[0]), keys.keyOf(previous[0]));
	});
});

describe('findRepeatItemIndex', () => {
	it('finds the same object wherever it moved to', () => {
		const keys = createRepeatItemKeys<Record<string, unknown>>();
		const [a, b, c] = [{ n: 'a' }, { n: 'b' }, { n: 'c' }];
		assert.equal(findRepeatItemIndex([c, a, b], b, keys), 2);
	});

	it('finds an item an edit replaced, by its carried key', () => {
		const keys = createRepeatItemKeys<Record<string, unknown>>();
		const [a, b] = [{ n: 'a' }, { n: 'b' }];
		const editedB = { n: 'b2' };
		keys.keyOf(b);
		keys.carry(b, editedB);
		assert.equal(findRepeatItemIndex([a, editedB], b, keys), 1);
	});

	it('is -1 when the item is gone', () => {
		const keys = createRepeatItemKeys<Record<string, unknown>>();
		assert.equal(findRepeatItemIndex([{ n: 'a' }], { n: 'gone' }, keys), -1);
	});
});

describe('repeatSortItems and reorderRepeatItems', () => {
	const setup = () => {
		const keys = createRepeatItemKeys<Record<string, unknown>>();
		const items = [{ n: 'a' }, { n: 'b' }, { n: 'c' }];
		const sortList = repeatSortItems(items, ['n'], keys);
		return { keys, items, sortList, keyOf: (item: Record<string, unknown>) => keys.keyOf(item) };
	};

	it('labels each sort row with the key of its item, and keeps the item as data', () => {
		const { items, sortList, keyOf } = setup();
		assert.deepEqual(
			sortList.map((row) => row.key),
			items.map(keyOf)
		);
		assert.equal(sortList[1].data, items[1]);
		assert.equal(sortList[1].value, 'b');
	});

	it('orders the stored items by the sorted keys', () => {
		const { keys, items, sortList } = setup();
		const next = reorderRepeatItems(items, [sortList[2], sortList[0], sortList[1]], keys);
		assert.deepEqual(next, [items[2], items[0], items[1]]);
	});

	it('targets items by key when the stored array shifted after the list was built', () => {
		const { keys, items, sortList } = setup();
		const [a, b, c] = items;
		// Stored now: a was removed and a new item was prepended. Positions no longer match the list.
		const added = { n: 'added' };
		const stored = [added, b, c];
		const next = reorderRepeatItems(stored, [sortList[2], sortList[0], sortList[1]], keys);
		// c first, the removed a is dropped, b follows, and the unknown item stays at the end.
		assert.deepEqual(next, [c, b, added]);
	});

	it('uses the stored object when an edit replaced the item and carried its key', () => {
		const { keys, items, sortList } = setup();
		const editedB = { n: 'b2' };
		keys.carry(items[1], editedB);
		const next = reorderRepeatItems([items[0], editedB, items[2]], [sortList[1], sortList[0], sortList[2]], keys);
		assert.equal(next[0], editedB);
	});

	it('returns the stored array itself when the order is unchanged', () => {
		const { keys, items, sortList } = setup();
		assert.equal(reorderRepeatItems(items, sortList, keys), items);
	});

	it('ignores a key that matches nothing and keeps every stored item', () => {
		const { keys, items } = setup();
		const next = reorderRepeatItems(items, [{ key: 'nope' }], keys);
		assert.deepEqual(next, items);
	});
});

describe('an item object stored twice', () => {
	// A form controller can write the same object into the array twice: [a, a, b].
	const setup = () => {
		const keys = createRepeatItemKeys<Record<string, unknown>>();
		const [a, b] = [{ n: 'a' }, { n: 'b' }];
		return { keys, a, b, items: [a, a, b] };
	};

	it('gets a distinct occurrence key per position', () => {
		const { keys, a, items } = setup();
		const rowKeys = repeatOccurrenceKeys(items, keys);
		assert.equal(new Set(rowKeys).size, 3);
		assert.equal(rowKeys[0], keys.keyOf(a));
		assert.deepEqual(repeatOccurrenceKeys(items, keys), rowKeys);
	});

	it('finds the occurrence the caller saw, and the first one without a hint', () => {
		const { keys, a, items } = setup();
		assert.equal(findRepeatItemIndex(items, a, keys, 1), 1);
		assert.equal(findRepeatItemIndex(items, a, keys, 0), 0);
		assert.equal(findRepeatItemIndex(items, a, keys), 0);
		// The hinted slot holds something else now. Fall back to the lookup.
		assert.equal(findRepeatItemIndex(items, a, keys, 2), 0);
	});

	it('finds the second occurrence after an edit replaced it with a carried-key object', () => {
		const { keys, a, b } = setup();
		const edited = { n: 'a2' };
		keys.carry(a, edited);
		assert.equal(findRepeatItemIndex([a, edited, b], a, keys, 1), 1);
	});

	it('keeps both occurrences through a reorder', () => {
		const { keys, a, b, items } = setup();
		const sortList = repeatSortItems(items, ['n'], keys);
		assert.equal(new Set(sortList.map((row) => row.key)).size, 3);
		const next = reorderRepeatItems(items, [sortList[2], sortList[1], sortList[0]], keys);
		assert.equal(next.length, 3);
		assert.ok(next[0] === b && next[1] === a && next[2] === a);
	});

	it('keeps both occurrences when the sorted list names only one of them', () => {
		const { keys, a, b, items } = setup();
		const sortList = repeatSortItems(items, ['n'], keys);
		const next = reorderRepeatItems(items, [sortList[2], sortList[0]], keys);
		assert.ok(next.length === 3 && next[0] === b && next[1] === a && next[2] === a);
	});
});
