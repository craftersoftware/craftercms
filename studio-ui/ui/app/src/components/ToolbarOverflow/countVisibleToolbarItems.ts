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
 * How many leading toolbar items fit in `containerWidth` while reserving `moreWidth`
 * for an overflow button. Returns every item when they already fit, or when the
 * container has not been laid out yet (width 0), so a hidden toolbar is not collapsed.
 */
export function countVisibleToolbarItems(
	itemWidths: readonly number[],
	containerWidth: number,
	moreWidth: number
): number {
	if (itemWidths.length === 0 || containerWidth <= 0) {
		return itemWidths.length;
	}
	const total = itemWidths.reduce((sum, width) => sum + width, 0);
	if (total <= containerWidth) {
		return itemWidths.length;
	}
	let used = moreWidth;
	let visible = 0;
	for (const width of itemWidths) {
		if (used + width > containerWidth) {
			break;
		}
		used += width;
		visible += 1;
	}
	return visible;
}
