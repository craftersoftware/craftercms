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

import { useEffect, useMemo, useRef, useState } from 'react';
import type { StableFormContextProps } from './formsEngineContext';
import { invalidFieldIdsAtom } from './formUtils';
import useLoadableAtom from './useLoadableAtom';

/** Pause before the alert's count updates. A keystroke must not rewrite the banner on every settled validation. */
export const invalidFieldReadDebounceMs = 300;

const noInvalidFieldIds: string[] = [];

/** Live ids of fields that fail validation, excluding controller-irrelevant fields. */
export function useInvalidFieldIds(entry: StableFormContextProps | null | undefined, parentPath?: string): string[] {
	const idsAtom = useMemo(() => invalidFieldIdsAtom(entry, parentPath), [entry, entry?.atoms, parentPath]);
	const loadable = useLoadableAtom(idsAtom);
	const [ids, setIds] = useState<string[]>([]);
	const appliedInitial = useRef(false);
	const entryKey = entry ?? null;

	useEffect(() => {
		appliedInitial.current = false;
	}, [entryKey, entry?.atoms, parentPath]);

	useEffect(() => {
		if (loadable.state === 'hasError') {
			// A plugin validator can reject. Keep the last ids.
			console.error(loadable.error);
			return;
		}
		if (loadable.state !== 'hasData') return;
		const next = loadable.data;
		if (!appliedInitial.current) {
			appliedInitial.current = true;
			setIds(next);
			return;
		}
		const timer = window.setTimeout(() => setIds(next), invalidFieldReadDebounceMs);
		return () => window.clearTimeout(timer);
	}, [loadable]);

	return entry?.atoms ? ids : noInvalidFieldIds;
}
