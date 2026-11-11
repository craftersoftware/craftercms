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
 * Covers the shared repeat-item opener. The save callback writes into whatever
 * array is current, so a change made after the form opened is kept. The selected-fields
 * write covers edits made in full mode that must reach the parent before Save.
 * Closing the item form puts the parent back to the item checkpoint. That write is a no-op when
 * the parent already has it. Done uses the same item write, so a stored key with no field stays.
 * A parent save keeps an edit that arrived after the snapshot.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	clearStackPendingFlags,
	commitRepeatItem,
	currentRepeatItemIndex,
	findRepeatItemIndex,
	repeatItemFormProps,
	repeatItemInValues,
	repeatItemValueAfterDiscard,
	restoreOpenedRepeatItem,
	selectedItemPendingAfterSave,
	stackedRepeatItemAfterClose,
	writeItemToParent
} from './repeatItemForm.ts';

describe('commitRepeatItem', () => {
	// Editing an item replaces that index and leaves the others in place.
	it('replaces the item at the given index', () => {
		const next = commitRepeatItem([{ id: 'a' }, { id: 'b' }], 0, { id: 'a2' });
		assert.deepEqual(next, [{ id: 'a2' }, { id: 'b' }]);
	});

	// Add has no index, so the new item goes on the end.
	it('appends when there is no index', () => {
		const next = commitRepeatItem([{ id: 'a' }], undefined, { id: 'b' });
		assert.deepEqual(next, [{ id: 'a' }, { id: 'b' }]);
	});
});

describe('writeItemToParent', () => {
	// Opening selected mode compares form fields with the stored item. A key with no field is not an edit.
	it('keeps an extra stored key and does not replace the array', () => {
		const stored = [{ icon_s: 'old', legacy_s: 'keep' }];
		const next = writeItemToParent(stored, 0, { icon_s: 'old' });
		assert.equal(next, stored);
		assert.equal(stored[0].legacy_s, 'keep');
	});

	// Full mode does not write. Back to selected fields writes once, and Save then stores that array.
	it('writes full-mode edits into the parent when the form returns to selected fields', () => {
		const opened = [{ icon_s: 'old' }];
		const editedInFullMode = { icon_s: 'new' };
		const afterReturn = writeItemToParent(opened, 0, editedInFullMode);
		assert.deepEqual(afterReturn, [{ icon_s: 'new' }]);
		// Save reads this array. Writing the same item again does not replace it, so an unchanged open stays clean.
		assert.equal(writeItemToParent(afterReturn, 0, editedInFullMode), afterReturn);
	});
});

describe('restoreOpenedRepeatItem', () => {
	// Selected mode already wrote the edit. Open full form does not undo it. Discard must.
	it('puts back the opened item after a selected-mode edit is discarded', () => {
		const openedItem = { icon_s: 'old' };
		const original = [openedItem];
		const afterEdit = writeItemToParent(original, 0, { icon_s: 'new' });
		assert.deepEqual(afterEdit, [{ icon_s: 'new' }]);
		const restored = restoreOpenedRepeatItem({
			wasSelectedItemForm: true,
			items: afterEdit,
			index: 0,
			openedValues: openedItem
		});
		const next = repeatItemValueAfterDiscard({ current: afterEdit, restored, original });
		assert.equal(next, original);
		assert.deepEqual(next, [{ icon_s: 'old' }]);
	});

	// Nothing changed, so discard must not replace the parent array.
	it('leaves the parent array alone when discard has nothing to undo', () => {
		const items = [{ icon_s: 'old' }];
		const restored = restoreOpenedRepeatItem({
			wasSelectedItemForm: true,
			items,
			index: 0,
			openedValues: { icon_s: 'old' }
		});
		assert.equal(restored, items);
		assert.equal(repeatItemValueAfterDiscard({ current: items, restored, original: items }), undefined);
	});

	// The pencil never wrote through, so discard does not touch the parent.
	it('does not restore a pencil item form', () => {
		const items = [{ icon_s: 'new' }];
		assert.equal(
			restoreOpenedRepeatItem({
				wasSelectedItemForm: false,
				items,
				index: 0,
				openedValues: { icon_s: 'old' }
			}),
			undefined
		);
	});
});

describe('stackedRepeatItemAfterClose', () => {
	// Selected mode wrote the new Icon. Typing the old value back clears pending, and a plain close must store that.
	it('restores the parent and leaves it clean when the old value is typed back', () => {
		const openedItem = { icon_s: 'old' };
		const openedList = [openedItem];
		const afterSelectedEdit = writeItemToParent(openedList, 0, { icon_s: 'new' });
		const next = stackedRepeatItemAfterClose({
			wasSelectedItemForm: true,
			items: afterSelectedEdit,
			index: 0,
			checkpoint: openedItem,
			parentCheckpoint: openedList
		});
		assert.equal(next, openedList);
		assert.deepEqual(next, [{ icon_s: 'old' }]);
	});

	// The item form never changed, so closing it must not replace the parent array.
	it('writes nothing when the item was never changed', () => {
		const openedItem = { icon_s: 'old' };
		const openedList = [openedItem];
		const next = stackedRepeatItemAfterClose({
			wasSelectedItemForm: true,
			items: openedList,
			index: 0,
			checkpoint: openedItem,
			parentCheckpoint: openedList
		});
		assert.equal(next, undefined);
	});

	// A later edit is in the parent. Discard uses the saved checkpoint, not the item from when the form opened.
	it('puts the item back to the saved value when a later edit is discarded', () => {
		const openedItem = { icon_s: 'old' };
		const savedItem = { icon_s: 'saved' };
		const savedList = [savedItem];
		const afterLaterEdit = writeItemToParent(savedList, 0, { icon_s: 'later' });
		const next = stackedRepeatItemAfterClose({
			wasSelectedItemForm: true,
			items: afterLaterEdit,
			index: 0,
			checkpoint: savedItem,
			parentCheckpoint: savedList
		});
		assert.equal(next, savedList);
		assert.deepEqual(next, [{ icon_s: 'saved' }]);
		assert.notDeepEqual(next, [openedItem]);
	});
});

describe('selectedItemPendingAfterSave', () => {
	// The item changed after the XML was built. The pending flag stays, and rollback uses the saved item.
	it('keeps the pending flag when the item changed during the parent save', () => {
		const decision = selectedItemPendingAfterSave({
			selected: true,
			savedItem: { icon_s: 'saved' },
			currentItem: { icon_s: 'newer' }
		});
		assert.equal(decision.clearPending, false);
		assert.deepEqual(decision.checkpoint, { icon_s: 'saved' });
	});

	// The open item matches what was saved. Extra stored keys are not a new edit.
	it('clears the pending flag when the open item matches the save', () => {
		const decision = selectedItemPendingAfterSave({
			selected: true,
			savedItem: { icon_s: 'saved', component: { id: '1' } },
			currentItem: { icon_s: 'saved' }
		});
		assert.equal(decision.clearPending, true);
		assert.deepEqual(decision.checkpoint, { icon_s: 'saved', component: { id: '1' } });
	});

	// A pencil or full-mode item was not written through, so the save does not clear it.
	it('leaves a form that is not in selected-fields mode', () => {
		const decision = selectedItemPendingAfterSave({
			selected: false,
			savedItem: { icon_s: 'saved' },
			currentItem: { icon_s: 'saved' }
		});
		assert.equal(decision.clearPending, false);
		assert.equal(decision.checkpoint, null);
	});
});

describe('repeatItemFormProps', () => {
	// The pencil's onSave used to close over the array from when the form opened. A later edit was lost.
	it('writes the item into the array that exists at save time', async () => {
		let items = [{ id: 'a' }, { id: 'b' }];
		const props = repeatItemFormProps({
			fieldId: 'accounts_o',
			index: 0,
			values: items[0],
			getItems: () => items,
			setItems: (next) => {
				items = next;
			}
		});
		items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
		const result = await props.onSave({ values: { id: 'a2' } });
		assert.equal(result.close, true);
		assert.deepEqual(items, [{ id: 'a2' }, { id: 'b' }, { id: 'c' }]);
	});

	// A launch that names child fields passes them through. The pencil does not.
	it('passes selected child fields and omits them for the pencil', () => {
		const launched = repeatItemFormProps({
			fieldId: 'accounts_o',
			index: 0,
			fieldIds: ['icon_s'],
			getItems: () => [],
			setItems: () => undefined
		});
		assert.deepEqual(launched.fieldIds, ['icon_s']);
		const pencil = repeatItemFormProps({
			fieldId: 'accounts_o',
			index: 0,
			getItems: () => [],
			setItems: () => undefined
		});
		assert.equal(pencil.fieldIds, undefined);
	});

	// Done used to replace the item with form fields only. A stored key with no field must stay.
	it('keeps an extra stored key when the item is done', async () => {
		let items = [{ icon_s: 'old', legacy_s: 'keep' }];
		const props = repeatItemFormProps({
			fieldId: 'accounts_o',
			index: 0,
			getItems: () => items,
			setItems: (next) => {
				items = next;
			}
		});
		await props.onSave({ values: { icon_s: 'new' } });
		assert.deepEqual(items, [{ icon_s: 'new', legacy_s: 'keep' }]);
	});

	// An unchanged Done must not hand the parent a new array, or the repeat field looks dirty.
	it('returns the same array when Done has nothing to change', async () => {
		const items = [{ icon_s: 'old', legacy_s: 'keep' }];
		let stored = items;
		const props = repeatItemFormProps({
			fieldId: 'accounts_o',
			index: 0,
			getItems: () => stored,
			setItems: (next) => {
				stored = next;
			}
		});
		await props.onSave({ values: { icon_s: 'old' } });
		assert.equal(stored, items);
	});
});

/** Row keys the way `repeatItemKeys.ts` keeps them. This file's helpers take them structurally. */
function testKeys() {
	const ids = new WeakMap<object, string>();
	let next = 0;
	return {
		keyOf(item: object) {
			if (!ids.has(item)) ids.set(item, `k${next++}`);
			return ids.get(item);
		},
		carry(previous: object | undefined, replacement: object | undefined) {
			if (!previous || !replacement || previous === replacement) return;
			ids.set(replacement, this.keyOf(previous));
		}
	};
}

describe('currentRepeatItemIndex', () => {
	it('is undefined for a new item, so the caller appends', () => {
		assert.equal(currentRepeatItemIndex([{ id: 'a' }], undefined, undefined, testKeys()), undefined);
	});

	it('finds the launch item where it is stored now', () => {
		const [a, b] = [{ id: 'a' }, { id: 'b' }];
		assert.equal(currentRepeatItemIndex([{ id: 'new' }, a, b], 1, b, testKeys()), 2);
	});

	it('finds an item that a write replaced, through its carried key', () => {
		const keys = testKeys();
		const [a, b] = [{ id: 'a' }, { id: 'b' }];
		const replaced = { id: 'b2' };
		keys.carry(b, replaced);
		assert.equal(currentRepeatItemIndex([{ id: 'new' }, a, replaced], 1, b, keys), 2);
	});

	it('is -1 when the item is gone', () => {
		const [a, b] = [{ id: 'a' }, { id: 'b' }];
		assert.equal(currentRepeatItemIndex([a], 1, b, testKeys()), -1);
		assert.equal(findRepeatItemIndex([a], b, testKeys()), -1);
	});

	it('keeps the launch index when it has no item or no keys to look with', () => {
		const items = [{ id: 'a' }, { id: 'b' }];
		assert.equal(currentRepeatItemIndex(items, 1, undefined, testKeys()), 1);
		assert.equal(currentRepeatItemIndex(items, 1, items[1], undefined), 1);
	});
});

describe('repeatItemFormProps with a shifted array', () => {
	function open(items: Array<{ id: string }>, index: number) {
		const keys = testKeys();
		let stored = items;
		let writes = 0;
		const props = repeatItemFormProps({
			fieldId: 'accounts_o',
			index,
			values: items[index],
			getItems: () => stored,
			keys,
			setItems: (next) => {
				writes++;
				stored = next;
			}
		});
		return {
			keys,
			props,
			stored: () => stored,
			shift: (next: Array<{ id: string }>) => (stored = next),
			writes: () => writes
		};
	}

	it('saves into the slot the item has now and carries its key to the replacement', async () => {
		const [a, b] = [{ id: 'a' }, { id: 'b' }];
		const form = open([a, b], 1);
		const keyOfB = form.keys.keyOf(b);
		form.shift([{ id: 'new' }, a, b]);
		await form.props.onSave({ values: { id: 'b2' } });
		assert.deepEqual(form.stored(), [{ id: 'new' }, { id: 'a' }, { id: 'b2' }]);
		assert.equal(form.keys.keyOf(form.stored()[2]), keyOfB);
	});

	it('skips the write when the item is gone', async () => {
		const [a, b] = [{ id: 'a' }, { id: 'b' }];
		const form = open([a, b], 1);
		form.shift([a]);
		const warn = console.warn;
		console.warn = () => undefined;
		try {
			const result = await form.props.onSave({ values: { id: 'b2' } });
			assert.equal(result.close, true);
		} finally {
			console.warn = warn;
		}
		assert.equal(form.writes(), 0);
		assert.deepEqual(form.stored(), [a]);
	});
});

describe('item form close and selected-fields write with a resolved index', () => {
	// FormsEngine resolves the index with `currentRepeatItemIndex` before it calls these.
	it('restores the checkpoint into the slot the item has now', () => {
		const keys = testKeys();
		const [a, b] = [{ id: 'a' }, { id: 'b-edited' }];
		const items = [{ id: 'new' }, a, b];
		const index = currentRepeatItemIndex(items, 1, b, keys);
		const next = stackedRepeatItemAfterClose({
			wasSelectedItemForm: true,
			items,
			index: index === -1 ? undefined : index,
			checkpoint: { id: 'b' },
			parentCheckpoint: undefined
		});
		assert.deepEqual(next, [{ id: 'new' }, { id: 'a' }, { id: 'b' }]);
	});

	it('leaves the array alone when the item is gone', () => {
		const keys = testKeys();
		const [a, b] = [{ id: 'a' }, { id: 'b-edited' }];
		const items = [a];
		const index = currentRepeatItemIndex(items, 1, b, keys);
		assert.equal(index, -1);
		const next = stackedRepeatItemAfterClose({
			wasSelectedItemForm: true,
			items,
			index: index === -1 ? undefined : index,
			checkpoint: { id: 'b' },
			parentCheckpoint: undefined
		});
		assert.equal(next, undefined);
	});
});

describe('repeatItemInValues with a shifted saved array', () => {
	it('finds the launch item where the saved array has it now', () => {
		const keys = testKeys();
		const [a, b] = [{ id: 'a' }, { id: 'b' }];
		const saved = { rows_o: [{ id: 'new' }, a, b] };
		assert.deepEqual(repeatItemInValues(saved, 'rows_o', 1, b, keys), { item: b, gone: false });
	});

	it('finds an item a write replaced after the launch, by its carried key', () => {
		const keys = testKeys();
		const b = { id: 'b' };
		const replaced = { id: 'b1' };
		keys.carry(b, replaced);
		const saved = { rows_o: [{ id: 'new' }, replaced] };
		assert.deepEqual(repeatItemInValues(saved, 'rows_o', 1, b, keys), { item: replaced, gone: false });
	});

	it('reports a repeat item that is no longer saved as gone, not as another row', () => {
		const keys = testKeys();
		const [a, b] = [{ id: 'a' }, { id: 'b' }];
		assert.deepEqual(repeatItemInValues({ rows_o: [a] }, 'rows_o', 1, b, keys), { item: undefined, gone: true });
	});

	it('keeps the launch index without a launch item or keys, and has nothing for a non-item entry', () => {
		const [a, b] = [{ id: 'a' }, { id: 'b' }];
		assert.deepEqual(repeatItemInValues({ rows_o: [a, b] }, 'rows_o', 1), { item: b, gone: false });
		assert.deepEqual(repeatItemInValues({ rows_o: [a, b] }, undefined, undefined), { item: undefined, gone: false });
	});

	it('marks a field that is not an array in the saved values as absent', () => {
		assert.deepEqual(repeatItemInValues({ sections_o: [{ id: 'a' }] }, 'inner_o', 0, { id: 'nested' }), {
			item: undefined,
			gone: false,
			absent: true
		});
	});
});

describe('clearStackPendingFlags with a shifted saved array', () => {
	/** An entry the way `useSaveForm` builds it: the saved item is looked up by row key. */
	function entryFor(
		saved: Record<string, unknown>,
		keys: ReturnType<typeof testKeys>,
		launchIndex: number,
		launchItem: { id: string },
		current: { id: string },
		fieldId = 'rows_o'
	) {
		const looked = repeatItemInValues(saved, fieldId, launchIndex, launchItem, keys);
		const calls = {
			checkpoint: undefined as unknown,
			pending: undefined as boolean | undefined,
			ids: undefined as unknown
		};
		return {
			calls,
			entry: {
				selected: true,
				changedFieldIds: new Set(['id']) as ReadonlySet<string>,
				setChangedFieldIds(next: ReadonlySet<string>) {
					calls.ids = next;
				},
				setPending(value: boolean) {
					calls.pending = value;
				},
				fieldId,
				savedItem: looked.item,
				itemGone: looked.gone,
				absent: looked.absent,
				currentItem: current,
				setCheckpoint(values: Record<string, unknown>) {
					calls.checkpoint = values;
				}
			}
		};
	}

	it("stores each item's own saved row as its checkpoint, not the row at the launch index", () => {
		const keys = testKeys();
		const [a, b] = [{ id: 'a' }, { id: 'b' }];
		// Something was added in front after both forms opened. Launch indexes 0 and 1 now point at the wrong rows.
		const saved = { rows_o: [{ id: 'new' }, a, b] };
		const forA = entryFor(saved, keys, 0, a, { id: 'a' });
		const forB = entryFor(saved, keys, 1, b, { id: 'b' });
		clearStackPendingFlags([forA.entry, forB.entry]);
		assert.ok(forA.calls.checkpoint === a);
		assert.ok(forB.calls.checkpoint === b);
		assert.equal(forA.calls.pending, false);
		assert.equal(forB.calls.pending, false);
	});

	it('leaves the flags and checkpoint of an item that is no longer saved', () => {
		const keys = testKeys();
		const [a, b] = [{ id: 'a' }, { id: 'b' }];
		const gone = entryFor({ rows_o: [a] }, keys, 1, b, { id: 'b-edited' });
		clearStackPendingFlags([gone.entry]);
		assert.deepEqual(gone.calls, { checkpoint: undefined, pending: undefined, ids: undefined });
	});

	// A nested selected entry's field is not on the root save. Its dirty state must stay; a direct child still clears.
	it('leaves a nested entry alone when its field is missing from the saved values', () => {
		const keys = testKeys();
		const child = { id: 'child' };
		const saved = { rows_o: [child] };
		const nested = entryFor(saved, keys, 0, { id: 'nested' }, { id: 'nested-edited' }, 'inner_o');
		const direct = entryFor(saved, keys, 0, child, { id: 'child' });
		clearStackPendingFlags([nested.entry, direct.entry]);
		assert.deepEqual(nested.calls, { checkpoint: undefined, pending: undefined, ids: undefined });
		assert.ok(direct.calls.checkpoint === child);
		assert.equal(direct.calls.pending, false);
	});
});
