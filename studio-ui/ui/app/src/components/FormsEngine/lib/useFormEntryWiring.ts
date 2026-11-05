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

import { type MutableRefObject, useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
import { useDispatch, useStore } from 'react-redux';
import useSelection from '../../../hooks/useSelection';
import useUpdateRefs from '../../../hooks/useUpdateRefs';
import type GlobalState from '../../../models/GlobalState';
import { createDataSourceServices, type CreateDataSourceServicesOptions } from '../dataSources/services';
import type { StableFormContextProps } from './formsEngineContext';

/**
 * The form's item gate. Returns whether the item stored under `itemKey` exists, and takes the form out of `ready` when
 * it stops existing (e.g. a saved rename moved the form to a path whose item isn't in the store yet) so the prep effect
 * runs again. It subscribes to existence only, so an item update doesn't re-render the caller.
 *
 * Create and repeat forms don't need a stored item: they are never taken out of `ready`, and callers don't gate on it.
 */
export function useFormItemGate({
	itemKey,
	create,
	repeat,
	setReady
}: {
	itemKey: string | null;
	create: boolean;
	repeat: boolean;
	setReady(ready: boolean): void;
}): boolean {
	const hasLiveItem = useSelection((state) => Boolean(itemKey && state.content.itemsByPath[itemKey]));
	useEffect(() => {
		if (!create && !repeat && !hasLiveItem) setReady(false);
	}, [hasLiveItem, create, repeat, setReady]);
	return hasLiveItem;
}

/**
 * Publishes what fields read from the form's stable entry without subscribing to anything that changes with the item:
 *
 * - `getItem()` reads the live item straight from the Redux store using the current key, so it is fresh immediately after
 *   a dispatch (no render in between) and follows a rename or move. Its identity never changes.
 * - `dataSourceServices` is created once per form (and again only if the dispatcher, site or forms API change), so
 *   fields share one object instead of each building their own.
 *
 * Published from a layout effect, not during render, so a render React discards can't leave an uncommitted closure on the
 * shared entry. Children don't read either before it runs: `getItem` is for callbacks and passive effects, and the
 * form's controls mount only after the entry is prepared, which is after the first commit. The only exception is
 * remounting a form whose entry already has them from the previous mount, which keeps working.
 */
export function useFormEntryProvisioning(
	entryRef: MutableRefObject<StableFormContextProps>,
	{
		itemKey,
		siteId,
		formsApi
	}: { itemKey: string | null; siteId: string; formsApi: CreateDataSourceServicesOptions['formsApi'] }
): void {
	const dispatch = useDispatch();
	const reduxStore = useStore<GlobalState>();
	const keyRef = useUpdateRefs(itemKey);
	const getItem = useCallback(
		() => reduxStore.getState().content.itemsByPath[keyRef.current] ?? null,
		[reduxStore, keyRef]
	);
	const dataSourceServices = useMemo(
		() => createDataSourceServices({ dispatch, siteId, formsApi }),
		[dispatch, siteId, formsApi]
	);
	useLayoutEffect(() => {
		entryRef.current.getItem = getItem;
		entryRef.current.dataSourceServices = dataSourceServices;
	}, [entryRef, getItem, dataSourceServices]);
}
