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
 * Accessible name per AccName: `aria-labelledby`, then `aria-label`.
 * An id counts only when an element with that id exists. Missing ids are left out.
 * If none resolve, or the ones that do have no text, `aria-label` is the name.
 */
export function accessibleName(node: HTMLElement) {
	const ids = node.getAttribute('aria-labelledby')?.split(/\s+/).filter(Boolean) ?? [];
	const parts = ids.flatMap((id) => {
		const element = node.ownerDocument.getElementById(id);
		return element ? [element.textContent ?? ''] : [];
	});
	const fromLabelledBy = parts.join(' ').replace(/\s+/g, ' ').trim();
	if (fromLabelledBy) return fromLabelledBy;
	return node.getAttribute('aria-label') ?? '';
}
