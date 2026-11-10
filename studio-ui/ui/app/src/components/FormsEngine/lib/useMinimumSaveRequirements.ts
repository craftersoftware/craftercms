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

/**
 * Live list of what the save would refuse to write without. Empty means the minimum is met.
 * Reads the file-name validity and internal-name value atoms directly. The first read is immediate;
 * later changes wait out the same pause as the invalid-field alert ({@link invalidFieldReadDebounceMs})
 * so the banner's variant stays in step. The save still checks on its own.
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
	const [missing, setMissing] = useState<MinimumSaveRequirement[]>([]);
	const initial = useRef(true);

	useEffect(() => {
		initial.current = true;
	}, [atoms, isEmbedded, isRepeatMode]);

	useEffect(() => {
		if (!atoms || isRepeatMode) {
			setMissing((current) => (current.length === 0 ? current : []));
			initial.current = false;
			return;
		}
		if (fileNameLoadable.state === 'loading') return;
		if (fileNameLoadable.state === 'hasError') {
			// A plugin validator can reject. Keep the last result; the save guard still applies.
			console.error(fileNameLoadable.error);
			return;
		}
		const next = missingMinimumSaveRequirements({
			isRepeatMode,
			isEmbedded,
			fileNameValid: fileNameLoadable.data.isValid,
			internalName
		});
		const apply = () => setMissing((current) => (sameMinimumSaveRequirements(current, next) ? current : next));
		if (initial.current) {
			initial.current = false;
			apply();
			return;
		}
		const timer = window.setTimeout(apply, invalidFieldReadDebounceMs);
		return () => window.clearTimeout(timer);
	}, [atoms, fileNameLoadable, internalName, isEmbedded, isRepeatMode]);

	return missing;
}
