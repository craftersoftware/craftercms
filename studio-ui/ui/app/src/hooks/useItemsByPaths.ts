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

import { useMemo } from 'react';
import type { ContentItem } from '../models/Item';
import type LookupTable from '../models/LookupTable';
import useShallowEqualSelector from './useShallowEqualSelector';

/**
 * Subscribes to the stored items of the given paths only. Returns a lookup of path to item (paths that aren't stored
 * map to undefined). The component re-renders when one of those items changes, or when the set of paths changes; items
 * at other paths are invisible to it. Prefer it to `useItemsByPath`, which re-renders on any item change.
 */
export function useItemsByPaths(paths: readonly string[]): LookupTable<ContentItem> {
	// A joined key keeps the selector's inputs stable when the caller builds a new array with the same paths.
	const key = paths.join('\n');
	const unique = useMemo(() => Array.from(new Set(key ? key.split('\n') : [])), [key]);
	return useShallowEqualSelector<LookupTable<ContentItem>>((state) => {
		const result: LookupTable<ContentItem> = {};
		for (const path of unique) result[path] = state.content.itemsByPath[path];
		return result;
	});
}

export default useItemsByPaths;
