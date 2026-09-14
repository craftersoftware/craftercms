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

package org.craftercms.studio.impl.v2.service.dashboard;

import org.craftercms.commons.rest.parameters.SortField;
import org.craftercms.commons.security.permissions.DefaultPermission;
import org.craftercms.commons.security.permissions.annotations.HasPermission;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v1.exception.security.AuthenticationException;
import org.craftercms.studio.api.v1.exception.security.UserNotFoundException;
import org.craftercms.studio.api.v2.annotation.precondition.RequireSiteExists;
import org.craftercms.studio.api.v2.annotation.precondition.RequireSiteReady;
import org.craftercms.studio.api.v2.annotation.resourceids.SiteId;
import org.craftercms.studio.api.v2.dal.item.ContentItem;
import org.craftercms.studio.api.v2.service.audit.ActivityStreamService;
import org.craftercms.studio.api.v2.service.content.ContentService;
import org.craftercms.studio.api.v2.service.dashboard.DashboardService;
import org.craftercms.studio.api.v2.service.item.ItemService;
import org.craftercms.studio.api.v2.service.publish.PublishService;
import org.craftercms.studio.api.v2.service.search.SearchService;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import org.craftercms.studio.impl.v2.utils.DateUtils;
import org.craftercms.studio.model.rest.dashboard.Activity;
import org.craftercms.studio.model.rest.dashboard.ExpiringContentItem;
import org.craftercms.studio.model.rest.dashboard.ExpiringContentResult;
import org.craftercms.studio.model.rest.dashboard.PublishingStats;
import org.craftercms.studio.model.search.SearchParams;
import org.craftercms.studio.model.search.SearchResult;

import java.beans.ConstructorProperties;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;

import static java.util.Collections.emptyList;
import static org.craftercms.studio.api.v2.dal.ItemState.UNPUBLISHED_MASK;
import static org.craftercms.studio.api.v2.dal.publish.PublishItem.Action.ADD;
import static org.craftercms.studio.api.v2.dal.publish.PublishItem.Action.UPDATE;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.*;
import static org.craftercms.studio.impl.v2.utils.DateUtils.ISO_FORMATTER;
import static org.craftercms.studio.impl.v2.utils.DateUtils.parseDateIso;
import static org.craftercms.studio.impl.v2.utils.security.SecurityUtils.getCurrentUsername;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.PERMISSION_CONTENT_READ;
import static org.opensearch.client.opensearch._types.SortOrder.Asc;
import static org.opensearch.client.opensearch._types.SortOrder.Desc;

@RequireSiteReady
public class DashboardServiceImpl implements DashboardService {

	private final ActivityStreamService activityStreamServiceInternal;
	private final PublishService publishServiceInternal;
	private final ContentService contentService;
	private final ItemService itemServiceInternal;
	private final SearchService searchService;
	private final StudioConfiguration studioConfiguration;

	private static final String ALL_CONTENT_REGEX = ".*";
	private static final String DATE_FROM_REGEX = "\\{dateFrom\\}";
	private static final String DATE_TO_REGEX = "\\{dateTo\\}";

	@ConstructorProperties({"activityStreamService", "publishServiceInternal", "contentService",
		"itemService", "searchService", "studioConfiguration"})
	public DashboardServiceImpl(final ActivityStreamService activityStreamServiceInternal, final PublishService publishServiceInternal,
								final ContentService contentService,
								final ItemService itemServiceInternal,
								final SearchService searchService, final StudioConfiguration studioConfiguration) {
		this.activityStreamServiceInternal = activityStreamServiceInternal;
		this.publishServiceInternal = publishServiceInternal;
		this.contentService = contentService;
		this.itemServiceInternal = itemServiceInternal;
		this.searchService = searchService;
		this.studioConfiguration = studioConfiguration;
	}

	@Override
	@RequireSiteExists
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_READ)
	public int getActivitiesForUsersTotal(@SiteId String siteId, List<String> usernames, List<String> actions,
					      ZonedDateTime dateFrom, ZonedDateTime dateTo) throws SiteNotFoundException {
		return activityStreamServiceInternal.getActivitiesForUsersTotal(siteId, usernames, actions, dateFrom, dateTo);
	}

	@Override
	@RequireSiteExists
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_READ)
	public List<Activity> getActivitiesForUsers(@SiteId String siteId, List<String> usernames, List<String> actions,
						    ZonedDateTime dateFrom, ZonedDateTime dateTo, int offset, int limit) throws SiteNotFoundException {
		return activityStreamServiceInternal
			.getActivitiesForUsers(siteId, usernames, actions, dateFrom, dateTo, offset, limit);
	}

	@Override
	@RequireSiteExists
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_READ)
	public int getMyActivitiesTotal(@SiteId String siteId, List<String> actions,
					ZonedDateTime dateFrom, ZonedDateTime dateTo) throws SiteNotFoundException {
		var username = getCurrentUsername();
		return activityStreamServiceInternal
			.getActivitiesForUsersTotal(siteId, List.of(username), actions, dateFrom, dateTo);
	}

	@Override
	@RequireSiteExists
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_READ)
	public List<Activity> getMyActivities(@SiteId String siteId, List<String> actions, ZonedDateTime dateFrom,
					      ZonedDateTime dateTo, int offset, int limit) throws SiteNotFoundException {
		var username = getCurrentUsername();
		return activityStreamServiceInternal
			.getActivitiesForUsers(siteId, List.of(username), actions, dateFrom, dateTo, offset, limit);
	}

	@Override
	@RequireSiteExists
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_READ)
	public int getContentUnpublishedCount(@SiteId String siteId, List<String> systemTypes) throws SiteNotFoundException {
		return itemServiceInternal.getItemByStatesTotal(siteId, ALL_CONTENT_REGEX, UNPUBLISHED_MASK, systemTypes);
	}

	@Override
	@RequireSiteExists
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_READ)
	public List<ContentItem> getContentUnpublished(@SiteId String siteId,
												   List<String> systemTypes, List<SortField> sortFields, int offset, int limit)
		throws UserNotFoundException, ServiceLayerException {
		List<ContentItem> items =
			contentService.getContentItemsByStates(siteId, UNPUBLISHED_MASK, systemTypes, sortFields, offset, limit);
		if (items.isEmpty()) {
			return emptyList();
		}
		return items;
	}

	protected void prepareSearchParams(SearchParams searchParams, String query, String order, int offset, int limit) {
		searchParams.setQuery(query);
		searchParams.setAdditionalFields(List.of(getExpireFieldName()));
		searchParams.setSortBy(getExpireFieldName());
		searchParams.setSortOrder(order);
		searchParams.setOffset(offset);
		searchParams.setLimit(limit);
	}

	@Override
	@RequireSiteExists
	public ExpiringContentResult getContentExpiring(@SiteId String siteId,
							ZonedDateTime dateFrom, ZonedDateTime dateTo,
							int offset, int limit)
		throws AuthenticationException, ServiceLayerException, UserNotFoundException {
		SearchParams searchParams = new SearchParams();
		String query = getContentExpiringQuery()
			.replaceAll(DATE_FROM_REGEX, DateUtils.formatDate(dateFrom, ISO_FORMATTER))
			.replaceAll(DATE_TO_REGEX, DateUtils.formatDate(dateTo, ISO_FORMATTER));
		prepareSearchParams(searchParams, query, Asc.jsonValue(), offset, limit);
		SearchResult result = searchService.search(siteId, searchParams);
		return processResults(siteId, result);
	}

	@Override
	@RequireSiteExists
	public ExpiringContentResult getContentExpired(@SiteId String siteId, int offset, int limit)
		throws AuthenticationException, ServiceLayerException, UserNotFoundException {
		SearchParams searchParams = new SearchParams();
		String query = getContentExpiredQuery();
		prepareSearchParams(searchParams, query, Desc.jsonValue(), offset, limit);
		SearchResult result = searchService.search(siteId, searchParams);
		return processResults(siteId, result);
	}

	protected ExpiringContentResult processResults(String siteId, SearchResult results) throws ServiceLayerException, UserNotFoundException {
		List<ExpiringContentItem> items = new ArrayList<>();
		for (var item : results.getItems()) {
			ContentItem sandboxItem =
				contentService.getContentItemsByPath(siteId, List.of(item.getPath()), false)
					.stream()
					.findFirst().orElse(null);
			ExpiringContentItem contentItem = new ExpiringContentItem(
				item.getName(),
				item.getPath(),
				parseDateIso((String) item.getAdditionalFields().get(getExpireFieldName())),
				sandboxItem
			);
			items.add(contentItem);
		}
		return new ExpiringContentResult(items, results.getTotal());
	}

	@Override
	@RequireSiteExists
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_READ)
	public PublishingStats getPublishingStats(@SiteId String siteId, int days) throws SiteNotFoundException {
		var publishingStats = new PublishingStats();
		publishingStats.setNumberOfPublishes(publishServiceInternal.getNumberOfPublishes(siteId, days));
		publishingStats.setNumberOfNewAndPublishedItems(
			publishServiceInternal.getNumberOfPublishedItemsByAction(siteId, days, ADD));
		publishingStats.setNumberOfEditedAndPublishedItems(
			publishServiceInternal.getNumberOfPublishedItemsByAction(siteId, days, UPDATE));
		return publishingStats;
	}

	private String getContentExpiringQuery() {
		return studioConfiguration.getProperty(CONFIGURATION_DASHBOARD_CONTENT_EXPIRING_QUERY);
	}

	private String getContentExpiredQuery() {
		return studioConfiguration.getProperty(CONFIGURATION_DASHBOARD_CONTENT_EXPIRED_QUERY);
	}

	private String getExpireFieldName() {
		return studioConfiguration.getProperty(CONFIGURATION_DASHBOARD_CONTENT_EXPIRED_SORT_BY);
	}
}
