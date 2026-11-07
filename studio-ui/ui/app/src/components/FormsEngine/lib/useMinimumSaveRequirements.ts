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
import { useEffect, useMemo, useState } from 'react';
import type { FormsEngineAtoms } from './formsEngineContext';
import { XmlKeys } from './formConsts';
import {
	missingMinimumSaveRequirements,
	sameMinimumSaveRequirements,
	type MinimumSaveRequirement
} from './minimumSaveRequirements';
import useLoadableAtom from './useLoadableAtom';
import type { FieldValidityState } from './validators';

const emptyInternalName = atom<unknown>(undefined);
const alwaysValidFileName = atom(Promise.resolve({ isValid: true, messages: [] } as FieldValidityState));

/**
 * Live list of what the save would refuse to write without. Empty means the minimum is met.
 * Reads the file-name validity and internal-name value atoms directly. The save still checks on its
 * own, so a read that is a moment behind cannot write a bad file.
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

	useEffect(() => {
		if (!atoms || isRepeatMode) {
			setMissing((current) => (current.length === 0 ? current : []));
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
		setMissing((current) => (sameMinimumSaveRequirements(current, next) ? current : next));
	}, [atoms, fileNameLoadable, internalName, isEmbedded, isRepeatMode]);

	return missing;
}
