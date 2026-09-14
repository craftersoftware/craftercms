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

package org.craftercms.studio.api.v2.dal.publish;

import org.apache.commons.collections4.CollectionUtils;
import org.apache.ibatis.annotations.Param;
import org.craftercms.commons.rest.parameters.SortField;
import org.craftercms.studio.api.v2.dal.ItemState;
import org.craftercms.studio.api.v2.dal.Site;
import org.craftercms.studio.api.v2.dal.item.LightItem;
import org.craftercms.studio.api.v2.dal.publish.PublishItem.PublishState;
import org.craftercms.studio.api.v2.dal.publish.PublishPackage.ApprovalState;
import org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageState;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

import static java.util.Collections.emptyMap;
import static java.util.List.copyOf;
import static java.util.function.Function.identity;
import static java.util.stream.Collectors.groupingBy;
import static java.util.stream.Collectors.toMap;
import static org.apache.commons.collections4.CollectionUtils.isEmpty;
import static org.apache.commons.collections4.ListUtils.partition;
import static org.craftercms.studio.api.v2.dal.ItemState.*;
import static org.craftercms.studio.api.v2.dal.QueryParameterNames.*;
import static org.craftercms.studio.api.v2.dal.publish.PublishItem.PublishState.*;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.ApprovalState.APPROVED;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.ApprovalState.SUBMITTED;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageState.COMPLETED;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageState.READY;
import static org.craftercms.studio.api.v2.utils.DalUtils.MY_BATIS_QUERY_BATCH_SIZE;
import static org.craftercms.studio.api.v2.utils.DalUtils.mapSortFields;

/**
 * Provide access to DB publish related tables
 */
public interface PublishDAO {
	String SITE_ID = "siteId";
	String PATH = "path";
	String PATHS = "paths";
	String TARGET = "target";
	String PACKAGE_ID = "packageId";
	String PUBLISH_PACKAGE = "publishPackage";
	String ITEMS = "items";
	String APPROVAL_STATES = "approvalStates";
	String PACKAGE_STATE = "packageState";
	String CANCELLED_STATE = "cancelledState";
	String SITE_STATES = "siteStates";
	String ERROR = "error";
	String ITEM_SUCCESS_STATE = "itemSuccessState";
	String ITEM_FAILURE_STATE = "itemFailureState";
	String ITEM_PUBLISHED_STATE = "publishState";
	String ON_STATES_BIT_MAP = "onStatesBitMap";
	String OFF_STATES_BIT_MAP = "offStatesBitMap";
	String INCLUDE_CHILDREN = "includeChildren";
	String SUBMITTER = "submitter";
	String REVIEWER = "reviewer";

	String PUBLISH_PACKAGE_STATE = "packageState";
	String IS_SCHEDULED_BIT = "isScheduledBit";
	String PUBLISH_PACKAGE_APPROVAL_STATES = "approvalStates";
	String SUCCESS_ON_BIT_MAP = "successOnStatesBitMap";
	String SUCCESS_OFF_BIT_MAP = "successOffStatesBitMap";
	String FAILURE_OFF_BIT_MAP = "failureOffStatesBitMap";

	String OFFSET = "offset";
	String LIMIT = "limit";
	String ACTION = "action";

	Map<String, String> SORT_FIELD_MAP = Map.of(
		"schedule", "schedule",
		"publishedOn", "published_on",
		"reviewedOn", "IFNULL(reviewed_on, submitted_on)");

	List<ApprovalState> ACTIVE_APPROVAL_STATES = List.of(SUBMITTED, APPROVED);

	/**
	 * Convenience transactional method to create a package and its items
	 *
	 * @param publishPackage the package
	 * @param publishItems   the items
	 * @param isLiveTarget   if the target is live
	 */
	@Transactional
	default void insertPackageAndItems(final PublishPackage publishPackage, final Collection<PublishItem> publishItems, boolean isLiveTarget) {
		insertPackage(publishPackage);
		if (!isEmpty(publishItems)) {
			for (List<PublishItem> sublist : partition(copyOf(publishItems), MY_BATIS_QUERY_BATCH_SIZE)) {
				insertItems(publishPackage.getId(), sublist, PENDING.value);
			}

			insertItemPublishItems(publishPackage.getId());
			updateItemStateBitsForNewPackage(publishPackage, isLiveTarget);
		}
	}

	/**
	 * Update the item state bits for all items in a newly created package
	 *
	 * @param publishPackage the package
	 * @param isLiveTarget   if the target is live
	 */
	default void updateItemStateBitsForNewPackage(final PublishPackage publishPackage, boolean isLiveTarget) {
		long onMask = 0;
		long offMask = 0;
		if (publishPackage.getSchedule() != null) {
			onMask |= SCHEDULED.value;
		}
		if (SUBMITTED.equals(publishPackage.getApprovalState())) {
			onMask |= ItemState.IN_WORKFLOW.value;
		}
		if (isLiveTarget) {
			onMask |= ItemState.DESTINATION.value;
		}
		updateItemStateBits(publishPackage.getId(), onMask, offMask);
	}

	/**
	 * Update the item state bits for all items in a package
	 *
	 * @param packageId       the package id
	 * @param onStatesBitMap  the state bits to set to on
	 * @param offStatesBitMap the state bits to set to off
	 */
	void updateItemStateBits(@Param(PACKAGE_ID) long packageId,
							 @Param(ON_STATES_BIT_MAP) long onStatesBitMap,
							 @Param(OFF_STATES_BIT_MAP) long offStatesBitMap);

	/**
	 * Insert item_publish_item records for the publish_item's belonging to the given package.
	 * Notice this will insert a record to item_publish_item table for each non-delete publishItem
	 *
	 * @param packageId the package id
	 */
	void insertItemPublishItems(@Param(PACKAGE_ID) long packageId);

	/**
	 * Insert a new publish package
	 *
	 * @param publishPackage the package to insert
	 */
	void insertPackage(@Param(PUBLISH_PACKAGE) PublishPackage publishPackage);

	/**
	 * Insert the failed initial publish items into the publish_item table
	 *
	 * @param packageId    the package id
	 * @param publishItems the failed items
	 */
	default void insertInitialPublishItems(long packageId,
										   Collection<PublishItem> publishItems) {
		for (PublishItem publishItem : publishItems) {
			insertInitialPublishItem(packageId, publishItem);
		}
	}

	/**
	 * Insert the failed initial publish item into the publish_item table
	 *
	 * @param packageId   the package id
	 * @param publishItem the failed item
	 */
	void insertInitialPublishItem(@Param(PACKAGE_ID) long packageId,
								  @Param(ITEM) PublishItem publishItem);

	/**
	 * Update the site item states after the initial publish
	 *
	 * @param siteId           the site id
	 * @param packageId        the package id
	 * @param itemFailureState the state to match the failed items for the target
	 * @param successOnMask    the states to flip on for successful items
	 * @param successOffMask   the states to flip off for successful items
	 * @param failureOffMask   the states to flip off for failed items
	 */
	void updateItemStatesForInitialPublish(@Param(SITE_ID) long siteId,
										   @Param(PACKAGE_ID) long packageId,
										   @Param(ITEM_FAILURE_STATE) long itemFailureState,
										   @Param(SUCCESS_ON_BIT_MAP) long successOnMask,
										   @Param(SUCCESS_OFF_BIT_MAP) long successOffMask,
										   @Param(FAILURE_OFF_BIT_MAP) long failureOffMask);

	/**
	 * Insert items into a publish package
	 *
	 * @param packageId    the package id
	 * @param publishItems the items to insert
	 * @param publishState the state to set the items to
	 */
	void insertItems(@Param(PACKAGE_ID) long packageId,
					 @Param(ITEMS) Collection<PublishItem> publishItems,
					 @Param(ITEM_PUBLISHED_STATE) long publishState);

	/**
	 * Get the next publish packages to process for every site matching the given states
	 *
	 * @return the next publish packages to process
	 */
	default Map<String, List<PublishPackageId>> getNextPublishPackages() {
		Collection<PublishPackageId> packageIds = getNextPublishPackages(List.of(APPROVED), List.of(Site.State.READY));
		if (CollectionUtils.isEmpty(packageIds)) {
			return emptyMap();
		}
		return packageIds.stream()
			.collect(groupingBy(PublishPackageId::siteId,
				LinkedHashMap::new,
				Collectors.toList()));
	}

	/**
	 * Get the next publish packages to process for every site matching the given states
	 *
	 * @param approvalStates the package approval states to match
	 * @param siteStates     the site states to match
	 * @return the next publish packages to process
	 */
	Collection<PublishPackageId> getNextPublishPackages(@Param(APPROVAL_STATES) List<ApprovalState> approvalStates,
														@Param(SITE_STATES) List<String> siteStates);

	/**
	 * Get a package by id
	 *
	 * @param siteId    the site id
	 * @param packageId the package id
	 * @return the {@link PublishPackage}
	 */
	PublishPackage getById(@Param(SITE_ID) final long siteId, @Param(PACKAGE_ID) final long packageId);

	/**
	 * Get a package by the site id and package id
	 *
	 * @param siteId    the string site id
	 * @param packageId the package id
	 * @return the {@link PublishPackage}
	 */
	PublishPackage getByStringSiteId(@Param(SITE_ID) String siteId, @Param(PACKAGE_ID) long packageId);

	/**
	 * Indicate if a package exists for a site
	 *
	 * @param siteId    the site id
	 * @param packageId the package id
	 * @return true if the package exists, false otherwise
	 */
	boolean packageExists(@Param(SITE_ID) final String siteId, @Param(PACKAGE_ID) final long packageId);

	/**
	 * Update a package
	 */
	void updatePackage(@Param(PUBLISH_PACKAGE) final PublishPackage publishPackage);

	/**
	 * Cancel all active (ready non-rejected) packages for a site and a target
	 *
	 * @param siteId the site id
	 * @param target the target
	 */
	default void cancelOutstandingPackages(final long siteId, final String target) {
		cancelOutstandingPackages(siteId, target, PackageState.CANCELLED.value, READY.value, ACTIVE_APPROVAL_STATES);
	}

	/**
	 * Cancel all active (ready non-rejected) packages for a site
	 *
	 * @param siteId the site id
	 */
	default void cancelAllOutstandingPackages(final long siteId) {
		cancelOutstandingPackages(siteId, null, PackageState.CANCELLED.value, READY.value, ACTIVE_APPROVAL_STATES);
	}


	/**
	 * Cancel all packages matching the approval and processing states.
	 * Set packages' state to cancelledState parameter value
	 *
	 * @param siteId         the site id
	 * @param target         the target to cancel packages for, null for all targets
	 * @param cancelledState the state to set the packages to
	 * @param stateToCancel  the package state to match
	 * @param approvalStates the approval states to filter by (it will match packages having any of the given flags in their approval_state)
	 */
	void cancelOutstandingPackages(@Param(SITE_ID) long siteId,
								   @Param(TARGET) String target,
								   @Param(CANCELLED_STATE) long cancelledState,
								   @Param(PACKAGE_STATE) long stateToCancel,
								   @Param(APPROVAL_STATES) Collection<ApprovalState> approvalStates);

	/**
	 * Update the corresponding items' states for successful publish items in the package.
	 *
	 * @param packageId        the package id
	 * @param successOnMask    states to flip on for successful items
	 * @param successOffMask   states to flip off for successful items
	 * @param failureOffMask   states to flip off for failed items
	 * @param itemSuccessState the state of the successful items to filter
	 */
	@Transactional
	default void updateItemStatesForCompletePackage(final long packageId, final long successOnMask,
													final long successOffMask, final long failureOffMask,
													final long itemSuccessState, final String liveTarget) {
		updateItemStatesForCompletePackageInternal(packageId, successOnMask, successOffMask,
			failureOffMask, itemSuccessState);
		recalculateItemStateBits(packageId, liveTarget);
	}

	/**
	 * Update the corresponding items' states for the items in the package.
	 *
	 * @param packageId        the package id
	 * @param successOnMask    states to flip on for successful items
	 * @param successOffMask   states to flip off for successful items
	 * @param failureOffMask   states to flip off for failed items
	 * @param itemSuccessState the state of the successful items to filter
	 */
	void updateItemStatesForCompletePackageInternal(@Param(PACKAGE_ID) long packageId,
													@Param(SUCCESS_ON_BIT_MAP) long successOnMask,
													@Param(SUCCESS_OFF_BIT_MAP) long successOffMask,
													@Param(FAILURE_OFF_BIT_MAP) long failureOffMask,
													@Param(PublishDAO.ITEM_SUCCESS_STATE) long itemSuccessState);

	/**
	 * Persist changes to a cancelled, approved or rejected publish package.
	 * This will update the package in the db and update the state bits for the items in the package.
	 * Then item state bits will be recalculated for affected publish_items
	 * in the package, considering that the affected items might be part of other submitted packages.
	 *
	 * @param publishPackage the package to cancel
	 * @param liveTarget     the live target for this site
	 */
	@Transactional
	default void reviewPackage(final PublishPackage publishPackage, final String liveTarget) {
		updatePackage(publishPackage);
		updateItemStateBits(publishPackage.getId(), 0, CANCEL_PUBLISH_PACKAGE_OFF_MASK);
		recalculateItemStateBits(publishPackage.getId(), liveTarget);
	}

	/**
	 * Resubmit a package.
	 * This is meant to be used the submitter is editing a package that was already
	 * approved by a reviewer.
	 * It will add the IN_WORKFLOW bit to the package items.
	 *
	 * @param publishPackage the package to resubmit
	 */
	@Transactional
	default void resubmitPackage(final PublishPackage publishPackage) {
		updatePackage(publishPackage);
		updateItemStateBits(publishPackage.getId(), IN_WORKFLOW.value, 0L);
	}

	/**
	 * Recalculate the state bits for the items in the given complete package.
	 * It will update the state bits for the items in the package based on remaining submitted/approved packages
	 * This method is meant to preserve certain bits ( workflow, scheduled, destination) that would otherwise be cleared
	 * by the current complete/cancelled package
	 *
	 * @param packageId  the package id
	 * @param liveTarget the live target for this site
	 */
	default void recalculateItemStateBits(final long packageId, String liveTarget) {
		recalculateItemStateBits(packageId, List.of(SUBMITTED), IN_WORKFLOW.value, READY.value, false, null);
		recalculateItemStateBits(packageId, ACTIVE_APPROVAL_STATES, SCHEDULED.value, READY.value, true, null);
		recalculateItemStateBits(packageId, ACTIVE_APPROVAL_STATES, DESTINATION.value, READY.value, false, liveTarget);
	}

	/**
	 * Apply the onStatesBitMap state bitmap mask to items in the completed package if there is another package
	 * matching the approvalStates and packageState that contains the item.
	 *
	 * @param packageId      package id
	 * @param approvalStates package approval states to filter packages
	 * @param onStatesBitMap workflow state bit value
	 * @param packageState   package state bit value to filter packages
	 * @param isScheduled    indicates if this update is for scheduled bit (true) or in_workflow bit (false)
	 */
	void recalculateItemStateBits(@Param(PACKAGE_ID) long packageId,
								  @Param(PUBLISH_PACKAGE_APPROVAL_STATES) Collection<ApprovalState> approvalStates,
								  @Param(ON_STATES_BIT_MAP) long onStatesBitMap,
								  @Param(PUBLISH_PACKAGE_STATE) long packageState,
								  @Param(IS_SCHEDULED_BIT) boolean isScheduled,
								  @Param(TARGET) String target);

	/**
	 * Get the publish items for the given package
	 *
	 * @param siteId    the site id
	 * @param packageId the package id
	 * @return PublishItem records for the package
	 */
	default Collection<PublishItem> getPublishItems(final String siteId, final long packageId) {
		return getPublishItems(siteId, packageId, null, null);
	}

	/**
	 * Get the publish items for the given package
	 *
	 * @param siteId    the site id
	 * @param packageId the package id
	 * @param offset    the offset to start from
	 * @param limit     the max number of items to return
	 * @return PublishItem records for the package
	 */
	default Collection<PublishItem> getPublishItems(@Param(SITE_ID) String siteId, @Param(PACKAGE_ID) long packageId,
													@Param(OFFSET) Integer offset, @Param(LIMIT) Integer limit) {
		return getPublishItemsInternal(siteId, packageId, null, offset, limit);
	}

	/**
	 * Get the failed publish items for the given package
	 * Failed items are the ones matching either {@link PublishState#LIVE_FAILED} or {@link PublishState#STAGING_FAILED} states
	 *
	 * @param siteId    the site id
	 * @param packageId the package id
	 * @param offset    the offset to start from
	 * @param limit     the max number of items to return
	 * @return failed PublishItem records for the package
	 */
	default Collection<PublishItem> getFailedPublishItems(String siteId, long packageId, Integer offset, Integer limit) {
		return getPublishItemsInternal(siteId, packageId, LIVE_FAILED.value | STAGING_FAILED.value, offset, limit);
	}

	/**
	 * Get the publish items for the given package matching the given state
	 *
	 * @param siteId       the site id
	 * @param packageId    the package id
	 * @param publishState the state to filter by
	 * @param offset       the offset to start from
	 * @param limit        the max number of items to return
	 * @return matching PublishItem records for the package
	 */
	Collection<PublishItem> getPublishItemsInternal(@Param(SITE_ID) String siteId, @Param(PACKAGE_ID) long packageId,
													@Param(STATE) Long publishState,
													@Param(OFFSET) Integer offset, @Param(LIMIT) Integer limit);


	/**
	 * Get the user requested paths for the given package, in a map.
	 * Map keys are true for delete actions, false for other actions.
	 *
	 * @param siteId    the site id
	 * @param packageId the package id
	 * @return the user requested paths by action
	 */
	default Map<Boolean, List<String>> getUserRequestedPathMap(String siteId, long packageId) {
		return getUserRequestedPaths(siteId, packageId).stream()
			.collect(groupingBy(pp -> pp.getAction() == PublishItem.Action.DELETE,
				HashMap::new,
				Collectors.mapping(PathActionPair::getPath, Collectors.toList())));
	}

	/**
	 * Get the {@link PathActionPair} items for the given package user-requested items
	 *
	 * @param siteId    the site id
	 * @param packageId the package id
	 * @return the user requested action-path pairs
	 */
	Collection<PathActionPair> getUserRequestedPaths(@Param(SITE_ID) String siteId, @Param(PACKAGE_ID) long packageId);

	/**
	 * Get the paginated list of publish items (with metadata) for the given package
	 *
	 * @param siteId      the site id
	 * @param packageId   the package id
	 * @param path        the path to filter by
	 * @param systemTypes the system types to filter by
	 * @param label       the label to filter by
	 * @param offset      the offset to start from
	 * @param limit       the max number of items to return
	 * @return PublishItemWithMetadata paginated records for the package
	 */
	Collection<PublishItemWithMetadata> getPublishItemsWithMetadata(@Param(SITE_ID) String siteId, @Param(PACKAGE_ID) long packageId,
																	@Param(PATH) String path, @Param(SYSTEM_TYPES) Collection<String> systemTypes,
																	@Param(LABEL) String label,
																	@Param(OFFSET) Integer offset, @Param(LIMIT) Integer limit);

	/**
	 * Get the number of publish items matching the given filters
	 *
	 * @param siteId      the site id
	 * @param packageId   the package id
	 * @param path        the path to filter by
	 * @param systemTypes the system types to filter by
	 * @param label       the label to filter by
	 */
	int getMatchingPublishItemCount(@Param(SITE_ID) String siteId, @Param(PACKAGE_ID) long packageId,
									@Param(PATH) String path, @Param(SYSTEM_TYPES) Collection<String> systemTypes,
									@Param(LABEL) String label);

	/**
	 * Update the state for all publish items in the package
	 *
	 * @param id              the package id
	 * @param onStatesBitMap  the state bits to set to on
	 * @param offStatesBitMap the state bits to set to off
	 */
	void updatePublishItemsState(@Param(PACKAGE_ID) long id,
								 @Param(ON_STATES_BIT_MAP) long onStatesBitMap,
								 @Param(OFF_STATES_BIT_MAP) long offStatesBitMap);

	/**
	 * Update the state and error (if any) for the given publish items
	 *
	 * @param items the publish items to update state and error columns for
	 */
	default void updatePublishItemListState(List<PublishItem> items) {
		// We partition the list instead of using actual myBatis BATCH feature because
		// this method is called inside a already existing transaction (without BATCH)
		for (Collection<PublishItem> sublist : partition(items, MY_BATIS_QUERY_BATCH_SIZE)) {
			updatePublishItemListStateInternal(sublist);
		}
	}

	/**
	 * Update the state and error (if any) for the given publish items
	 *
	 * @param items the publish items to update state and error columns for
	 */
	void updatePublishItemListStateInternal(@Param(ITEMS) Collection<PublishItem> items);

	/**
	 * Get a submitted package with READY state containing the given item
	 *
	 * @param siteId          the site id
	 * @param path            the path of the item
	 * @param includeChildren whether to include the children of the paths in the search
	 * @return the package containing the item, or null if the item is not submitted to be published
	 */
	default PublishPackage getReadyPackageForItem(final String siteId, final String path, final boolean includeChildren) {
		Collection<PublishPackage> packages = getItemPackages(siteId, null, List.of(path), READY.value, ACTIVE_APPROVAL_STATES, includeChildren);
		return packages.isEmpty() ? null : packages.iterator().next();
	}

	/**
	 * Get the ready packages containing the given item
	 *
	 * @param siteId the site id
	 * @param path   the path of the item
	 * @return collection of ready packages containing the item
	 */
	default Collection<PublishPackage> getReadyPackagesForItem(final String siteId, final String path) {
		return getItemPackages(siteId, null, List.of(path), READY.value, ACTIVE_APPROVAL_STATES, false);
	}

	/**
	 * Get the submitted/approved package containing the given item
	 *
	 * @param siteId       the site id
	 * @param path         the path of the item
	 * @param packageState the mask to apply to filter the package state
	 * @return the package containing the item, or null if the item is not submitted to be published
	 */
	default PublishPackage getPackageForItem(final String siteId,
											 final String path,
											 final long packageState) {
		return getPackageForItems(siteId, List.of(path), packageState, ACTIVE_APPROVAL_STATES);
	}

	/**
	 * Get the submitted package containing the given items
	 * This method takes a list of paths so the filter can be reused in the underlying myBatis query
	 *
	 * @param siteId       the site id
	 * @param paths        the paths of the items
	 * @param packageState the mask to apply to filter the package state
	 * @return the package containing the items, or null if the items are not submitted to be published
	 */
	PublishPackage getPackageForItems(@Param(SITE_ID) String siteId,
									  @Param(PATHS) Collection<String> paths,
									  @Param(PACKAGE_STATE) long packageState,
									  @Param(APPROVAL_STATES) List<ApprovalState> approvalStates);

	/**
	 * Get the packages containing the given item that match the given filters
	 *
	 * @param siteId          the site id
	 * @param paths           the paths of the items
	 * @param packageState    the mask to apply to filter the package state
	 * @param includeChildren whether to include the children of the paths in the search
	 * @return collection of matching packages
	 */
	default Collection<PublishPackage> getItemPackages(final String siteId,
													   final String target,
													   final List<String> paths,
													   final long packageState,
													   final List<ApprovalState> approvalStates,
													   final boolean includeChildren) {
		Map<Long,PublishPackage> packages = new HashMap<>();
		for (List<String> sublist : partition(paths, MY_BATIS_QUERY_BATCH_SIZE)) {
			packages.putAll(getItemPackagesInternal(siteId, target, sublist, packageState, approvalStates, includeChildren).stream()
				.collect(toMap(PublishPackage::getId, identity())));
		}
		return packages.values();
	}


	/**
	 * Get the packages containing the given item that match the given filters
	 *
	 * @param siteId          the site id
	 * @param paths           the paths of the items
	 * @param packageState    the mask to apply to filter the package state
	 * @param includeChildren whether to include the children of the paths in the search
	 * @return collection of matching packages
	 */
	Collection<PublishPackage> getItemPackagesInternal(@Param(SITE_ID) String siteId,
											   @Param(TARGET) String target,
											   @Param(PATHS) Collection<String> paths,
											   @Param(PACKAGE_STATE) Long packageState,
											   @Param(APPROVAL_STATES) Collection<ApprovalState> approvalStates,
											   @Param(INCLUDE_CHILDREN) boolean includeChildren);

	/**
	 * Get the total number of packages matching the given filters
	 *
	 * @param siteId         the site id
	 * @param target         the target
	 * @param packageState   the mask to apply to filter the package state
	 * @param approvalStates the approval states to filter by
	 * @return the total number of packages matching the filters
	 */
	long getPublishPackagesCount(@Param(SITE_ID) String siteId,
								 @Param(TARGET) String target,
								 @Param(PACKAGE_STATE) Long packageState,
								 @Param(APPROVAL_STATES) Collection<ApprovalState> approvalStates,
								 @Param(SUBMITTER) String submitter,
								 @Param(REVIEWER) String reviewer,
								 @Param(IS_SCHEDULED) Boolean isScheduled);

	/**
	 * Get the publish packages matching the given filters
	 *
	 * @param siteId         the site id
	 * @param target         the publishing target
	 * @param packageState   package states
	 * @param approvalStates package approval states
	 * @param submitter      submitter username
	 * @param reviewer       reviewer username
	 * @param sortFields     sort fields
	 * @param offset         offset
	 * @param limit          limit
	 * @return the publish packages matching the filters
	 */
	default Collection<PublishPackage> getPublishPackages(@Param(SITE_ID) String siteId,
														  @Param(TARGET) String target,
														  @Param(PACKAGE_STATE) Long packageState,
														  @Param(APPROVAL_STATES) Collection<ApprovalState> approvalStates,
														  @Param(SUBMITTER) String submitter,
														  @Param(REVIEWER) String reviewer,
														  @Param(IS_SCHEDULED) Boolean isScheduled,
														  @Param(SORT_FIELDS) Collection<SortField> sortFields,
														  @Param(OFFSET) Integer offset,
														  @Param(LIMIT) Integer limit) {
		return getPublishPackagesInternal(siteId, target, packageState,
			approvalStates, submitter, reviewer,
			isScheduled, mapSortFields(sortFields, SORT_FIELD_MAP), offset, limit);
	}

	/**
	 * Internal method so we can map the sort fields to the actual columns for getPublishPackages
	 */
	Collection<PublishPackage> getPublishPackagesInternal(@Param(SITE_ID) String siteId,
														  @Param(TARGET) String target,
														  @Param(PACKAGE_STATE) Long packageState,
														  @Param(APPROVAL_STATES) Collection<ApprovalState> approvalStates,
														  @Param(SUBMITTER) String submitter,
														  @Param(REVIEWER) String reviewer,
														  @Param(IS_SCHEDULED) Boolean isScheduled,
														  @Param(SORT_FIELDS) Collection<SortField> sortFields,
														  @Param(OFFSET) Integer offset,
														  @Param(LIMIT) Integer limit);

	/**
	 * Get the number of publishes for a site in the last n days
	 *
	 * @param siteId the site id
	 * @param days   the number of days to look back
	 * @return the number of publishes
	 */
	int getNumberOfPublishes(@Param(SITE_ID) String siteId, @Param(DAYS) int days);

	/**
	 * Get the number of published items for a site in the last n days
	 *
	 * @param siteId the site id
	 * @param days   the number of days to look back
	 * @param action the action to filter by
	 * @return the number of published items
	 */
	default int getNumberOfPublishedItemsByAction(String siteId, int days, PublishItem.Action action) {
		return getNumberOfPublishedItemsByActionInternal(siteId, days, action, COMPLETED.value);
	}

	/**
	 * Get the number of published items for a site in the last n days
	 *
	 * @param siteId         the site id
	 * @param days           the number of days to look back
	 * @param action         the action to filter by
	 * @param completedState the state to filter by
	 * @return the number of published items
	 */
	int getNumberOfPublishedItemsByActionInternal(@Param(SITE_ID) String siteId,
												  @Param(DAYS) int days,
												  @Param(ACTION) PublishItem.Action action,
												  @Param(COMPLETED_STATE) long completedState);

	/**
	 * Get a list of {@link LightItem} for the given site and paths, containing
	 * the paths metadata to be returned as part of a calculated (or re-calculated) publish package
	 *
	 * @param siteId the site id
	 * @param paths  the paths to get metadata for
	 * @return a list of {@link LightItem} containing the metadata for the given paths
	 */
	default Collection<LightItem> getMetadata(String siteId,
											  Collection<String> paths) {
		return partition(new ArrayList<>(paths), MY_BATIS_QUERY_BATCH_SIZE).stream()
				.map(sublist -> getMetadataInternal(siteId, sublist))
				.flatMap(Collection::stream)
				.toList();
	}

	/**
	 * Get a list of {@link LightItem} for the given site and paths, containing
	 * the paths metadata to be returned as part of a calculated (or re-calculated) publish package
	 *
	 * @param siteId the site id
	 * @param paths  the paths to get metadata for
	 * @return a list of {@link LightItem} containing the metadata for the given paths
	 */
	Collection<LightItem> getMetadataInternal(@Param(SITE_ID) String siteId,
											  @Param(PATHS) Collection<String> paths);
}
