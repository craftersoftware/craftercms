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
	commitRepeatItem,
	repeatItemFormProps,
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
