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

import React from 'react';

/**
 * MUI X Tree View handles arrows, Home and End on the treeitem. Call this from an item
 * `onKeyDown` for keys the tree should not also handle (Enter activation, context menu).
 * `defaultMuiPrevented` is the flag the tree's keyboard plugin checks.
 */
export function cancelTreeItemKey(event: React.KeyboardEvent<Element>): void {
	event.preventDefault();
	event.stopPropagation();
	(event as React.KeyboardEvent<Element> & { defaultMuiPrevented?: boolean }).defaultMuiPrevented = true;
}

/** WAI-ARIA tree pattern: Shift+F10 or the ContextMenu key opens the item menu. */
export function isTreeContextMenuKey(event: React.KeyboardEvent<Element>): boolean {
	return event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10');
}

/**
 * Nested treeitems are `li` elements inside an ancestor `li`, so click, contextmenu and
 * keydown bubble. A handler on the TreeItem root must ignore events whose closest treeitem
 * is a descendant.
 */
export function isOwnTreeItemEvent(event: React.SyntheticEvent<Element>): boolean {
	const target = event.target as Element | null;
	if (!target || typeof target.closest !== 'function') {
		return true;
	}
	return target.closest('[role="treeitem"]') === event.currentTarget;
}
