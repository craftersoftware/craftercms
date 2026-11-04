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

const { createRepeatItemKeys, removeRepeatItem } = await import('./repeatItemKeys.ts');
const { reorderRepeatItems } = await import('../controls/repeatItemDisplay.ts');

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

describe('reorderRepeatItems', () => {
	const sorted = (...keys: string[]) => keys.map((key) => ({ key }));

	it('orders the stored items by the sorted keys', () => {
		const [a, b, c] = [{ n: 'a' }, { n: 'b' }, { n: 'c' }];
		assert.deepEqual(reorderRepeatItems([a, b, c], sorted('2', '0', '1')), [c, a, b]);
	});

	it('uses the stored items, so an edit made after the list was built is kept', () => {
		const [a, b] = [{ n: 'a' }, { n: 'b' }];
		const editedB = { n: 'b2' };
		const next = reorderRepeatItems([a, editedB], sorted('1', '0'));
		assert.equal(next[0], editedB);
		assert.equal(next[1], a);
	});

	it('keeps an item added after the list was built, at the end', () => {
		const [a, b, added] = [{ n: 'a' }, { n: 'b' }, { n: 'added' }];
		assert.deepEqual(reorderRepeatItems([a, b, added], sorted('1', '0')), [b, a, added]);
	});

	it('ignores a key that no longer points at a stored item', () => {
		const [a, b] = [{ n: 'a' }, { n: 'b' }];
		assert.deepEqual(reorderRepeatItems([a], sorted('1', '0', '0')), [a]);
		assert.equal(reorderRepeatItems([a, b], sorted('x')).length, 2);
	});
});
