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

package org.craftercms.studio.api.v2.service.dashboard;


import org.craftercms.commons.rest.parameters.SortField;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v1.exception.security.AuthenticationException;
import org.craftercms.studio.api.v1.exception.security.UserNotFoundException;
import org.craftercms.studio.api.v2.dal.item.ContentItem;
import org.craftercms.studio.model.rest.dashboard.Activity;
import org.craftercms.studio.model.rest.dashboard.ExpiringContentResult;
import org.craftercms.studio.model.rest.dashboard.PublishingStats;

import java.time.ZonedDateTime;
import java.util.List;

/**
 * Service that process requests for Dashboard API
 */
public interface DashboardService {

	/**
	 * Get total number of result for activities of given users
	 *
	 * @param siteId    site identifier
	 * @param usernames list of usernames
	 * @param actions   list of actions to filter
	 * @param dateFrom  lower boundary to filter by date-time range
	 * @param dateTo    upper boundary to filter by date-time range
	 * @return number of results
	 */
	int getActivitiesForUsersTotal(String siteId, List<String> usernames, List<String> actions, ZonedDateTime dateFrom,
				       ZonedDateTime dateTo) throws SiteNotFoundException;

	/**
	 * Get activities for users
	 *
	 * @param siteId    site identifier
	 * @param usernames list of usernames (or prefixes)
	 * @param actions   list of actions to filter
	 * @param dateFrom  lower boundary to filter by date-time range
	 * @param dateTo    upper boundary to filter by date-time range
	 * @param offset    offset of the first result item
	 * @param limit     number of results to return
	 * @return the list of activities
	 */
	List<Activity> getActivitiesForUsers(String siteId, List<String> usernames, List<String> actions,
					     ZonedDateTime dateFrom, ZonedDateTime dateTo, int offset, int limit)
			throws ServiceLayerException, UserNotFoundException;

	/**
	 * Get total number of result for my activities
	 *
	 * @param siteId   site identifier
	 * @param actions  list of actions to filter
	 * @param dateFrom lower boundary to filter by date-time range
	 * @param dateTo   upper boundary to filter by date-time range
	 * @return number of results
	 */
	int getMyActivitiesTotal(String siteId, List<String> actions, ZonedDateTime dateFrom, ZonedDateTime dateTo) throws SiteNotFoundException;

	/**
	 * Get my activities
	 *
	 * @param siteId   site identifier
	 * @param actions  list of actions to filter
	 * @param dateFrom lower boundary to filter by date-time range
	 * @param dateTo   upper boundary to filter by date-time range
	 * @param offset   offset of the first result item
	 * @param limit    number of results to return
	 * @return the list of activities
	 */
	List<Activity> getMyActivities(String siteId, List<String> actions, ZonedDateTime dateFrom, ZonedDateTime dateTo,
				       int offset, int limit) throws ServiceLayerException, UserNotFoundException;

	/**
	 * Get total number of unpublished content
	 *
	 * @param siteId      site identifier
	 * @param systemTypes list of system types to filter
	 * @return number of results to return
	 */
	int getContentUnpublishedCount(String siteId, List<String> systemTypes) throws SiteNotFoundException;

	/**
	 * Get unpublished content items
	 *
	 * @param siteId      site identifier
	 * @param systemTypes list of system types to filter
	 * @param sortFields  list of sort fields
	 * @param offset      offset of the first result item
	 * @param limit       number of results to return
	 * @return list of unpublished content items
	 */
	List<ContentItem> getContentUnpublished(String siteId, List<String> systemTypes, List<SortField> sortFields, int offset, int limit)
		throws UserNotFoundException, ServiceLayerException;

	/**
	 * Get content that is expiring
	 *
	 * @param siteId   site identifier
	 * @param dateFrom lower boundary to filter by date-time range
	 * @param dateTo   upper boundary to filter by date-time range
	 * @param offset   offset of the first result item
	 * @param limit    number of results to return
	 * @return list of content items that is expiring
	 */
	ExpiringContentResult getContentExpiring(String siteId, ZonedDateTime dateFrom, ZonedDateTime dateTo, int offset,
						 int limit) throws AuthenticationException, ServiceLayerException, UserNotFoundException;

	/**
	 * Get content that expired
	 *
	 * @param siteId site identifier
	 * @param offset offset of the first result item
	 * @param limit  number of results to return
	 * @return list of content items that expired
	 */
	ExpiringContentResult getContentExpired(String siteId, int offset, int limit)
		throws AuthenticationException, ServiceLayerException, UserNotFoundException;

	/**
	 * Get publishing stats for site for given time period
	 *
	 * @param siteId site identifier
	 * @param days   number of days
	 * @return publishing stats
	 */
	PublishingStats getPublishingStats(String siteId, int days) throws SiteNotFoundException;
}
