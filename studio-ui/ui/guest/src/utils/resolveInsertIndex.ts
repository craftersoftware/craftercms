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
 * Whole last path segment, matching `popPiece` in studio-ui string utils.
 * Inlined so this module stays free of the string util's imports.
 */
function lastIndexSegment(targetIndex: string): string {
	const segments = targetIndex.split('.');
	return segments[segments.length - 1] ?? '';
}

/** Canonical base-10 integer, no sign, no leading zero, no trailing junk. */
const NON_NEGATIVE_INTEGER = /^(0|[1-9]\d*)$/;

/**
 * Position at which `insertComponent` should splice into `collection`.
 *
 * `collection` is the list `getCollection` already resolved for `targetIndex`
 * (for a dotted index, the nested list, not the parent list). A dotted value
 * such as `"2.5"` or `"1.2.3"` addresses that nested list; only its last
 * segment is the position inside it.
 *
 * Returns null when the position is not a non-negative integer (`NaN`, `null`,
 * `undefined`, `""`, `"x"`, `"2.x"`, a negative, or a non-integer number).
 * Callers must not insert in that case. An integer past the end is clamped to
 * `collection.length`, which is what `Array.prototype.splice` already did for a
 * too-large finite integer. `collection.length` itself is a valid "insert at end".
 */
export function resolveInsertIndex(targetIndex: string | number, collection: readonly unknown[]): number | null {
	let index: number;
	if (typeof targetIndex === 'number') {
		// A numeric 2.5 is not a dotted path (those are strings). Do not truncate it.
		if (!Number.isInteger(targetIndex) || targetIndex < 0) {
			return null;
		}
		index = targetIndex;
	} else if (typeof targetIndex === 'string') {
		const segment = lastIndexSegment(targetIndex);
		if (!NON_NEGATIVE_INTEGER.test(segment)) {
			return null;
		}
		index = Number(segment);
	} else {
		// null, undefined, and any other runtime value. Do not call string methods on them.
		return null;
	}

	return index > collection.length ? collection.length : index;
}
