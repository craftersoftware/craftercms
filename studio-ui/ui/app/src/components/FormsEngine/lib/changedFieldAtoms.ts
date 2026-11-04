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

import { atom, type Atom, type PrimitiveAtom } from 'jotai';

type Setter = (target: PrimitiveAtom<number>, update: (current: number) => number) => unknown;

interface Tracker {
	version: PrimitiveAtom<number>;
	byFieldId: Map<string, Atom<boolean>>;
}

// Keyed by the Set so the mutable `changedFieldIds` can stay as is for its existing readers.
const trackers = new WeakMap<Set<string>, Tracker>();

function trackerFor(changedFieldIds: Set<string>): Tracker {
	let tracker = trackers.get(changedFieldIds);
	if (!tracker) {
		tracker = { version: atom(0), byFieldId: new Map() };
		trackers.set(changedFieldIds, tracker);
	}
	return tracker;
}

/**
 * Whether `fieldId` is in `changedFieldIds`, as an atom. The atom only notifies when that boolean flips,
 * so a field re-renders for its own marker and not for every other field's edit.
 * Whoever mutates the Set calls {@link notifyChangedFieldIds} afterwards.
 */
export function changedFieldAtom(changedFieldIds: Set<string>, fieldId: string): Atom<boolean> {
	const tracker = trackerFor(changedFieldIds);
	let fieldAtom = tracker.byFieldId.get(fieldId);
	if (!fieldAtom) {
		fieldAtom = atom((get) => {
			get(tracker.version);
			return changedFieldIds.has(fieldId);
		});
		tracker.byFieldId.set(fieldId, fieldAtom);
	}
	return fieldAtom;
}

/** Tells subscribers of {@link changedFieldAtom} that `changedFieldIds` was mutated. `set` is a store's or an atom writer's `set`. */
export function notifyChangedFieldIds(set: Setter, changedFieldIds: Set<string>): void {
	set(trackerFor(changedFieldIds).version, (current) => current + 1);
}
