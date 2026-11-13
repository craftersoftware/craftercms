/*
 * Copyright (C) 2007-2022 Crafter Software Corporation. All Rights Reserved.
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

import LookupTable from '../models/LookupTable';
import ContentType from '../models/ContentType';
import { useDispatch } from 'react-redux';
import { useActiveSiteId } from './useActiveSiteId';
import { useSelection } from './useSelection';
import { useEffect, useMemo } from 'react';
import { fetchContentTypes } from '../state/actions/preview';
import { useSiteUIConfig } from './useSiteUIConfig';
import { addConfiguredAdditionalFields } from '../utils/contentType';

export function useContentTypes(): LookupTable<ContentType> {
	const dispatch = useDispatch();
	const site = useActiveSiteId();
	const { byId, isFetching } = useSelection((state) => state.contentTypes);
	const uiConfig = useSiteUIConfig();
	useEffect(() => {
		if (!byId && site && isFetching === null) {
			dispatch(fetchContentTypes());
		}
	}, [dispatch, site, byId, isFetching]);

	// Return `byId` immediately so Preview is not held on UI config; merge once controls load.
	return useMemo(
		() => (uiConfig.isFetching === false ? addConfiguredAdditionalFields(byId, uiConfig.controls) : byId),
		[byId, uiConfig.isFetching, uiConfig.controls]
	);
}

export default useContentTypes;
