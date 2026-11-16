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

import { useEffect, useState } from 'react';
import type { Observable } from 'rxjs';
import { useStore as useJotaiStore } from 'jotai';
import type { FieldUpdate, FormsEngineAtoms } from './formsEngineContext';
import { settleInvalidFieldRead } from './formVisibility';
import {
	readMissingMinimumSaveRequirements,
	sameMinimumSaveRequirements,
	type MinimumSaveRequirement
} from './minimumSaveRequirements';
import { watchInvalidFieldUpdates } from './useInvalidFieldIds';

/**
 * Live list of what the save would refuse to write without. Empty means the minimum is met.
 * The first read is immediate; later edits wait out the same pause as the invalid-field read.
 * The save still checks on its own, so a read that is a moment behind cannot write a bad file.
 */
export function useMinimumSaveRequirements(
	atoms: FormsEngineAtoms | null | undefined,
	flags: { isRepeatMode: boolean; isEmbedded: boolean },
	fieldUpdates$: Observable<FieldUpdate> | null | undefined
): MinimumSaveRequirement[] {
	const jotai = useJotaiStore();
	const [missing, setMissing] = useState<MinimumSaveRequirement[]>([]);
	const { isRepeatMode, isEmbedded } = flags;
	useEffect(() => {
		let disposed = false;
		let latest = 0;
		const read = async () => {
			const seq = ++latest;
			try {
				const next = await readMissingMinimumSaveRequirements(jotai, atoms, { isRepeatMode, isEmbedded });
				if (settleInvalidFieldRead({ disposed, seq, latest, rejected: false }) !== 'apply') return;
				setMissing((current) => (sameMinimumSaveRequirements(current, next) ? current : next));
			} catch (error) {
				// A plugin validator can reject. Keep the last result; the save guard still applies.
				if (settleInvalidFieldRead({ disposed, seq, latest, rejected: true }) !== 'report') return;
				console.error(error);
			}
		};
		void read();
		const subscription = watchInvalidFieldUpdates(fieldUpdates$, () => void read());
		return () => {
			disposed = true;
			subscription?.unsubscribe();
		};
	}, [atoms, fieldUpdates$, isEmbedded, isRepeatMode, jotai]);
	return missing;
}
