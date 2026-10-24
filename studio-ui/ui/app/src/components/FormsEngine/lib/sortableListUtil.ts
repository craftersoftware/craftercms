/*
 * Copyright (C) 2007-2024 Crafter Software Corporation. All Rights Reserved.
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

import { useLayoutEffect, useRef } from 'react';
import { ListItemButtonProps } from '@mui/material/ListItemButton';

export type KeyDownEvent = Parameters<ListItemButtonProps['onKeyDown']>[0];

export type SortKey = 'e' | 'v' | 'ArrowUp' | 'ArrowRight' | 'ArrowDown' | 'ArrowLeft';
export type SortAction = 'up' | 'right' | 'down' | 'left';

const sortingKeyToActionMap: Record<SortKey, SortAction | 'edit' | 'view'> = {
	e: 'edit',
	v: 'view',
	ArrowUp: 'up',
	ArrowRight: 'right',
	ArrowDown: 'down',
	ArrowLeft: 'left'
};

/** Index the item will occupy, or null when the move would pass an edge. */
export function destinationIndex(
	action: SortAction,
	moveToEdge: boolean,
	index: number,
	length: number
): number | null {
	if (length <= 1) {
		return null;
	}
	const lastIndex = length - 1;
	if (action === 'up' || action === 'left') {
		if (index === 0) {
			return null;
		}
		return moveToEdge ? 0 : index - 1;
	}
	if (index === lastIndex) {
		return null;
	}
	return moveToEdge ? lastIndex : index + 1;
}

export function sortableListKeyDownHandler<T = unknown>(
	event: KeyDownEvent,
	list: T[],
	index: number,
	onChange: (newList: T[]) => void,
	onOpen: (index: number, edit: boolean) => void,
	onMoved?: (nextIndex: number) => void
): void {
	const action = sortingKeyToActionMap[event.key];
	if (
		// Not a key we're working with.
		!action ||
		// Only one item.
		list.length <= 1
	) {
		// Do nothing.
		return;
	}
	event.preventDefault();
	event.stopPropagation();
	switch (action) {
		case 'edit':
		case 'view':
			onOpen(index, action === 'edit');
			break;
		default: {
			const next = destinationIndex(action, event.shiftKey, index, list.length);
			if (next == null) {
				return;
			}
			sortableListActionProcessor(action, event.shiftKey, list, index, onChange);
			onMoved?.(next);
		}
	}
}

export function sortableListActionProcessor<T = unknown>(
	action: SortAction,
	moveToEdge: boolean,
	list: T[],
	index: number,
	onChange: (newList: T[]) => void
): void {
	const next = destinationIndex(action, moveToEdge, index, list.length);
	if (next == null) {
		return;
	}
	const item = list[index];
	const newList = list.concat();
	newList.splice(index, 1);
	newList.splice(next, 0, item);
	onChange(newList);
}

/** After a reorder, focus the control that belongs to the moved item. */
export function useReorderFocus<T>(list: T[]) {
	const rootRef = useRef<HTMLUListElement | null>(null);
	const pendingRef = useRef<{ index: number; control: string } | null>(null);
	useLayoutEffect(() => {
		const pending = pendingRef.current;
		const root = rootRef.current;
		if (!pending || !root) {
			return;
		}
		pendingRef.current = null;
		const controls = [pending.control, 'row', 'down', 'up', 'top', 'bottom'];
		for (const control of controls) {
			const element = root.querySelector<HTMLElement>(
				`[data-reorder-index="${pending.index}"][data-reorder-control="${control}"]`
			);
			if (element && !element.hasAttribute('disabled') && element.getAttribute('aria-disabled') !== 'true') {
				element.focus({ preventScroll: true });
				return;
			}
		}
	}, [list]);
	const remember = (index: number, control: string) => {
		pendingRef.current = { index, control };
	};
	return { rootRef, remember };
}

export function isTouchDevice() {
	return (
		'ontouchstart' in window || navigator.maxTouchPoints > 0 // || navigator.msMaxTouchPoints > 0
	);
}
