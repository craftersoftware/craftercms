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

import { atom, type Atom } from 'jotai';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormsEngineAtoms } from './formsEngineContext';
import { XmlKeys } from './formConsts';
import {
	missingMinimumSaveRequirements,
	sameMinimumSaveRequirements,
	type MinimumSaveRequirement
} from './minimumSaveRequirements';
import { invalidFieldReadDebounceMs } from './useInvalidFieldIds';
import useLoadableAtom from './useLoadableAtom';

/** Shared empty list. Returned whenever nothing is missing so subscribers see one reference. */
const EMPTY_MINIMUM_SAVE_REQUIREMENTS: MinimumSaveRequirement[] = Object.freeze([]) as MinimumSaveRequirement[];

const emptyMinimumSaveRequirementsAtom: Atom<Promise<MinimumSaveRequirement[]>> = atom(
	Promise.resolve(EMPTY_MINIMUM_SAVE_REQUIREMENTS)
);

const minimumSaveRequirementsAtomsByAtoms = new WeakMap<
	FormsEngineAtoms,
	Map<string, Atom<Promise<MinimumSaveRequirement[]>>>
>();

/**
 * What a save would refuse to write without, for one atoms object and mode.
 * Cached per atoms object and flags, the same way `invalidFieldIdsAtom` is. Reads the file-name validity atom
 * (skipped when embedded) and the internal-name value atom. Returns the previous array when the missing
 * list is unchanged, so a keystroke that does not change it notifies nothing. A repeat item returns the
 * previous list and reads neither atom.
 */
export function minimumSaveRequirementsAtom(
	atoms: FormsEngineAtoms | null | undefined,
	flags: { isRepeatMode: boolean; isEmbedded: boolean }
): Atom<Promise<MinimumSaveRequirement[]>> {
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
		requirementsAtom = atom(async (get) => {
			if (flags.isRepeatMode) return previous;
			const fileNameAtom = flags.isEmbedded ? undefined : atoms.validationByFieldId?.[XmlKeys.fileName];
			const internalNameAtom = atoms.valueByFieldId?.[XmlKeys.internalName];
			// Subscribe to both before awaiting, so a keystroke during validation is not missed.
			const fileNameState = fileNameAtom ? get(fileNameAtom) : undefined;
			const internalName = internalNameAtom ? get(internalNameAtom) : undefined;
			const fileNameValid = fileNameState ? (await fileNameState).isValid : true;
			const next = missingMinimumSaveRequirements({
				isRepeatMode: flags.isRepeatMode,
				isEmbedded: flags.isEmbedded,
				fileNameValid,
				internalName
			});
			if (sameMinimumSaveRequirements(previous, next)) return previous;
			previous = next.length === 0 ? EMPTY_MINIMUM_SAVE_REQUIREMENTS : next;
			return previous;
		});
		byFlags.set(flagsKey, requirementsAtom);
	}
	return requirementsAtom;
}

/**
 * Live list of what the save would refuse to write without. Empty means the minimum is met.
 * Reads {@link minimumSaveRequirementsAtom}. The first read is immediate; later changes wait out
 * the same pause as the invalid-field alert ({@link invalidFieldReadDebounceMs}) so the banner's
 * variant stays in step. A rejected file-name validator keeps the last list. The save still checks
 * on its own.
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
	const requirements = useLoadableAtom(requirementsAtom);
	const [missing, setMissing] = useState<MinimumSaveRequirement[]>([]);
	const initial = useRef(true);

	useEffect(() => {
		initial.current = true;
	}, [atoms, isEmbedded, isRepeatMode]);

	useEffect(() => {
		if (!atoms || isRepeatMode) {
			initial.current = false;
			return;
		}
		if (requirements.state === 'loading') return;
		if (requirements.state === 'hasError') {
			// A plugin validator can reject. Keep the last result; the save guard still applies.
			console.error(requirements.error);
			return;
		}
		const next = requirements.data;
		const apply = () => setMissing((current) => (sameMinimumSaveRequirements(current, next) ? current : next));
		if (initial.current) {
			initial.current = false;
			apply();
			return;
		}
		const timer = window.setTimeout(apply, invalidFieldReadDebounceMs);
		return () => window.clearTimeout(timer);
	}, [atoms, isEmbedded, isRepeatMode, requirements]);

	// A repeat item and a form that is not ready yet have nothing to report. Returned here so the
	// displayed list drops on the same render the flags change, without a state write in the effect.
	if (!atoms || isRepeatMode) return EMPTY_MINIMUM_SAVE_REQUIREMENTS;
	return missing;
}
