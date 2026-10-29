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
 * The one way to open a repeat item form: the pencil, Add, and an Experience Builder launch.
 * `onSave` reads the array at save time so an edit made after the form opened is not overwritten.
 */

export function commitRepeatItem<T>(items: readonly T[], index: number | undefined, nextItem: T): T[] {
	if (index === undefined) return items.concat(nextItem);
	const next = items.slice();
	next.splice(index, 1, nextItem);
	return next;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}

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

/** The repeat item inside a saved content object, or undefined when this entry is not that item. */
export function repeatItemInValues(
	values: Record<string, unknown> | null | undefined,
	fieldId: string | undefined,
	index: number | undefined
): unknown {
	if (!values || fieldId === undefined || index === undefined) return undefined;
	const list = values[fieldId];
	return Array.isArray(list) ? list[index] : undefined;
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
 */
export function clearStackPendingFlags(
	entries: readonly {
		selected: boolean;
		changedFieldIds: Set<string>;
		setPending(value: boolean): void;
		savedItem?: unknown;
		currentItem?: unknown;
		/** Repeat field on the parent. An in-flight edit records this id on the parent. */
		fieldId?: string;
		setCheckpoint?(values: Record<string, unknown>): void;
	}[],
	parentChangedFieldIds?: Set<string>
): void {
	for (const entry of entries) {
		const decision = selectedItemPendingAfterSave({
			selected: entry.selected,
			savedItem: entry.savedItem,
			currentItem: entry.currentItem
		});
		if (decision.checkpoint) entry.setCheckpoint?.(decision.checkpoint);
		if (!entry.selected) continue;
		// Rebuild from the saved checkpoint. An undo during the save is not in the old id list.
		if (decision.checkpoint && isPlainRecord(entry.currentItem)) {
			entry.changedFieldIds.clear();
			for (const id of Object.keys(entry.currentItem)) {
				if (!sameItem(entry.currentItem[id], decision.checkpoint[id])) entry.changedFieldIds.add(id);
			}
		} else if (decision.clearPending) {
			entry.changedFieldIds.clear();
		}
		if (entry.changedFieldIds.size === 0) {
			entry.setPending(false);
			continue;
		}
		entry.setPending(true);
		if (entry.fieldId) parentChangedFieldIds?.add(entry.fieldId);
	}
}

/** Compares the form's own fields. Extra keys on the stored item are not an in-flight edit. */
function formFieldsMatchSaved(saved: unknown, current: unknown): boolean {
	if (!isPlainRecord(current) || !isPlainRecord(saved)) return sameItem(saved, current);
	return Object.keys(current).every((key) => sameItem(current[key], saved[key]));
}

export function repeatItemFormProps<T extends Record<string, unknown>>(args: {
	fieldId: string;
	index?: number;
	values?: T;
	/** Child fields to show. Omit it for the pencil and for a whole-item launch. */
	fieldIds?: readonly string[] | null;
	getItems(): readonly T[];
	setItems(next: T[]): void;
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
			args.setItems(writeItemToParent(args.getItems(), args.index, result.values));
			return Promise.resolve({ close: true });
		}
	};
}
