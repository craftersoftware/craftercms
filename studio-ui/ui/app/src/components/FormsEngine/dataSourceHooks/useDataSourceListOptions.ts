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

import { useEffect, useMemo, useState } from 'react';
import useUpdateRefs from '../../../hooks/useUpdateRefs';
import type { DataSourceListItem, ResolvedDataSources } from '../dataSources/types';

/** One bound DS’s `list()` results, labeled with the DS title for multi-DS dropdowns. */
export interface DataSourceListOptionGroup {
	id: string;
	label: string;
	items: DataSourceListItem[];
}

interface LoadedOptions {
	/** The configuration these groups belong to; anything else means the options are stale. */
	key: string;
	groups: DataSourceListOptionGroup[];
}

/**
 * Loads options from every `list`-capable data source bound to the field.
 * Returns `undefined` while options are unavailable so controls can render a loading state.
 * Keys the load on record id/type/properties (not instance identity) so re-resolve does not refetch forever.
 */
export function useDataSourceListOptions(dataSources: ResolvedDataSources | undefined) {
	const [loaded, setLoaded] = useState<LoadedOptions>();
	const { instances, status } = dataSources ?? {};
	const listInstances = useMemo(
		() => instances?.filter(({ instance }) => typeof instance.list === 'function') ?? [],
		[instances]
	);
	// A re-resolution yields new instance objects even when the bound data sources are unchanged, so
	// loading is keyed on the configuration rather than on object identity. This keeps one load per
	// configuration instead of refetching (potentially without end) on unrelated re-renders.
	const key = useMemo(
		() => JSON.stringify(listInstances.map(({ record }) => [record.id, record.type, record.properties])),
		[listInstances]
	);
	// The context carries the field value, which changes as the user picks options; reading it through
	// a ref keeps selecting an option from reloading the list.
	const latest = useUpdateRefs({ context: dataSources?.context, listInstances });

	useEffect(() => {
		let active = true;
		const { context, listInstances } = latest.current;
		if (status === 'loading') {
			return () => {
				active = false;
			};
		}
		if (!context) {
			setLoaded({ key, groups: [] });
			return () => {
				active = false;
			};
		}
		Promise.all(
			listInstances.map(async ({ record, instance }) => {
				try {
					return {
						id: record.id,
						label: record.title,
						items: await instance.list(context)
					};
				} catch (error) {
					console.error(`Unable to load options from data source "${record.title}" (${record.id}).`, error);
					return { id: record.id, label: record.title, items: [] };
				}
			})
		).then((groups) => {
			if (active) setLoaded({ key, groups });
		});
		return () => {
			active = false;
		};
	}, [key, latest, status]);

	return loaded?.key === key ? loaded.groups : undefined;
}

export default useDataSourceListOptions;
