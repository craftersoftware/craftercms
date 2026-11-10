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

import { useAtomValue, useStore as useJotaiStore } from 'jotai';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { StableFormContextProps } from './formsEngineContext';
import { invalidFieldIdsAtom, watchInvalidFieldIds } from './formUtils';

/** Pause before the alert's count updates. A keystroke must not rewrite the banner on every settled validation. */
export const invalidFieldReadDebounceMs = 300;

const noInvalidFieldIds: string[] = [];

/**
 * Live ids of fields that fail validation, excluding controller-irrelevant fields.
 * The first seeded read applies immediately; later membership changes wait out {@link invalidFieldReadDebounceMs}.
 * A rejected plugin validator leaves the last ids in place.
 */
export function useInvalidFieldIds(entry: StableFormContextProps | null | undefined, parentPath?: string): string[] {
	const jotai = useJotaiStore();
	const idsAtom = useMemo(() => invalidFieldIdsAtom(entry, parentPath), [entry, entry?.atoms, parentPath]);
	const liveIds = useAtomValue(idsAtom);
	const [ids, setIds] = useState<string[]>([]);
	const initial = useRef(true);

	useEffect(() => {
		if (!entry?.atoms) return;
		let cancelled = false;
		initial.current = true;
		const { unsubscribe, ready } = watchInvalidFieldIds(jotai, entry.atoms);
		void ready.then(() => {
			if (cancelled) return;
			setIds(jotai.get(idsAtom));
			initial.current = false;
		});
		return () => {
			cancelled = true;
			unsubscribe();
		};
	}, [entry, entry?.atoms, idsAtom, jotai]);

	useEffect(() => {
		if (initial.current) return;
		const timer = window.setTimeout(() => setIds(liveIds), invalidFieldReadDebounceMs);
		return () => window.clearTimeout(timer);
	}, [liveIds]);

	return entry?.atoms ? ids : noInvalidFieldIds;
}
