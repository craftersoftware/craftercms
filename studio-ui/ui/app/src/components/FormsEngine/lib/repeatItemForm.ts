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

/** A copy of `items` with `nextItem` at `index`, or on the end when there is no index (Add). */
export function commitRepeatItem<T>(items: readonly T[], index: number | undefined, nextItem: T): T[] {
	if (index === undefined) return items.concat(nextItem);
	const next = items.slice();
	next.splice(index, 1, nextItem);
	return next;
}

/** Whether `value` is a plain object (not an array, class instance or null). */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}

/** Structural equality for repeat items. An absent key and an undefined one are equal. */
function sameItem(left: unknown, right: unknown): boolean {
	if (Object.is(left, right)) return true;
	if (Array.isArray(left) || Array.isArray(right)) {
		if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
		return left.every((value, index) => sameItem(value, right[index]));
	}
	if (isPlainRecord(left) && isPlainRecord(right)) {
		const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
		for (const key of keys) {
			// A field atom that was not on the stored item is undefined. That is not an edit.
			if (left[key] === undefined && right[key] === undefined) continue;
			if (!sameItem(left[key], right[key])) return false;
		}
		return true;
	}
	return false;
}

/** The row keys an item form needs: the key lookup and the carry of a replaced item's key. Matches `RepeatItemKeys`. */
export interface OpenItemKeys<T> {
	keyOf(item: T): string | undefined;
	carry(previous: T | undefined, next: T | undefined): void;
}

/**
 * Where `item` is in `items` now. The same object wins. An item an edit replaced is found by its carried key.
 * -1 when the item is no longer there.
 * Lives here, free of imports, so the item-form helpers and their tests need no loader. `repeatItemKeys.ts` re-exports it.
 */
export function findRepeatItemIndex<T>(items: readonly T[], item: T, keys: Pick<OpenItemKeys<T>, 'keyOf'>): number {
	const index = items.indexOf(item);
	if (index !== -1) return index;
	const key = keys.keyOf(item);
	return key === undefined ? -1 : items.findIndex((candidate) => keys.keyOf(candidate) === key);
}

/**
 * The index of the item an open item form edits, in the array as stored now.
 * The launch index is only a starting point: a save, a reorder or a delete since then moves the item. `launchItem` is
 * the item the form was launched with, found again by identity or by its carried row key.
 * - undefined for a new item (no launch index): the caller appends.
 * - -1 when the item is gone: the caller skips the indexed write.
 * - the launch index when there is no launch item or no keys to find it with.
 */
export function currentRepeatItemIndex<T>(
	items: readonly T[],
	launchIndex: number | undefined,
	launchItem: T | undefined,
	keys: Pick<OpenItemKeys<T>, 'keyOf'> | undefined
): number | undefined {
	if (launchIndex === undefined) return undefined;
	if (launchItem === undefined || !keys) return launchIndex;
	return findRepeatItemIndex(items, launchItem, keys);
}

/**
 * Puts the open item into the parent array.
 * Selected-fields mode calls this once when the form enters that mode, and again on each edit
 * while it stays there. Edits made in full mode are not in the parent until this runs, so
 * Back to selected fields must write before Save. An item that already matches is returned
 * as the same array, so opening the form does not mark the parent dirty.
 */
export function writeItemToParent<T>(items: readonly T[], index: number | undefined, nextItem: T): T[] {
	const currentItem = index !== undefined && index >= 0 && index < items.length ? items[index] : undefined;
	// Form values sit on top of the stored item so a key with no field is kept.
	const merged =
		isPlainRecord(currentItem) && isPlainRecord(nextItem) ? ({ ...currentItem, ...nextItem } as T) : nextItem;
	if (currentItem !== undefined && sameItem(currentItem, merged)) return items as T[];
	return commitRepeatItem(items, index, merged);
}

/**
 * Discard of a form that was opened in selected-fields mode.
 * Those edits are already in the parent, so dropping the stacked form would keep them.
 * `openedValues` is the item checkpoint: the opened item, then the saved item after a parent save.
 * A pencil form was never written through, so this leaves it alone.
 * An unchanged item is the same array `writeItemToParent` returns.
 */
export function restoreOpenedRepeatItem<T>(args: {
	wasSelectedItemForm: boolean;
	items: readonly T[] | null | undefined;
	index: number | undefined;
	openedValues: T | undefined;
}): T[] | undefined {
	if (
		!args.wasSelectedItemForm ||
		args.openedValues === undefined ||
		args.index === undefined ||
		!Array.isArray(args.items)
	) {
		return undefined;
	}
	return writeItemToParent(args.items, args.index, args.openedValues);
}

/**
 * The array to store after a discard, or undefined when nothing should be written.
 * When the restored items match the parent's checkpoint, the checkpoint array itself is
 * returned so the repeat field is not left looking dirty.
 */
export function repeatItemValueAfterDiscard<T>(args: {
	current: readonly T[] | null | undefined;
	restored: readonly T[] | null | undefined;
	original: readonly T[] | null | undefined;
}): readonly T[] | undefined {
	if (!args.restored || args.restored === args.current) return undefined;
	if (args.original && sameItem(args.original, args.restored)) return args.original;
	return args.restored;
}

/**
 * Parent array after a stacked item form closes, other than Done or Save.
 * The item checkpoint is written back through `restoreOpenedRepeatItem`. When nothing is
 * pending, that checkpoint is what the item form is showing, including a value typed back
 * to the last save. `writeItemToParent` leaves the array alone when the item already matches,
 * and the parent's saved array is reused when the result is that save, so the parent stays clean.
 * Returns undefined when the parent should be left untouched.
 */
export function stackedRepeatItemAfterClose<T>(args: {
	wasSelectedItemForm: boolean;
	items: readonly T[] | null | undefined;
	index: number | undefined;
	checkpoint: T | undefined;
	parentCheckpoint: readonly T[] | null | undefined;
}): readonly T[] | undefined {
	const restored = restoreOpenedRepeatItem({
		wasSelectedItemForm: args.wasSelectedItemForm,
		items: args.items,
		index: args.index,
		openedValues: args.checkpoint
	});
	return repeatItemValueAfterDiscard({
		current: args.items,
		restored,
		original: args.parentCheckpoint
	});
}

/**
 * The repeat item inside a saved content object. `item` is undefined when this entry is not a repeat item (nothing
 * to look up). `gone` is true when it is a repeat item that is no longer in the saved array.
 * The launch index is only a starting point: when the array shifted while the item form was open it points at another
 * row. With `launchItem` and `keys` the item is found again in the saved array by identity or carried row key
 * ({@link currentRepeatItemIndex}); without them the launch index is used as is.
 */
export function repeatItemInValues<T = unknown>(
	values: Record<string, unknown> | null | undefined,
	fieldId: string | undefined,
	index: number | undefined,
	launchItem?: T,
	keys?: Pick<OpenItemKeys<T>, 'keyOf'>
): { item: unknown; gone: boolean } {
	if (!values || fieldId === undefined || index === undefined) return { item: undefined, gone: false };
	const list = values[fieldId];
	if (!Array.isArray(list)) return { item: undefined, gone: false };
	const current = currentRepeatItemIndex(list as T[], index, launchItem, keys);
	if (current === -1) return { item: undefined, gone: true };
	return { item: current === undefined ? undefined : list[current], gone: false };
}

/**
 * What a parent save should do with a stacked entry.
 * A selected item that still matches the save drops its pending flag, and its checkpoint
 * becomes the saved item so a later rollback restores that save.
 * An edit made after the snapshot keeps the pending flag. The checkpoint is still the saved item.
 * A full-mode or pencil entry is left alone.
 */
export function selectedItemPendingAfterSave(args: { selected: boolean; savedItem: unknown; currentItem: unknown }): {
	clearPending: boolean;
	checkpoint: Record<string, unknown> | null;
} {
	if (!args.selected) return { clearPending: false, checkpoint: null };
	const checkpoint = isPlainRecord(args.savedItem) ? args.savedItem : null;
	if (args.savedItem !== undefined && !formFieldsMatchSaved(args.savedItem, args.currentItem)) {
		return { clearPending: false, checkpoint };
	}
	return { clearPending: true, checkpoint };
}

/**
 * A parent save that stays open already stored selected-fields edits that match the save.
 * Only those entries are cleared, and their checkpoint becomes the saved item.
 * An edit made after the snapshot keeps its pending flag, and its repeat field is recorded on the parent.
 * Changed ids that match the new checkpoint are dropped. A full-mode or pencil item is left alone.
 * Sets are replaced, not mutated: each rebuilt set goes to `setChangedFieldIds`, and the parent's gets the repeat field.
 */
export function clearStackPendingFlags(
	entries: readonly {
		selected: boolean;
		changedFieldIds: ReadonlySet<string>;
		/** Stores the rebuilt set. Not called when the membership did not change. */
		setChangedFieldIds(next: ReadonlySet<string>): void;
		setPending(value: boolean): void;
		savedItem?: unknown;
		/** The item is no longer in the saved array. Its flags and checkpoint stay as they are. */
		itemGone?: boolean;
		currentItem?: unknown;
		/** Repeat field on the parent. An in-flight edit records this id on the parent. */
		fieldId?: string;
		setCheckpoint?(values: Record<string, unknown>): void;
	}[],
	parent?: { changedFieldIds: ReadonlySet<string>; setChangedFieldIds(next: ReadonlySet<string>): void }
): void {
	let parentChanged = parent?.changedFieldIds;
	for (const entry of entries) {
		const decision = selectedItemPendingAfterSave({
			selected: entry.selected,
			savedItem: entry.savedItem,
			currentItem: entry.currentItem
		});
		if (entry.itemGone) continue;
		if (decision.checkpoint) entry.setCheckpoint?.(decision.checkpoint);
		if (!entry.selected) continue;
		// Rebuild from the saved checkpoint. An undo during the save is not in the old id list.
		let changed = entry.changedFieldIds;
		if (decision.checkpoint && isPlainRecord(entry.currentItem)) {
			const currentItem = entry.currentItem;
			const checkpoint = decision.checkpoint;
			changed = new Set(Object.keys(currentItem).filter((id) => !sameItem(currentItem[id], checkpoint[id])));
		} else if (decision.clearPending) {
			changed = new Set();
		}
		// The same set when nothing changed, so nothing downstream recomputes.
		if (!sameMembership(changed, entry.changedFieldIds)) entry.setChangedFieldIds(changed);
		if (changed.size === 0) {
			entry.setPending(false);
			continue;
		}
		entry.setPending(true);
		if (entry.fieldId && parentChanged && !parentChanged.has(entry.fieldId)) {
			parentChanged = new Set(parentChanged).add(entry.fieldId);
		}
	}
	if (parent && parentChanged !== parent.changedFieldIds) parent.setChangedFieldIds(parentChanged);
}

/** Whether both sets hold the same ids. */
function sameMembership(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
	return left.size === right.size && Array.from(left).every((id) => right.has(id));
}

/** Compares the form's own fields. Extra keys on the stored item are not an in-flight edit. */
function formFieldsMatchSaved(saved: unknown, current: unknown): boolean {
	if (!isPlainRecord(current) || !isPlainRecord(saved)) return sameItem(saved, current);
	return Object.keys(current).every((key) => sameItem(current[key], saved[key]));
}

/**
 * The one way to open a repeat item form: the pencil, Add, and an Experience Builder launch. Props for the item at
 * `index`, or for a new one when `index` is undefined (Add).
 * `onSave` reads the stored array when it runs, finds the open item in it (see {@link currentRepeatItemIndex}), writes
 * with {@link writeItemToParent}, and carries the row key to the replacement. The item form is a separate
 * FormsEngine, so `getItems` and `setItems` are how it reaches the repeat field's array.
 */
export function repeatItemFormProps<T extends Record<string, unknown>>(args: {
	fieldId: string;
	index?: number;
	values?: T;
	/** Child fields to show. Omit it for the pencil and for a whole-item launch. */
	fieldIds?: readonly string[] | null;
	getItems(): readonly T[];
	/** `previous` is the array `onSave` read to build `next`. */
	setItems(next: T[]): void;
	/**
	 * The repeat field's row keys, shared with the repeat control. With `values` they find the open item again at save
	 * time, and an edit carries the key of the item it replaces to the new object.
	 */
	keys?: OpenItemKeys<T>;
}): {
	repeat: { fieldId: string; index?: number; values?: T };
	fieldIds?: string[];
	onSave(result: { values: T }): Promise<{ close: boolean }>;
} {
	const repeat: { fieldId: string; index?: number; values?: T } = { fieldId: args.fieldId };
	if (args.index !== undefined) repeat.index = args.index;
	if (args.values !== undefined) repeat.values = args.values;
	return {
		repeat,
		...(args.fieldIds?.length ? { fieldIds: [...args.fieldIds] } : {}),
		onSave(result) {
			const previous = args.getItems();
			// The index at launch can be behind the stored array. Find the open item as it is stored now.
			const index = currentRepeatItemIndex(previous, args.index, args.values, args.keys);
			if (index === -1) {
				console.warn(`Repeat "${args.fieldId}": the item being edited is no longer in the list. Nothing was saved.`);
				return Promise.resolve({ close: true });
			}
			const next = writeItemToParent(previous, index, result.values);
			// Same rule as `carryReplacedItem`. This file stays free of imports so its tests need no loader.
			if (index !== undefined) args.keys?.carry(previous[index], next[index]);
			args.setItems(next);
			return Promise.resolve({ close: true });
		}
	};
}
