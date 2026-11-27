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

package org.craftercms.studio.api.v2.dal.publish;

import org.apache.commons.collections4.ListUtils;
import org.apache.ibatis.annotations.Param;
import org.craftercms.studio.api.v2.utils.DalUtils;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;

import static java.time.Instant.now;
import static java.util.stream.Collectors.groupingBy;
import static java.util.stream.Collectors.toList;

/**
 * Provide access to the item_target data.
 */
public interface ItemTargetDAO {

	String SITE_ID = "siteId";
	String PACKAGE_ID = "packageId";
	String COMMIT_ID = "commitId";
	String TARGET = "target";
	String LIVE_TARGET = "liveTarget";
	String STAGING_TARGET = "stagingTarget";
	String TIMESTAMP = "timestamp";
	String PATHS = "paths";
	String ITEM_FAILURE_STATE = "itemFailureState";

	/**
	 * Update for successful publish items in the package.
	 * For each successful PublishItem:
	 * - Clear the oldPath
	 * - Set the commitId
	 * - Set the lastPublishedOn date to now
	 * - Clear any item_target.previous_path pointing to the published item path
	 *
	 * @param packageId        the package id
	 * @param commitId         the target published commit id
	 * @param target           the target
	 * @param itemSuccessState the state of the successful items to filter
	 */
	@Transactional
	default void updateForCompletePackage(long packageId, String commitId, String target, long itemSuccessState) {
		updateForCompletePackage(packageId, commitId, target, now(), itemSuccessState);
		clearPreviousPathForCompletePackage(packageId, target, itemSuccessState);
	}

	/**
	 * Clear the previous path for the successful items in the package.
	 * This will clear previous_path whenever previous_path points to an item in the package.
	 *
	 * @param packageId        the package id
	 * @param target           the target
	 * @param itemSuccessState the state of the successful items to filter
	 */
	void clearPreviousPathForCompletePackage(@Param(PACKAGE_ID) long packageId,
						 @Param(TARGET) String target,
						 @Param(PublishDAO.ITEM_SUCCESS_STATE) long itemSuccessState);

	/**
	 * Update for successful publish items in the package.
	 *
	 * @param packageId        the package id
	 * @param commitId         the target published commit id
	 * @param target           the target
	 * @param timestamp        the timestamp for the published_on date
	 * @param itemSuccessState the state of the successful items to filter
	 */
	void updateForCompletePackage(@Param(PACKAGE_ID) long packageId,
				      @Param(COMMIT_ID) String commitId,
				      @Param(TARGET) String target,
				      @Param(TIMESTAMP) Instant timestamp,
				      @Param(PublishDAO.ITEM_SUCCESS_STATE) long itemSuccessState);

	/**
	 * Populate the item_target table for the initial publish.
	 *
	 * @param siteId           the site id
	 * @param packageId        the package id
	 * @param itemFailureState the state to match failed items for the target
	 * @param target           the publishing target
	 * @param commitId         the commit id of published repository
	 * @param timestamp        the timestamp for the published_on date
	 */
	void insertForInitialPublish(@Param(SITE_ID) long siteId,
				     @Param(PACKAGE_ID) long packageId,
				     @Param(ITEM_FAILURE_STATE) long itemFailureState,
				     @Param(TARGET) String target,
				     @Param(COMMIT_ID) String commitId,
				     @Param(TIMESTAMP) Instant timestamp);

	/**
	 * Initialize staging target data using the current live target items
	 *
	 * @param siteId        the site id
	 * @param stagingTarget the staging target
	 * @param liveTarget    the live target
	 */
	void initStaging(@Param(SITE_ID) long siteId,
			 @Param(STAGING_TARGET) String stagingTarget,
			 @Param(LIVE_TARGET) String liveTarget);

	/**
	 * Delete item target rows for a publishing target
	 *
	 * @param siteId the numeric site id
	 * @param target the publishing target
	 */
	void deleteForTarget(@Param(SITE_ID) long siteId, @Param(TARGET) String target);

	/**
	 * Check if item target rows exist for a publishing target
	 *
	 * @param siteId the numeric site id
	 * @param target the publishing target
	 * @return true if at least one row exists
	 */
	boolean targetExists(@Param(SITE_ID) long siteId, @Param(TARGET) String target);

	/**
	 * Get the item targets for the given paths, grouped by path
	 *
	 * @param siteId the site id
	 * @param paths  the paths
	 * @return the item targets grouped by path
	 */
	default Map<String, List<ItemTarget>> getItemTargetsByPath(final long siteId, final Collection<String> paths) {
		return ListUtils.partition(List.copyOf(paths), DalUtils.MY_BATIS_QUERY_BATCH_SIZE).stream()
				.map(partition -> getItemListTargets(siteId, partition))
				.flatMap(Collection::stream)
				.collect(groupingBy(ItemTargetWithPath::getPath, toList()));
	}

	/**
	 * Get the item targets for the given paths
	 *
	 * @param siteId the site id
	 * @param paths  the paths
	 * @return the item targets
	 */
	Collection<ItemTargetWithPath> getItemListTargets(@Param(SITE_ID) long siteId, @Param(PATHS) Collection<String> paths);
}
