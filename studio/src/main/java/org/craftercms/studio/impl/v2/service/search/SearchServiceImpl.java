/*
 * Copyright (C) 2007-2024 Crafter Software Corporation. All Rights Reserved.
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

package org.craftercms.studio.impl.v2.service.search;

import org.craftercms.commons.security.permissions.DefaultPermission;
import org.craftercms.commons.security.permissions.annotations.HasPermission;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v2.annotation.precondition.RequireSiteReady;
import org.craftercms.studio.api.v2.annotation.resourceids.SiteId;
import org.craftercms.studio.api.v2.service.search.SearchService;
import org.craftercms.studio.model.search.SearchParams;
import org.craftercms.studio.model.search.SearchResult;

import java.beans.ConstructorProperties;

import static org.craftercms.studio.permissions.StudioPermissionsConstants.PERMISSION_CONTENT_SEARCH;

/**
 * Default implementation for {@link SearchService}
 *
 * @author joseross
 */
public class SearchServiceImpl implements SearchService {

	/**
	 * The internal search service
	 */
	protected final SearchService searchServiceInternal;

	@ConstructorProperties({"searchServiceInternal"})
	public SearchServiceImpl(final SearchService searchServiceInternal) {
		this.searchServiceInternal = searchServiceInternal;
	}

	/**
	 * {@inheritDoc}
	 */
	@Override
	@RequireSiteReady
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_SEARCH)
	public SearchResult search(@SiteId final String siteId, final SearchParams params, int maxExpansions)
		throws ServiceLayerException {
		return searchServiceInternal.search(siteId, params, maxExpansions);
	}

	@Override
	@RequireSiteReady
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_SEARCH)
	public SearchResult search(@SiteId final String siteId, final SearchParams params)
		throws ServiceLayerException {
		return searchServiceInternal.search(siteId, params, DEFAULT_MAX_EXPANSIONS);
	}

}
