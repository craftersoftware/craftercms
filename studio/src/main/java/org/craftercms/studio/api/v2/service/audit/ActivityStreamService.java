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

package org.craftercms.studio.api.v2.service.audit;

import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.security.UserNotFoundException;
import org.craftercms.studio.api.v2.dal.Item;
import org.craftercms.studio.model.rest.dashboard.Activity;

import java.time.ZonedDateTime;
import java.util.List;

/**
 * Provide access to activity stream.
 */
public interface ActivityStreamService {

	/**
	 * Insert record into activity stream
	 *
	 * @param siteId          site identifier
	 * @param userId          user identifier
	 * @param action          action that was performed
	 * @param actionTimestamp timestamp when action was performed
	 * @param item            item that was actioned upon
	 * @param packageId       package identifier that was actioned upon
	 */
	void insertActivity(long siteId, long userId, String action, ZonedDateTime actionTimestamp, Item item,
			    String packageId);

	/**
	 * Get total number activities for users
	 *
	 * @param siteId    site identifier
	 * @param usernames list of usernames
	 * @param actions   list of actions to filter
	 * @param dateForm  lower boundary for filtering by date range
	 * @param dateTo    upper boundary for filtering by date range
	 * @return total number of activities for given users
	 */
	int getActivitiesForUsersTotal(String siteId, List<String> usernames, List<String> actions, ZonedDateTime dateForm,
				       ZonedDateTime dateTo);

	/**
	 * Get activities for users
	 *
	 * @param siteId    site identifier
	 * @param usernames list of usernames (or prefixes)
	 * @param actions   list of actions to filter
	 * @param dateForm  lower boundary for filtering by date range
	 * @param dateTo    upper boundary for filtering by date range
	 * @param offset    offset of the first record in the result
	 * @param limit     limit the number of the results to return
	 * @return list of activities for given users
	 */
	List<Activity> getActivitiesForUsers(String siteId, List<String> usernames, List<String> actions,
					     ZonedDateTime dateForm, ZonedDateTime dateTo, int offset, int limit)
			throws ServiceLayerException, UserNotFoundException;
}
