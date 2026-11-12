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

package org.craftercms.studio.impl.v2.service.audit.internal;

import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.security.UserNotFoundException;
import org.craftercms.studio.api.v2.dal.*;
import org.craftercms.studio.api.v2.dal.publish.PublishPackage;
import org.craftercms.studio.api.v2.security.publish.PublishPackageAvailableActionResolver;
import org.craftercms.studio.api.v2.service.audit.ActivityStreamService;
import org.craftercms.studio.model.rest.dashboard.Activity;

import java.time.ZonedDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Internal implementation of {@link ActivityStreamService}
 */
public class ActivityStreamServiceInternalImpl implements ActivityStreamService {

	private SiteDAO siteDao;
	private RetryingDatabaseOperationFacade retryingDatabaseOperationFacade;
	private ActivityStreamDAO activityStreamDAO;
	private PublishPackageAvailableActionResolver publishPackageAvailableActionResolver;

	@Override
	public void insertActivity(long siteId, long userId, String action, ZonedDateTime actionTimestamp, Item item,
							   String packageId) {
		retryingDatabaseOperationFacade.retry(() -> activityStreamDAO.insertActivity(siteId, userId, action, actionTimestamp, item,
				packageId));
	}

	@Override
	public int getActivitiesForUsersTotal(String siteId, List<String> usernames, List<String> actions,
										  ZonedDateTime dateForm, ZonedDateTime dateTo) {
		return activityStreamDAO.getActivitiesForUsersTotal(getSiteId(siteId), usernames, actions, dateForm, dateTo);
	}

	@Override
	public List<Activity> getActivitiesForUsers(String siteId, List<String> usernames, List<String> actions,
			ZonedDateTime dateForm, ZonedDateTime dateTo, int offset, int limit)
			throws ServiceLayerException, UserNotFoundException {
		List<Activity> activities = activityStreamDAO
				.getActivitiesForUsers(getSiteId(siteId), usernames, actions, dateForm, dateTo, offset, limit);
		Map<Long, Long> actionsPerPackage = new HashMap<>();
		for (Activity activity : activities) {
			PublishPackage publishPackage = activity.getPublishPackage();
			if (publishPackage != null) {
				publishPackage.setAvailableActions(getAvailableActions(actionsPerPackage, publishPackage));
			}
		}
		return activities;
	}

	/**
	 * Get the available actions for the given publish package, caching the result per package id
	 */
	private long getAvailableActions(Map<Long, Long> actionsPerPackage, PublishPackage publishPackage)
			throws ServiceLayerException, UserNotFoundException {
		long packageId = publishPackage.getId();
		if (!actionsPerPackage.containsKey(packageId)) {
			long availableActions = publishPackageAvailableActionResolver.getPublishPackageAvailableActions(publishPackage);
			actionsPerPackage.put(packageId, availableActions);
			return availableActions;
		}
		return actionsPerPackage.get(packageId);
	}

	private long getSiteId(String siteId) {
		Site site = siteDao.getSite(siteId);
		return site.getId();
	}

	@SuppressWarnings("unused")
	public void setSiteDao(SiteDAO siteDao) {
		this.siteDao = siteDao;
	}

	public void setRetryingDatabaseOperationFacade(RetryingDatabaseOperationFacade retryingDatabaseOperationFacade) {
		this.retryingDatabaseOperationFacade = retryingDatabaseOperationFacade;
	}

	@SuppressWarnings("unused")
	public void setActivityStreamDAO(ActivityStreamDAO activityStreamDAO) {
		this.activityStreamDAO = activityStreamDAO;
	}

	@SuppressWarnings("unused")
	public void setPublishPackageAvailableActionResolver(PublishPackageAvailableActionResolver publishPackageAvailableActionResolver) {
		this.publishPackageAvailableActionResolver = publishPackageAvailableActionResolver;
	}
}
