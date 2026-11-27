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

package org.craftercms.studio.api.v2.service.workflow;

import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v1.exception.security.AuthenticationException;
import org.craftercms.studio.api.v2.dal.item.ContentItem;

import java.time.Instant;
import java.util.Collection;
import java.util.List;

/**
 * Provides workflow related services
 */
public interface WorkflowService {

	/**
	 * Get total number of item states records for given filters by path regex and states mask
	 *
	 * @param siteId site identifier
	 * @param path   path regex to filter items
	 * @param states states mask to filter items by state
	 * @return number of records
	 */
	int getItemStatesTotal(String siteId, String path, Long states) throws SiteNotFoundException;

	/**
	 * Get the total number of item states for the whole site.
	 * No path filter is applied. Permission is checked for the site, not for a content path.
	 *
	 * @param siteId site identifier
	 * @param states states mask to filter items by state
	 * @return number of records
	 */
	int getItemStatesTotal(String siteId, Long states) throws SiteNotFoundException;

	/**
	 * Get items matching the given filters by path regex and states mask
	 *
	 * @param siteId site identifier
	 * @param path   path regex to filter items
	 * @param states states mask to filter items by state
	 * @param offset offset for the first record in result set
	 * @param limit  number of item states records to return
	 * @return list of sandbox items
	 */
	List<ContentItem> getItemsByStates(String siteId, String path, Long states, int offset, int limit) throws SiteNotFoundException;

	/**
	 * Get item states for the whole site.
	 * No path filter is applied. Permission is checked for the site, not for a content path.
	 *
	 * @param siteId site identifier
	 * @param states states mask to filter items by state
	 * @param offset offset for the first record in result set
	 * @param limit  number of item states records to return
	 * @return list of sandbox items
	 */
	List<ContentItem> getItemsByStates(String siteId, Long states, int offset, int limit) throws SiteNotFoundException;

	/**
	 * Update item state flags for given items
	 *
	 * @param siteId                site identifier
	 * @param paths                 item paths
	 * @param clearSystemProcessing if true clear system processing flag, otherwise ignore
	 * @param clearUserLocked       if true clear user locked flag, otherwise ignore
	 * @param live                  if true set live flag, otherwise reset it
	 * @param staged                if true set staged flag, otherwise reset it
	 * @param isNew                 value to set the 'new' flag to, or null if the flag should not change
	 * @param modified              value to set the 'modified' flag to, or null if the flag should not change
	 */
	void updateItemStates(String siteId, List<String> paths, boolean clearSystemProcessing, boolean clearUserLocked,
			      Boolean live, Boolean staged, Boolean isNew, Boolean modified) throws SiteNotFoundException;

	/**
	 * Update item state flags for given path query
	 *
	 * @param siteId                site identifier
	 * @param path                  path regex to identify items
	 * @param clearSystemProcessing if true clear system processing flag, otherwise ignore
	 * @param clearUserLocked       if true clear user locked flag, otherwise ignore
	 * @param live                  if true set live flag, otherwise reset it
	 * @param staged                if true set staged flag, otherwise reset it
	 * @param isNew                 value to set the 'new' flag to, or null if the flag should not change
	 * @param modified              value to set the 'modified' flag to, or null if the flag should not change
	 */
	void updateItemStatesByQuery(String siteId, String path, Long states, boolean clearSystemProcessing,
				     boolean clearUserLocked, Boolean live, Boolean staged, Boolean isNew, Boolean modified) throws SiteNotFoundException;

	/**
	 * Approve request for publish
	 *
	 * @param siteId         site identifier
	 * @param packageIds      package identifiers
	 * @param schedule       schedule when to publish content
	 * @param updateSchedule true to update package schedule using the schedule parameter, false to keep the current schedule
	 * @param comment        approval comment
	 */
	void approvePackages(String siteId, Collection<Long> packageIds, Instant schedule, boolean updateSchedule, String comment)
		throws ServiceLayerException, AuthenticationException;

	/**
	 * Cancel publish packages
	 *
	 * @param siteId     site identifier
	 * @param packageIds the package identifiers
	 * @param comment    the user comment
	 * @throws SiteNotFoundException site not found
	 */
	void cancelPackages(String siteId, Collection<Long> packageIds, String comment)
		throws ServiceLayerException, AuthenticationException;

	/**
	 * Reject publish package
	 *
	 * @param siteId    site identifier
	 * @param packageIds the packages to reject
	 * @param comment   rejection comment
	 * @throws SiteNotFoundException site not found
	 */
	void rejectPackages(String siteId, Collection<Long> packageIds, String comment)
		throws ServiceLayerException, AuthenticationException;
}
