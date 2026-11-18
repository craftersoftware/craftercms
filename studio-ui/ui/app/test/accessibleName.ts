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
 * The name a screen reader uses. `aria-labelledby` wins whenever it lists ids, including when those
 * ids resolve to nothing: a present reference is the name, and `aria-label` is only the fallback.
 */
export function accessibleName(node: HTMLElement) {
	const ids = node.getAttribute('aria-labelledby')?.split(/\s+/).filter(Boolean) ?? [];
	if (ids.length) {
		return ids
			.map((id) => node.ownerDocument.getElementById(id)?.textContent ?? '')
			.join(' ')
			.replace(/\s+/g, ' ')
			.trim();
	}
	return node.getAttribute('aria-label') ?? '';
}
