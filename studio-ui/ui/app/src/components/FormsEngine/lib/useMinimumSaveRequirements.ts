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

import { atom, type Atom, useAtomValue } from 'jotai';
import { unwrap } from 'jotai/utils';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormsEngineAtoms } from './formsEngineContext';
import { XmlKeys } from './formConsts';
import {
	missingMinimumSaveRequirements,
	sameMinimumSaveRequirements,
	type MinimumSaveRequirement
} from './minimumSaveRequirements';
import { invalidFieldReadDebounceMs } from './useInvalidFieldIds';
import type { FieldValidityState } from './validators';

/** Shared empty list. Returned whenever nothing is missing so subscribers see one reference. */
const EMPTY_MINIMUM_SAVE_REQUIREMENTS: MinimumSaveRequirement[] = Object.freeze([]) as MinimumSaveRequirement[];

/**
 * What the atom holds: the missing list plus whether the file-name verdict has settled. A verdict that
 * leaves the list unchanged still flips `known` once, so the hook can tell the first verdict from later edits.
 */
export type MinimumSaveState = { missing: MinimumSaveRequirement[]; known: boolean };

const EMPTY_STATE: MinimumSaveState = { missing: EMPTY_MINIMUM_SAVE_REQUIREMENTS, known: true };

const emptyMinimumSaveStateAtom: Atom<MinimumSaveState> = atom(EMPTY_STATE);

/** Last settled file-name verdict. `known` is false until the first result; a later run keeps `isValid`. */
type SettledFileNameValidity = { known: boolean; isValid: boolean };

const UNKNOWN_FILE_NAME: SettledFileNameValidity = { known: false, isValid: true };

/** Stable fallback so `unwrap` returns one atom per file-name atom. Pending resolves to the previous verdict. */
function keepPreviousFileName(prev?: FieldValidityState): FieldValidityState | undefined {
	return prev;
}

const fileNameValidityAtoms = new WeakMap<Atom<Promise<FieldValidityState>>, Atom<SettledFileNameValidity>>();

/**
 * File-name validity without awaiting it. A pending check keeps the previous verdict (or "not yet known"),
 * and a rejection keeps the last verdict instead of throwing, so an internal-name edit is not blocked
 * and does not re-render on the rejection itself.
 */
function settledFileNameValidityAtom(fileNameAtom: Atom<Promise<FieldValidityState>>): Atom<SettledFileNameValidity> {
	let settled = fileNameValidityAtoms.get(fileNameAtom);
	if (!settled) {
		const unwrapped = unwrap(fileNameAtom, keepPreviousFileName);
		let last = UNKNOWN_FILE_NAME;
		let lastError: unknown;
		settled = atom((get) => {
			try {
				const value = get(unwrapped);
				if (!value) return last;
				if (last.known && last.isValid === value.isValid) return last;
				last = { known: true, isValid: value.isValid };
				return last;
			} catch (error) {
				// A plugin validator can reject. Keep the last verdict; log each failed run once.
				if (error !== lastError) {
					lastError = error;
					console.error(error);
				}
				if (!last.known) last = { known: true, isValid: true };
				return last;
			}
		});
		fileNameValidityAtoms.set(fileNameAtom, settled);
	}
	return settled;
}

const minimumSaveStateAtomsByAtoms = new WeakMap<FormsEngineAtoms, Map<string, Atom<MinimumSaveState>>>();

/**
 * What a save would refuse to write without, for one atoms object and mode.
 * Cached per atoms object and flags, the same way `invalidFieldIdsAtom` is. Synchronous: file-name validity
 * is the last settled verdict (skipped when embedded), so a pending or rejected file-name check does not block
 * the internal name. Returns the previous state when neither the list nor `known` changed, so a keystroke
 * that does not change them notifies nothing. A repeat item returns the empty state and reads neither atom.
 */
export function minimumSaveStateAtom(
	atoms: FormsEngineAtoms | null | undefined,
	flags: { isRepeatMode: boolean; isEmbedded: boolean; hasInternalNameField: boolean }
): Atom<MinimumSaveState> {
	if (!atoms || flags.isRepeatMode) return emptyMinimumSaveStateAtom;
	const flagsKey = `${flags.isEmbedded}:${flags.hasInternalNameField}`;
	let byFlags = minimumSaveStateAtomsByAtoms.get(atoms);
	if (!byFlags) {
		byFlags = new Map();
		minimumSaveStateAtomsByAtoms.set(atoms, byFlags);
	}
	let stateAtom = byFlags.get(flagsKey);
	if (!stateAtom) {
		let previous = EMPTY_STATE;
		stateAtom = atom((get) => {
			const fileNameAtom = flags.isEmbedded ? undefined : atoms.validationByFieldId?.[XmlKeys.fileName];
			const internalNameAtom = atoms.valueByFieldId?.[XmlKeys.internalName];
			const fileName = fileNameAtom ? get(settledFileNameValidityAtom(fileNameAtom)) : undefined;
			const internalName = internalNameAtom ? get(internalNameAtom) : undefined;
			const next = missingMinimumSaveRequirements({
				isRepeatMode: false,
				isEmbedded: flags.isEmbedded,
				fileNameValid: fileName?.isValid ?? true,
				internalName,
				hasInternalNameField: flags.hasInternalNameField
			});
			const known = fileName ? fileName.known : true;
			const missing = sameMinimumSaveRequirements(previous.missing, next)
				? previous.missing
				: next.length === 0
					? EMPTY_MINIMUM_SAVE_REQUIREMENTS
					: next;
			if (missing === previous.missing && known === previous.known) return previous;
			previous = { missing, known };
			return previous;
		});
		byFlags.set(flagsKey, stateAtom);
	}
	return stateAtom;
}

/**
 * Live list of what the save would refuse to write without. Empty means the minimum is met.
 * Reads {@link minimumSaveStateAtom}. The first read for a form, and the first settled file-name
 * verdict, apply immediately; later changes wait out the same pause as the invalid-field alert
 * ({@link invalidFieldReadDebounceMs}) so the banner's variant stays in step. The save still checks on its own.
 */
export function useMinimumSaveRequirements(
	atoms: FormsEngineAtoms | null | undefined,
	flags: { isRepeatMode: boolean; isEmbedded: boolean; hasInternalNameField: boolean }
): MinimumSaveRequirement[] {
	const { isRepeatMode, isEmbedded, hasInternalNameField } = flags;
	const stateAtom = useMemo(
		() => minimumSaveStateAtom(atoms, { isRepeatMode, isEmbedded, hasInternalNameField }),
		[atoms, isEmbedded, isRepeatMode, hasInternalNameField]
	);
	const { missing: requirements, known } = useAtomValue(stateAtom);
	const [missing, setMissing] = useState<MinimumSaveRequirement[]>(EMPTY_MINIMUM_SAVE_REQUIREMENTS);
	const [source, setSource] = useState({ atoms, isRepeatMode, isEmbedded, hasInternalNameField });
	const initial = useRef(true);
	const appliedSettledFileName = useRef(false);

	// A new atoms object must not paint the previous form's list. Adjusting state while rendering
	// drops it before paint; an effect would run too late.
	const sourceChanged =
		source.atoms !== atoms ||
		source.isRepeatMode !== isRepeatMode ||
		source.isEmbedded !== isEmbedded ||
		source.hasInternalNameField !== hasInternalNameField;
	const nextMissing = !atoms || isRepeatMode ? EMPTY_MINIMUM_SAVE_REQUIREMENTS : requirements;
	if (sourceChanged) {
		setSource({ atoms, isRepeatMode, isEmbedded, hasInternalNameField });
		setMissing(nextMissing);
	}

	useEffect(() => {
		initial.current = true;
		appliedSettledFileName.current = false;
	}, [atoms, isEmbedded, isRepeatMode, hasInternalNameField]);

	useEffect(() => {
		if (!atoms || isRepeatMode) {
			initial.current = false;
			return;
		}
		const next = requirements;
		const apply = () => setMissing((current) => (sameMinimumSaveRequirements(current, next) ? current : next));
		// The first file-name verdict is not a later edit. It applies immediately, including when an
		// already-resolved promise lands on the microtask after the placeholder read.
		const firstFileNameVerdict = known && !appliedSettledFileName.current;
		if (initial.current || firstFileNameVerdict) {
			initial.current = false;
			appliedSettledFileName.current = known;
			apply();
			return;
		}
		appliedSettledFileName.current = known;
		const timer = window.setTimeout(apply, invalidFieldReadDebounceMs);
		return () => window.clearTimeout(timer);
	}, [atoms, isRepeatMode, requirements, known]);
	if (!atoms || isRepeatMode) return EMPTY_MINIMUM_SAVE_REQUIREMENTS;
	return sourceChanged ? nextMissing : missing;
}
