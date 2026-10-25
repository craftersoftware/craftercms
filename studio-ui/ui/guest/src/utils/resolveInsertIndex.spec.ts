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

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveInsertIndex } from './resolveInsertIndex';

/**
 * Where `Array.prototype.splice` lands when given the index `insertComponent`
 * used to pass through unchanged. Documented here so the dotted-index bug stays
 * visible without booting Studio.
 */
function developSpliceLanding(targetIndex: string | number, collection: readonly string[]): number {
	const copy = collection.slice();
	copy.splice(targetIndex as number, 0, 'NEW');
	return copy.indexOf('NEW');
}

function inserted(targetIndex: string | number, collection: readonly string[]): string[] | null {
	const index = resolveInsertIndex(targetIndex, collection);
	if (index === null) {
		return null;
	}
	const copy = collection.slice();
	copy.splice(index, 0, 'NEW');
	return copy;
}

/** Nested collection addressed by parent item 2 (`sections_o[2].components_o`). */
const nestedAtItem2 = ['c0', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6'];

describe('resolveInsertIndex', () => {
	it('inserts at a top-level numeric index', () => {
		assert.equal(resolveInsertIndex(4, nestedAtItem2), 4);
		assert.deepEqual(inserted(4, nestedAtItem2), ['c0', 'c1', 'c2', 'c3', 'NEW', 'c4', 'c5', 'c6']);
	});

	it('inserts at a top-level numeric-string index', () => {
		assert.equal(resolveInsertIndex('4', nestedAtItem2), 4);
		assert.deepEqual(inserted('4', nestedAtItem2), ['c0', 'c1', 'c2', 'c3', 'NEW', 'c4', 'c5', 'c6']);
	});

	it('dotted "2.5" inserts at position 5 of the collection addressed by item 2', () => {
		// getCollection("sections_o.components_o", "2.5") already returned this list
		// (parent index 2). develop then called splice("2.5"), which truncates to 2.
		assert.equal(developSpliceLanding('2.5', nestedAtItem2), 2);
		assert.equal(resolveInsertIndex('2.5', nestedAtItem2), 5);
		assert.deepEqual(inserted('2.5', nestedAtItem2), ['c0', 'c1', 'c2', 'c3', 'c4', 'NEW', 'c5', 'c6']);
	});

	it('deeper dotted "1.2.3" uses the last segment as the position', () => {
		// "1.2.3" is not a JS number, so develop's splice inserted at 0.
		// The collection argument is the one addressed by "1.2".
		assert.equal(developSpliceLanding('1.2.3', nestedAtItem2), 0);
		assert.equal(resolveInsertIndex('1.2.3', nestedAtItem2), 3);
		assert.deepEqual(inserted('1.2.3', nestedAtItem2), ['c0', 'c1', 'c2', 'NEW', 'c3', 'c4', 'c5', 'c6']);
	});

	it('inserts at 0 and at the end', () => {
		assert.equal(resolveInsertIndex(0, nestedAtItem2), 0);
		assert.deepEqual(inserted(0, nestedAtItem2), ['NEW', 'c0', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6']);

		// "2.0" is position 0 of the nested collection, not position 2.
		assert.equal(developSpliceLanding('2.0', nestedAtItem2), 2);
		assert.equal(resolveInsertIndex('2.0', nestedAtItem2), 0);
		assert.deepEqual(inserted('2.0', nestedAtItem2), ['NEW', 'c0', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6']);

		const end = nestedAtItem2.length;
		assert.equal(resolveInsertIndex(end, nestedAtItem2), end);
		assert.deepEqual(inserted(end, nestedAtItem2), [...nestedAtItem2, 'NEW']);
		assert.equal(resolveInsertIndex(String(end), nestedAtItem2), end);
		assert.deepEqual(inserted(`2.${end}`, nestedAtItem2), [...nestedAtItem2, 'NEW']);
	});

	it('clamps an integer past the end to the end, matching splice', () => {
		assert.equal(developSpliceLanding(100, nestedAtItem2), nestedAtItem2.length);
		assert.equal(resolveInsertIndex(100, nestedAtItem2), nestedAtItem2.length);
		assert.deepEqual(inserted(100, nestedAtItem2), [...nestedAtItem2, 'NEW']);
		assert.equal(resolveInsertIndex('2.100', nestedAtItem2), nestedAtItem2.length);
	});

	it('rejects invalid indexes instead of inserting', () => {
		const invalid = [NaN, 'x', '', '2.x', -1, '-1', '2.-1', 2.5, Infinity, -Infinity, null, undefined] as Array<
			string | number
		>;
		for (const targetIndex of invalid) {
			assert.equal(resolveInsertIndex(targetIndex, nestedAtItem2), null, `expected null for ${String(targetIndex)}`);
			assert.equal(inserted(targetIndex, nestedAtItem2), null, `expected no insert for ${String(targetIndex)}`);
		}
		// develop hid these by inserting at 0 (ToInteger(NaN) === 0) or, for -1, before the last item.
		assert.equal(developSpliceLanding(NaN, nestedAtItem2), 0);
		assert.equal(developSpliceLanding('x', nestedAtItem2), 0);
		assert.equal(developSpliceLanding('', nestedAtItem2), 0);
		assert.equal(developSpliceLanding('2.x', nestedAtItem2), 0);
		assert.equal(developSpliceLanding(-1, nestedAtItem2), nestedAtItem2.length - 1);
	});
});
