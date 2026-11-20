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

import { atom, useAtomValue } from 'jotai';
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
import type { FieldValidityState } from './validators';

const emptyInternalName = atom<unknown>(undefined);
const alwaysValidFileName = atom(Promise.resolve({ isValid: true, messages: [] } as FieldValidityState));

const emptyMissing: MinimumSaveRequirement[] = [];

/**
 * Live list of what the save would refuse to write without. Empty means the minimum is met.
 * Reads the file-name validity and internal-name value atoms directly. The first read, and the first
 * settled file-name verdict, apply immediately; later changes wait out the same pause as the invalid-field
 * alert ({@link invalidFieldReadDebounceMs}) so the banner's variant stays in step. A pending or rejected
 * file-name check keeps the last verdict (valid until one exists), so the internal name is not blocked.
 * The save still checks on its own.
 */
export function useMinimumSaveRequirements(
	atoms: FormsEngineAtoms | null | undefined,
	flags: { isRepeatMode: boolean; isEmbedded: boolean }
): MinimumSaveRequirement[] {
	const { isRepeatMode, isEmbedded } = flags;
	const fileNameAtom = useMemo(() => {
		if (!atoms || isRepeatMode || isEmbedded) return alwaysValidFileName;
		return atoms.validationByFieldId?.[XmlKeys.fileName] ?? alwaysValidFileName;
	}, [atoms, isEmbedded, isRepeatMode]);
	const internalNameAtom = useMemo(() => {
		if (!atoms || isRepeatMode) return emptyInternalName;
		return atoms.valueByFieldId?.[XmlKeys.internalName] ?? emptyInternalName;
	}, [atoms, isRepeatMode]);
	const fileNameLoadable = useLoadableAtom(fileNameAtom);
	const internalName = useAtomValue(internalNameAtom);
	const [missing, setMissing] = useState<MinimumSaveRequirement[]>(emptyMissing);
	const [source, setSource] = useState({ atoms, isRepeatMode, isEmbedded });
	const initial = useRef(true);
	const sawFileName = useRef(isRepeatMode || isEmbedded || !atoms);
	const lastFileNameValid = useRef(true);
	const loggedError = useRef<unknown>(undefined);

	// A new form must not paint the previous form's list. Adjusting state while rendering drops it before paint.
	const sourceChanged =
		source.atoms !== atoms || source.isRepeatMode !== isRepeatMode || source.isEmbedded !== isEmbedded;
	if (sourceChanged) {
		setSource({ atoms, isRepeatMode, isEmbedded });
		setMissing(emptyMissing);
		initial.current = true;
		sawFileName.current = isRepeatMode || isEmbedded || !atoms;
		lastFileNameValid.current = true;
		loggedError.current = undefined;
	}

	useEffect(() => {
		if (!atoms || isRepeatMode) {
			initial.current = false;
			sawFileName.current = true;
			setMissing((current) => (current.length === 0 ? current : emptyMissing));
			return;
		}
		if (!isEmbedded) {
			if (fileNameLoadable.state === 'hasData') {
				lastFileNameValid.current = fileNameLoadable.data.isValid;
				loggedError.current = undefined;
			} else if (fileNameLoadable.state === 'hasError' && loggedError.current !== fileNameLoadable.error) {
				// A plugin validator can reject. Keep the last verdict and log this failed run once.
				loggedError.current = fileNameLoadable.error;
				console.error(fileNameLoadable.error);
			}
		}
		const known = isEmbedded || fileNameLoadable.state !== 'loading';
		const next = missingMinimumSaveRequirements({
			isRepeatMode,
			isEmbedded,
			fileNameValid: isEmbedded || lastFileNameValid.current,
			internalName
		});
		const apply = () => setMissing((current) => (sameMinimumSaveRequirements(current, next) ? current : next));
		const firstFileNameVerdict = known && !sawFileName.current;
		if (known) sawFileName.current = true;
		if (initial.current || firstFileNameVerdict) {
			initial.current = false;
			apply();
			return;
		}
		const timer = window.setTimeout(apply, invalidFieldReadDebounceMs);
		return () => window.clearTimeout(timer);
	}, [atoms, fileNameLoadable, internalName, isEmbedded, isRepeatMode]);

	if (!atoms || isRepeatMode || sourceChanged) return emptyMissing;
	return missing;
}
