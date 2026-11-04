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

import { nanoid } from 'nanoid';

export interface RepeatItemKeys<T> {
	/** The row key for an item. Assigned the first time the item is seen and kept while the same object is in the list. */
	keyOf(item: T): string | undefined;
	/** Gives `next` the key of `previous`, for an edit that replaces the item with a new object. */
	carry(previous: T | undefined, next: T | undefined): void;
}

const isObject = (value: unknown): value is object => typeof value === 'object' && value !== null;

/**
 * Row identity for a repeat group. Ids live in a WeakMap, so they are never part of the item and are not saved.
 * Reordering and deleting keep the item objects, so each key stays with its item.
 */
export function createRepeatItemKeys<T>(): RepeatItemKeys<T> {
	const keys = new WeakMap<object, string>();
	return {
		keyOf(item) {
			if (!isObject(item)) return undefined;
			let key = keys.get(item);
			if (key === undefined) {
				key = nanoid();
				keys.set(item, key);
			}
			return key;
		},
		carry(previous, next) {
			if (!isObject(previous) || !isObject(next) || previous === next) return;
			const key = keys.get(previous);
			if (key !== undefined && !keys.has(next)) keys.set(next, key);
		}
	};
}

// One RepeatItemKeys per repeat field, found from the field's value atom. The repeat control and the item form
// (a separate FormsEngine instance) write to the same array, so they must share the keys.
const registry = new WeakMap<object, RepeatItemKeys<any>>();

/** The keys of the repeat field that owns `owner` (its value atom). */
export function repeatItemKeysFor<T>(owner: object): RepeatItemKeys<T> {
	let keys = registry.get(owner);
	if (!keys) {
		keys = createRepeatItemKeys<T>();
		registry.set(owner, keys);
	}
	return keys;
}

/**
 * The one place an in-place item replacement keeps its row: `next[index]` is a new object for the item that was
 * `previous[index]`. Call it with the arrays before and after the write, from every path that replaces an item.
 */
export function carryReplacedItem<T>(
	keys: RepeatItemKeys<T> | undefined,
	previous: readonly T[] | null | undefined,
	next: readonly T[] | null | undefined,
	index: number | undefined
): void {
	if (!keys || index === undefined || !previous || !next) return;
	keys.carry(previous[index], next[index]);
}

/**
 * Where `item` is in `items` now. The same object wins. An item an edit replaced is found by its carried key.
 * -1 when the item is no longer there.
 */
export function findRepeatItemIndex<T>(items: readonly T[], item: T, keys: RepeatItemKeys<T>): number {
	const index = items.indexOf(item);
	if (index !== -1) return index;
	const key = keys.keyOf(item);
	return key === undefined ? -1 : items.findIndex((candidate) => keys.keyOf(candidate) === key);
}

/** Removes the item at `index` from the current array. */
export function removeRepeatItem<T>(items: readonly T[], index: number): T[] {
	const next = items.concat();
	next.splice(index, 1);
	return next;
}
