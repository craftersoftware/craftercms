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

export interface RepeatOccurrenceViolation {
	kind: 'min' | 'max';
	limit: number;
}

/**
 * FE1 content types store repeat limits as `minOccurs` / `maxOccurs`, both as elements on the
 * field and (duplicated) as properties. `*` and blank mean unlimited. The element wins when set.
 */
export function parseRepeatOccursLimit(topLevel: unknown, propertyValue?: unknown): number | null {
	const top = typeof topLevel === 'string' ? topLevel.trim() : topLevel;
	const hasTopLevel = top != null && top !== '';
	return readOccursNumber(hasTopLevel ? top : propertyValue);
}

/** Numeric validation values. `*`, blank, and non-numeric values mean "no limit". */
export function readNumericLimit(value: unknown): number | undefined {
	const parsed = readOccursNumber(value);
	return parsed == null ? undefined : parsed;
}

/**
 * Add is allowed while the count is below the max, including when the repeat is empty.
 * A missing max ("unlimited") never disables Add. Readonly always does.
 */
export function isRepeatAddDisabled(readonly: boolean, count: number, maxCount: unknown): boolean {
	if (readonly) return true;
	const max = readNumericLimit(maxCount);
	return max != null && count >= max;
}

/**
 * Minimum the repeat will enforce. An explicit min wins. A required repeat with no min still
 * needs one item. Otherwise there is no minimum (0).
 */
export function getRepeatMinimum(minCount: unknown, required = false): number {
	const min = readNumericLimit(minCount);
	if (min != null) return min;
	return required ? 1 : 0;
}

/**
 * FE1 disables delete when the current count is at or below `minOccurs` (default 0).
 * Readonly always disables removal. `required` matches {@link getRepeatMinimum}.
 */
export function isRepeatRemoveDisabled(readonly: boolean, count: number, minCount: unknown, required = false): boolean {
	if (readonly) return true;
	return count <= getRepeatMinimum(minCount, required);
}

/**
 * Count may equal the min or the max. Only a count outside that range is invalid.
 * A missing max does not apply an upper bound.
 */
export function getRepeatOccurrenceViolations(
	count: number,
	minCount: unknown,
	maxCount: unknown
): RepeatOccurrenceViolation[] {
	const violations: RepeatOccurrenceViolation[] = [];
	const min = readNumericLimit(minCount);
	const max = readNumericLimit(maxCount);
	if (min != null && count < min) violations.push({ kind: 'min', limit: min });
	if (max != null && count > max) violations.push({ kind: 'max', limit: max });
	return violations;
}

/** Parses a repeat limit. `*`, blank, and non-numeric values are unlimited (`null`). */
function readOccursNumber(value: unknown): number | null {
	if (value == null) return null;
	const text = typeof value === 'string' ? value.trim() : value;
	if (text === '' || text === '*') return null;
	const parsed = typeof text === 'number' ? text : Number.parseInt(String(text), 10);
	return Number.isNaN(parsed) ? null : parsed;
}
