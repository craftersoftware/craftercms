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

import { atom, type Atom, useAtomValue, useStore as useJotaiStore } from 'jotai';
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

const emptyMinimumSaveRequirementsAtom: Atom<MinimumSaveRequirement[]> = atom(EMPTY_MINIMUM_SAVE_REQUIREMENTS);

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
		settled = atom((get) => {
			try {
				const value = get(unwrapped);
				if (!value) return last;
				if (last.known && last.isValid === value.isValid) return last;
				last = { known: true, isValid: value.isValid };
				return last;
			} catch {
				// A plugin validator can reject. Keep the last verdict; there is nothing new to publish.
				if (!last.known) last = { known: true, isValid: true };
				return last;
			}
		});
		fileNameValidityAtoms.set(fileNameAtom, settled);
	}
	return settled;
}

const minimumSaveRequirementsAtomsByAtoms = new WeakMap<
	FormsEngineAtoms,
	Map<string, Atom<MinimumSaveRequirement[]>>
>();

/** Whether the cached atom's last read had a settled file-name verdict. No file-name atom counts as settled. */
const fileNameKnownByRequirementsAtom = new WeakMap<
	Atom<MinimumSaveRequirement[]>,
	{ known: boolean; settledAtom: Atom<SettledFileNameValidity> | null }
>();

/**
 * What a save would refuse to write without, for one atoms object and mode.
 * Cached per atoms object and flags, the same way `invalidFieldIdsAtom` is. Synchronous: file-name validity
 * is the last settled verdict (skipped when embedded), so a pending or rejected file-name check does not block
 * the internal name. Returns the previous array when the missing list is unchanged, so a keystroke that does
 * not change it notifies nothing. A repeat item returns the previous list and reads neither atom.
 */
export function minimumSaveRequirementsAtom(
	atoms: FormsEngineAtoms | null | undefined,
	flags: { isRepeatMode: boolean; isEmbedded: boolean }
): Atom<MinimumSaveRequirement[]> {
	if (!atoms) return emptyMinimumSaveRequirementsAtom;
	const flagsKey = `${flags.isRepeatMode}:${flags.isEmbedded}`;
	let byFlags = minimumSaveRequirementsAtomsByAtoms.get(atoms);
	if (!byFlags) {
		byFlags = new Map();
		minimumSaveRequirementsAtomsByAtoms.set(atoms, byFlags);
	}
	let requirementsAtom = byFlags.get(flagsKey);
	if (!requirementsAtom) {
		let previous = EMPTY_MINIMUM_SAVE_REQUIREMENTS;
		const fileNameStatus: { known: boolean; settledAtom: Atom<SettledFileNameValidity> | null } = {
			known: flags.isRepeatMode || flags.isEmbedded,
			settledAtom: null
		};
		requirementsAtom = atom((get) => {
			if (flags.isRepeatMode) {
				fileNameStatus.known = true;
				return previous;
			}
			const fileNameAtom = flags.isEmbedded ? undefined : atoms.validationByFieldId?.[XmlKeys.fileName];
			const internalNameAtom = atoms.valueByFieldId?.[XmlKeys.internalName];
			const settled = fileNameAtom ? settledFileNameValidityAtom(fileNameAtom) : undefined;
			fileNameStatus.settledAtom = settled ?? null;
			const fileName = settled ? get(settled) : undefined;
			fileNameStatus.known = fileName ? fileName.known : true;
			const internalName = internalNameAtom ? get(internalNameAtom) : undefined;
			const next = missingMinimumSaveRequirements({
				isRepeatMode: flags.isRepeatMode,
				isEmbedded: flags.isEmbedded,
				fileNameValid: fileName?.isValid ?? true,
				internalName
			});
			if (sameMinimumSaveRequirements(previous, next)) return previous;
			previous = next.length === 0 ? EMPTY_MINIMUM_SAVE_REQUIREMENTS : next;
			return previous;
		});
		fileNameKnownByRequirementsAtom.set(requirementsAtom, fileNameStatus);
		byFlags.set(flagsKey, requirementsAtom);
	}
	return requirementsAtom;
}

/**
 * Live list of what the save would refuse to write without. Empty means the minimum is met.
 * Reads {@link minimumSaveRequirementsAtom}. The first read for a form, and the first settled file-name
 * verdict, apply immediately; later changes wait out the same pause as the invalid-field alert
 * ({@link invalidFieldReadDebounceMs}) so the banner's variant stays in step. The save still checks on its own.
 */
export function useMinimumSaveRequirements(
	atoms: FormsEngineAtoms | null | undefined,
	flags: { isRepeatMode: boolean; isEmbedded: boolean }
): MinimumSaveRequirement[] {
	const { isRepeatMode, isEmbedded } = flags;
	const requirementsAtom = useMemo(
		() => minimumSaveRequirementsAtom(atoms, { isRepeatMode, isEmbedded }),
		[atoms, isEmbedded, isRepeatMode]
	);
	const requirements = useAtomValue(requirementsAtom);
	const [missing, setMissing] = useState<MinimumSaveRequirement[]>(EMPTY_MINIMUM_SAVE_REQUIREMENTS);
	const [source, setSource] = useState({ atoms, isRepeatMode, isEmbedded });
	const initial = useRef(true);
	const appliedSettledFileName = useRef(false);
	const shownRequirements = useRef(requirements);
	const jotai = useJotaiStore();

	// A new atoms object must not paint the previous form's list. Adjusting state while rendering
	// drops it before paint; an effect would run too late.
	const sourceChanged =
		source.atoms !== atoms || source.isRepeatMode !== isRepeatMode || source.isEmbedded !== isEmbedded;
	const nextMissing = !atoms || isRepeatMode ? EMPTY_MINIMUM_SAVE_REQUIREMENTS : requirements;
	if (sourceChanged) {
		setSource({ atoms, isRepeatMode, isEmbedded });
		setMissing(nextMissing);
	}

	useEffect(() => {
		shownRequirements.current = requirements;
	}, [requirements]);

	// A file-name verdict that does not change the missing list never re-renders. Remember that it
	// settled so the next internal-name edit still waits out the display pause.
	useEffect(() => {
		const settled = fileNameKnownByRequirementsAtom.get(requirementsAtom)?.settledAtom;
		if (!settled) {
			appliedSettledFileName.current = true;
			return;
		}
		const markIfListUnchanged = () => {
			if (!jotai.get(settled).known) return;
			if (jotai.get(requirementsAtom) === shownRequirements.current) appliedSettledFileName.current = true;
		};
		markIfListUnchanged();
		return jotai.sub(settled, markIfListUnchanged);
	}, [jotai, requirementsAtom]);

	useEffect(() => {
		initial.current = true;
		appliedSettledFileName.current = false;
	}, [atoms, isEmbedded, isRepeatMode]);

	useEffect(() => {
		if (!atoms || isRepeatMode) {
			initial.current = false;
			return;
		}
		const known = fileNameKnownByRequirementsAtom.get(requirementsAtom)?.known ?? true;
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
	}, [atoms, isEmbedded, isRepeatMode, requirements, requirementsAtom]);

	if (!atoms || isRepeatMode) return EMPTY_MINIMUM_SAVE_REQUIREMENTS;
	return sourceChanged ? nextMissing : missing;
}
