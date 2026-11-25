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

import { atom, type PrimitiveAtom, useStore } from 'jotai';
import { type RefObject, useLayoutEffect } from 'react';
import type { NodeSelectorItem } from '../controls/NodeSelector';

/** A request to focus one row of a node selector. Another instance (the move's destination) consumes it. */
export interface NodeSelectorFocusRequest {
	modelId: string;
	fieldId: string;
	/** Row position in the destination field after the move. */
	index: number;
	/** The moved item's key, so a list that changed again is not mistaken for the move's result. */
	key: string;
	/** `Date.now()` when requested. */
	at: number;
}

/** A request older than this is ignored, so a form mounting later does not steal focus. */
export const FOCUS_REQUEST_MAX_AGE_MS = 1000;

// Typed explicitly: without strictNullChecks, `atom<T | null>(null)` resolves to the read-only overload.
export const nodeSelectorFocusRequestAtom: PrimitiveAtom<NodeSelectorFocusRequest | null> = atom(
	null as NodeSelectorFocusRequest | null
);

/** Whether `request` is for this field, still fresh, and its row is in `list`. */
export function matchesFocusRequest(
	request: NodeSelectorFocusRequest | null,
	{
		modelId,
		fieldId,
		list,
		now = Date.now()
	}: { modelId: string; fieldId: string; list: readonly NodeSelectorItem[]; now?: number }
): boolean {
	if (!request) return false;
	const isThisField = request.modelId === modelId && request.fieldId === fieldId;
	const isFresh = now - request.at <= FOCUS_REQUEST_MAX_AGE_MS;
	const movedItemIsThere = list[request.index]?.key === request.key;
	return isThisField && isFresh && movedItemIsThere;
}

/**
 * Focuses the row named by a pending {@link NodeSelectorFocusRequest} once `list` shows it, then clears the request.
 * It reads the atom when `list` changes instead of subscribing, so a request re-renders no one.
 */
export function useNodeSelectorFocusRequest(args: {
	modelId: string;
	fieldId: string;
	list: readonly NodeSelectorItem[];
	rootRef: RefObject<HTMLElement | null>;
}) {
	const { modelId, fieldId, list, rootRef } = args;
	const store = useStore();
	useLayoutEffect(() => {
		const request = store.get(nodeSelectorFocusRequestAtom);
		if (!matchesFocusRequest(request, { modelId, fieldId, list })) return;
		store.set(nodeSelectorFocusRequestAtom, null);
		// Focus after this commit, not during it. A move is usually accepted from a dialog that is still closing: its
		// focus trap is still active here and pulls focus back into the dialog, which then unmounts and leaves focus on
		// the body. Timers run after the trap's effects are cleaned up.
		setTimeout(() => {
			rootRef.current
				?.querySelector<HTMLElement>(`[data-reorder-index="${request.index}"][data-reorder-control="row"]`)
				?.focus();
		}, 0);
	}, [list]); // eslint-disable-line react-hooks/exhaustive-deps -- Only a list change can bring the row.
}
