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
 * The per-field changed flag follows the `changedFieldIds` Set through an atom: it flips when the field is added to or
 * removed from the Set, and only that field's subscribers hear about it.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import '../../../../test/registerTsLoader.mjs';

const { createStore } = await import('jotai');
const { changedFieldAtom, notifyChangedFieldIds } = await import('./changedFieldAtoms.ts');

describe('changedFieldAtom', () => {
	it('is the same atom for the same Set and field', () => {
		const changed = new Set<string>();
		assert.equal(changedFieldAtom(changed, 'a'), changedFieldAtom(changed, 'a'));
		assert.notEqual(changedFieldAtom(changed, 'a'), changedFieldAtom(new Set<string>(), 'a'));
	});

	it('follows the Set on edit, on rollback and on a clear', () => {
		const store = createStore();
		const changed = new Set<string>();
		const atom = changedFieldAtom(changed, 'a');
		assert.equal(store.get(atom), false);
		changed.add('a');
		notifyChangedFieldIds(store.set, changed);
		assert.equal(store.get(atom), true);
		changed.delete('a');
		notifyChangedFieldIds(store.set, changed);
		assert.equal(store.get(atom), false);
		changed.add('a');
		notifyChangedFieldIds(store.set, changed);
		changed.clear();
		notifyChangedFieldIds(store.set, changed);
		assert.equal(store.get(atom), false);
	});

	it('notifies subscribers only when their own field flips', () => {
		const store = createStore();
		const changed = new Set<string>();
		const calls: Record<string, boolean[]> = { a: [], b: [] };
		const unsubscribe = ['a', 'b'].map((id) => {
			const atom = changedFieldAtom(changed, id);
			return store.sub(atom, () => calls[id].push(store.get(atom)));
		});
		changed.add('a');
		notifyChangedFieldIds(store.set, changed);
		changed.add('a');
		notifyChangedFieldIds(store.set, changed);
		assert.deepEqual(calls.a, [true]);
		assert.deepEqual(calls.b, []);
		unsubscribe.forEach((fn) => fn());
	});
});
