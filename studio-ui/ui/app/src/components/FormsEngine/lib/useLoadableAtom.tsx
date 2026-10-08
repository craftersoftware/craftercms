/*
 * Copyright (C) 2007-2025 Crafter Software Corporation. All Rights Reserved.
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
import { useMemo } from 'react';

export type Loadable<Value> =
	{ state: 'loading' } | { state: 'hasData'; data: Awaited<Value> } | { state: 'hasError'; error: unknown };

/**
 * Jotai v3 removed the built-in `loadable` util. This recreates the previous
 * `{ loading | hasData | hasError }` shape using `unwrap`.
 * See https://github.com/pmndrs/jotai/blob/main/docs/guides/migrating-to-v3.mdx#loadable-util
 */
function loadable<Value>(anAtom: Atom<Value>) {
	const LOADING = { state: 'loading' } as const;
	const unwrappedAtom = unwrap(anAtom, () => LOADING);
	return atom((get): Loadable<Value> => {
		try {
			const data = get(unwrappedAtom);
			if (data === LOADING) {
				return LOADING;
			}
			return { state: 'hasData', data: data as Awaited<Value> };
		} catch (error) {
			return { state: 'hasError', error };
		}
	});
}

/**
 * A custom hook that wraps an async atom using a local `loadable` helper and retrieves its value.
 *
 * @template Value - The type of the value stored in the atom.
 * @param {Atom<Value>} atom - The Jotai atom to be wrapped and accessed.
 * @returns {Loadable<Value>} - The loadable state of the atom, which can be in one of the following states:
 * `loading`, `hasData`, or `hasError`.
 *
 */
export function useLoadableAtom<Value>(anAtom: Atom<Value>): Loadable<Value> {
	const loadableAtom = useMemo(() => loadable(anAtom), [anAtom]);
	return useAtomValue(loadableAtom);
}

export default useLoadableAtom;
