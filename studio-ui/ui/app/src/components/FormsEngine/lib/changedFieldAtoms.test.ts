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
const { applyValuesCheckpoint } = await import('./formUtils.tsx');
const { clearStackPendingFlags } = await import('./repeatItemForm.ts');

describe('changedFieldAtom', () => {
	it('is a field that never changed when there is no Set, and notify does nothing', () => {
		const store = createStore();
		const atom = changedFieldAtom(null, 'a');
		assert.equal(store.get(atom), false);
		assert.equal(changedFieldAtom(undefined, 'b'), atom);
		notifyChangedFieldIds(store.set, null);
		assert.equal(store.get(atom), false);
	});

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
		changed.delete('b');
		notifyChangedFieldIds(store.set, changed);
		changed.add('a');
		notifyChangedFieldIds(store.set, changed);
		// Four notifies, and one flip of "a". Only the flip is heard.
		assert.deepEqual(calls.a, [true]);
		assert.equal(calls.a.length, 1);
		assert.deepEqual(calls.b, []);
		assert.equal(calls.b.length, 0);
		unsubscribe.forEach((fn) => fn());
	});
});

// The two save-time writers. Each mutates the Set directly, so each has to notify for the markers to follow.
describe('save-time notifies', () => {
	it('applyValuesCheckpoint clears the markers and notifies', () => {
		const store = createStore();
		const changedFieldIds = new Set(['a', 'b']);
		const context = { originalValues: { a: 1 }, changedFieldIds };
		const atom = changedFieldAtom(changedFieldIds, 'a');
		assert.equal(store.get(atom), true);
		applyValuesCheckpoint(context, { a: 2 }, store.set);
		assert.deepEqual(context.originalValues, { a: 2 });
		assert.equal(changedFieldIds.size, 0);
		assert.equal(store.get(atom), false);
	});

	// useSaveForm passes `notifyChangedFieldIds(jotai.set, set)` as the callback.
	it('clearStackPendingFlags with the save callback updates the item form and parent markers', () => {
		const store = createStore();
		const itemChanged = new Set(['icon_s']);
		const parentChanged = new Set<string>();
		const itemAtom = changedFieldAtom(itemChanged, 'icon_s');
		const parentAtom = changedFieldAtom(parentChanged, 'rows_o');
		const heard: boolean[] = [];
		store.sub(parentAtom, () => heard.push(store.get(parentAtom)));
		assert.equal(store.get(itemAtom), true);
		clearStackPendingFlags([{ selected: true, changedFieldIds: itemChanged, setPending() {} }], parentChanged, (set) =>
			notifyChangedFieldIds(store.set, set)
		);
		assert.equal(store.get(itemAtom), false);
		// A selected item whose save kept an in-flight edit marks its repeat on the parent, once, after the loop.
		const kept = new Set(['url_s']);
		const savedItem = { url_s: 'saved' };
		clearStackPendingFlags(
			[
				{
					selected: true,
					changedFieldIds: kept,
					fieldId: 'rows_o',
					savedItem,
					currentItem: { url_s: 'edited-later' },
					setPending() {}
				}
			],
			parentChanged,
			(set) => notifyChangedFieldIds(store.set, set)
		);
		assert.equal(parentChanged.has('rows_o'), true);
		assert.equal(store.get(parentAtom), true);
		assert.deepEqual(heard, [true]);
	});
});
