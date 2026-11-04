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

import type { RepeatItem } from './Repeat';
import { xmlAttributePrefix } from '../lib/formConsts';
import type { RepeatItemKeys } from '../lib/repeatItemKeys';

/** Configured child fields that may be shown. Prefixed XML attributes are not labels. */
export function repeatDisplayFieldIds(fields: Record<string, unknown> | null | undefined): string[] {
	return Object.keys(fields ?? {}).filter((id) => !id.startsWith(xmlAttributePrefix));
}

/** A value an author can read. Objects and empty strings are not labels. */
function displayText(value: unknown): string | undefined {
	if (typeof value === 'string') return value ? value : undefined;
	if (typeof value === 'number' && Number.isFinite(value)) return String(value);
	if (typeof value === 'boolean') return String(value);
	return undefined;
}

/**
 * Title for a repeat item. `fieldIds` are already the configured children.
 * A populated child whose id contains `title` wins; otherwise the first populated
 * child is used. An item with nothing to show is blank.
 */
export function getRepeatItemTitle(item: RepeatItem, fieldIds: readonly string[]): string {
	const titleId = fieldIds.find((id) => id.includes('title') && displayText(item[id]) !== undefined);
	const title = titleId ? displayText(item[titleId]) : undefined;
	if (title !== undefined) return title;
	for (const id of fieldIds) {
		const text = displayText(item[id]);
		if (text !== undefined) return text;
	}
	return '';
}

/** Summary of the given field ids. Callers pass ids from {@link repeatDisplayFieldIds}. */
export function getRepeatItemSummary(item: RepeatItem, fieldIds: readonly string[]): string {
	// TODO: HTML tags would look quite bad; somehow exclude HTML fields or convert to text?
	return fieldIds
		.flatMap((id) => {
			const value = item[id];
			return typeof value === 'string' && value ? value.substring(0, 50) : [];
		})
		.join(' | ');
}

/** Reorder rows. The label is the same title the list shows, and `data` is the whole stored item. */
export function repeatSortItems(
	items: readonly RepeatItem[],
	fieldIds: readonly string[],
	keys: RepeatItemKeys<RepeatItem>
): Array<{ key: string; value: string; data: RepeatItem }> {
	return items.map((item, index) => ({
		key: keys.keyOf(item) ?? String(index),
		value: getRepeatItemTitle(item, fieldIds),
		data: item
	}));
}

/**
 * The array to store after a reorder, built from `current` (the stored array). Each sorted row's `key` is the key
 * of the item it showed, so a row finds its item even if the array moved since the list was built. A key that no
 * longer matches an item is dropped, and an item the list did not name stays at the end.
 * Returns `current` when the order is unchanged, so a no-op reorder does not mark the repeat dirty.
 */
export function reorderRepeatItems(
	current: readonly RepeatItem[],
	sorted: ReadonlyArray<{ key: string }>,
	keys: RepeatItemKeys<RepeatItem>
): RepeatItem[] {
	const byKey = new Map<string, RepeatItem>();
	current.forEach((item, index) => byKey.set(keys.keyOf(item) ?? String(index), item));
	const used = new Set<RepeatItem>();
	const next: RepeatItem[] = [];
	for (const { key } of sorted) {
		const item = byKey.get(key);
		if (item === undefined || used.has(item)) continue;
		used.add(item);
		next.push(item);
	}
	for (const item of current) {
		if (!used.has(item)) next.push(item);
	}
	return next.length === current.length && next.every((item, index) => item === current[index])
		? (current as RepeatItem[])
		: next;
}
