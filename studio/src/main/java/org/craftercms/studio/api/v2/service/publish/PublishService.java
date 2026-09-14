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

package org.craftercms.studio.api.v2.service.publish;

import org.craftercms.commons.rest.parameters.SortField;
import org.craftercms.commons.validation.annotations.param.ValidExistingContentPath;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v1.exception.security.AuthenticationException;
import org.craftercms.studio.api.v1.exception.security.UserNotFoundException;
import org.craftercms.studio.api.v2.dal.publish.PublishItem;
import org.craftercms.studio.api.v2.dal.publish.PublishItem.PublishState;
import org.craftercms.studio.api.v2.dal.publish.PublishItemWithMetadata;
import org.craftercms.studio.api.v2.dal.publish.PublishPackage;
import org.craftercms.studio.api.v2.dal.publish.PublishPackage.ApprovalState;
import org.craftercms.studio.api.v2.exception.publish.InvalidPackageStateException;
import org.craftercms.studio.api.v2.exception.publish.PublishPackageNotFoundException;
import org.craftercms.studio.api.v2.exception.repository.RepositoryException;
import org.craftercms.studio.api.v2.exception.security.PeerReviewCheckException;
import org.craftercms.studio.impl.v2.publish.Publisher;
import org.craftercms.studio.api.v2.dal.item.LightItem;
import org.craftercms.studio.model.publish.PublishingTarget;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonUnwrapped;

import java.io.IOException;
import java.time.Instant;
import java.util.Collection;
import java.util.List;

/**
 * Service for publishing submissions
 * This service is responsible for creating publish packages,
 * calculating dependencies and retrieving information packages and the publishing queue.
 * For the actual publishing queue processing, see {@link Publisher}
 */
public interface PublishService {

	int PACKAGE_TITLE_MAX_LENGTH = 200;
	int PACKAGE_COMMENT_MAX_LENGTH = 500;

	/**
	 * Get total number of publish packages for given search parameters
	 *
	 * @param siteId         site identifier
	 * @param target         publishing target
	 * @param states         publish package states bits
	 * @param approvalStates approval states to filter packages
	 * @param submitter      submitter username
	 * @param reviewer       reviewer username
	 * @param isScheduled    if the package is scheduled
	 * @return total number of publish packages
	 * @throws SiteNotFoundException site not found
	 */
	long getPublishPackagesCount(String siteId, String target, Long states,
								 final Collection<ApprovalState> approvalStates, String submitter,
								 String reviewer, Boolean isScheduled)
		throws SiteNotFoundException;

	/**
	 * Get publish packages for given search parameters
	 *
	 * @param siteId         site identifier
	 * @param target         publishing target
	 * @param states         publish package state bits
	 * @param approvalStates approval states to filter packages
	 * @param submitter      submitter username
	 * @param reviewer       reviewer username
	 * @param isScheduled    if the package is scheduled
	 * @param sort           sort fields
	 * @param offset         offset for pagination
	 * @param limit          limit for pagination
	 * @return list of publish packages
	 * @throws SiteNotFoundException site not found
	 */
	Collection<PublishPackage> getPublishPackages(String siteId, String target, Long states,
												  Collection<ApprovalState> approvalStates,
												  String submitter, String reviewer,
												  Boolean isScheduled, Collection<SortField> sort,
												  int offset, int limit) throws ServiceLayerException, UserNotFoundException;

	/**
	 * Get publish package items
	 *
	 * @param siteId       site identifier
	 * @param packageId    package identifier
	 * @param path         regex to filter package items by
	 * @param systemTypes  system types to filter package items by
	 * @param internalName internal name to filter package items by
	 * @param offset       offset for pagination
	 * @param limit        limit for pagination
	 * @return publish package item list
	 */
	Collection<PublishItemWithMetadata> getPublishPackageItems(String siteId, long packageId,
															   String path, Collection<String> systemTypes, String internalName,
															   int offset, int limit);

	/**
	 * Get publish package number of items matching the given filters
	 *
	 * @param siteId       site identifier
	 * @param packageId    package identifier
	 * @param path         regex to filter package items by
	 * @param systemType   system type to filter package items by
	 * @param internalName internal name to filter package items by
	 * @return publish package item list
	 */
	int getPublishPackageItemCount(String siteId, long packageId, String path, List<String> systemType, String internalName)
		throws SiteNotFoundException, PublishPackageNotFoundException;

	/**
	 * Get available publishing targets for given site
	 *
	 * @param siteId site identifier
	 * @return list of available publishing targets
	 * @throws SiteNotFoundException Site doesn't exist
	 */
	List<PublishingTarget> getAvailablePublishingTargets(String siteId) throws SiteNotFoundException;

	/**
	 * Check if site has ever been published.
	 *
	 * @param siteId site identifier
	 * @return true if site has been published at least once, otherwise false
	 * @throws SiteNotFoundException Site doesn't exist
	 */
	boolean isSitePublished(String siteId) throws SiteNotFoundException, RepositoryException;

	/**
	 * Create a 'APPROVED' publish package. The created package will be ready to be published.
	 *
	 * @param siteId           the id of the site
	 * @param publishingTarget the publishing target
	 * @param paths            the paths to publish
	 * @param commitIds        the commit ids to publish
	 * @param schedule         the scheduled date for the publishing (null to publish immediately)
	 * @param title            the title for the publish package
	 * @param comment          the comment for the publishing
	 * @param publishAll       if this is a publish-all request
	 * @return the id of the created package
	 */
	long publish(String siteId, String publishingTarget, List<PublishRequestPath> paths,
				 List<String> commitIds, Instant schedule, String title, String comment, boolean publishAll)
		throws ServiceLayerException, AuthenticationException;

	/**
	 * Create a 'SUBMITTED' publish package. The created package will require approval.
	 *
	 * @param siteId           the id of the site
	 * @param publishingTarget the publishing target
	 * @param paths            the paths to publish
	 * @param commitIds        the commit ids to publish
	 * @param schedule         the scheduled date for the publishing (null to publish immediately)
	 * @param title            the title for the publish package
	 * @param comment          the comment for the publish package
	 * @param publishAll       if this is a publish-all request
	 * @return the id of the created package
	 */
	long requestPublish(String siteId, String publishingTarget, List<PublishRequestPath> paths,
						List<String> commitIds, Instant schedule, String title, String comment, boolean publishAll)
		throws AuthenticationException, ServiceLayerException;

	/**
	 * Get the number of publishes for the given site in the last days
	 *
	 * @param siteId the site id
	 * @param days   the number of days to look back
	 * @return the number of publishes
	 */
	int getNumberOfPublishes(String siteId, int days);

	/**
	 * Calculate a publish package given a list of paths and commit ids
	 *
	 * @param siteId           site identifier
	 * @param publishingTarget the publishing target
	 * @param paths            paths to calculate the package for
	 * @param commitIds        commit ids to calculate the package for
	 * @return a package containing:
	 * <ul>
	 *     <li>items: the items to publish</li>
	 *     <li>deletedItems: the deleted paths found in the requested commits</li>
	 *     <li>hardDependencies: the hard dependencies of the items</li>
	 *     <li>softDependencies: the soft dependencies of the items</li>
	 *     </ul>
	 * @throws ServiceLayerException if there is an error calculating the package
	 * @throws IOException           if there is an error reading the repository
	 */
	CalculatedPublishPackageResult calculatePublishPackage(String siteId, String publishingTarget,
														   Collection<PublishRequestPath> paths, Collection<String> commitIds)
		throws ServiceLayerException, IOException;

	/**
	 * Recalculate a publish package
	 * This will retrieve the user-requested items of a previously submitted package and
	 * recalculate the dependencies.
	 *
	 * @param site      site id
	 * @param packageId package id
	 * @param target    the publishing target
	 * @return the recalculated package
	 * @throws SiteNotFoundException           if the site is not found
	 * @throws PublishPackageNotFoundException if the package is not found
	 */
	CalculatedPublishPackageResult recalculatePublishPackage(String site, long packageId, String target)
		throws ServiceLayerException;

	/**
	 * Get the submitted package containing the given item
	 *
	 * @param siteId          the site id
	 * @param path            the path of the item
	 * @param includeChildren whether to include the children of the paths in the search
	 * @return the package containing the item, or null if the item is not submitted to be published
	 */
	PublishPackage getReadyPackageForItem(String siteId, String path, boolean includeChildren);

	/**
	 * Get the READY or PROCESSING publish packages containing the given items
	 *
	 * @param siteId          the site id
	 * @param paths           the paths of the items
	 * @param includeChildren whether to include the children of the paths in the search
	 * @return the READY or PROCESSING packages containing the items
	 */
	Collection<PublishPackage> getActivePackagesForItems(String siteId, List<String> paths, boolean includeChildren) throws ServiceLayerException;

	/**
	 * Publish the deletion of the given paths.
	 *
	 * @param siteId             the site id
	 * @param userRequestedPaths the paths to delete as requested by the user
	 * @param dependencies       the delete dependencies of the requested paths
	 * @param title              the title of the publish package
	 * @param comment            user user comment
	 */
	long publishDelete(String siteId, Collection<String> userRequestedPaths, Collection<String> dependencies, String title, String comment) throws ServiceLayerException;

	/**
	 * Get a publish package by site and package id
	 *
	 * @param siteId    the site id
	 * @param packageId the package id
	 * @return the publish package
	 * @throws PublishPackageNotFoundException if the package is not found
	 * @throws SiteNotFoundException           if the site is not found
	 */
	PublishPackage getPackage(String siteId, long packageId) throws ServiceLayerException, UserNotFoundException;

	/**
	 * Get the publish items for a package
	 *
	 * @param siteId    the site id
	 * @param packageId the package id
	 * @param offset    the offset to start from
	 * @param limit     the max number of items to return (null to return all items)
	 * @return the publish items
	 */
	Collection<PublishItem> getPublishItems(String siteId, long packageId, Integer offset, Integer limit) throws PublishPackageNotFoundException, SiteNotFoundException;

	/**
	 * Get the failed publish items for a package
	 * Failed items are the ones matching either {@link PublishState#LIVE_FAILED} or {@link PublishState#STAGING_FAILED} states
	 *
	 * @param siteId    the site id
	 * @param packageId the package id
	 * @param offset    the offset to start from
	 * @param limit     the max number of items to return (null to return all items)
	 * @return the failed publish items
	 */
	Collection<PublishItem> getFailedPublishItems(String siteId, long packageId, Integer offset, Integer limit);

	/**
	 * Get the total number of published items in the last <code>days</code>number of days matching the action
	 *
	 * @param siteId the site id
	 * @param days   the number of days to look back
	 * @param action the action to filter publish items by
	 * @return the number of published items matching the filters
	 */
	int getNumberOfPublishedItemsByAction(String siteId, int days, PublishItem.Action action);

	/**
	 * Update a publish package.
	 * Notice this method is meant to be used by the submitter of the package.
	 * For already approved packages, use the requestApproval parameter to resubmit the package for approval.
	 * If requestApproval is false and the package is approved, the user needs to have permissions to
	 * approve all the items in the package. Notice this path will fail if peer review is enabled
	 * for the site (since the current user is required to be the submitter of the package)
	 *
	 * @param siteId             the site id
	 * @param packageId        the package id
	 * @param schedule         publish schedule date
	 * @param updateSchedule   if true, the schedule will be updated
	 * @param submitterComment publish package submitter comment
	 * @param title            publish package title
	 * @param requestApproval  if true, the approval state of the package will be
	 *                         set to SUBMITTED
	 * @throws InvalidPackageStateException if the package is not in READY state
	 * @throws AuthenticationException if the current user cannot be resolved
	 * @throws SiteNotFoundException if the site is not found
	 * @throws PeerReviewCheckException if the following conditions are true:
	 * - The site has peer review enabled
	 * - The current user is the submitter of the package
	 * - The package is approved
	 * - requestApproval is false
	 */
	void updatePublishPackage(String siteId, long packageId, Instant schedule,
			boolean updateSchedule, String submitterComment, String title, boolean requestApproval)
			throws InvalidPackageStateException, AuthenticationException, SiteNotFoundException;

	/**
	 * A request to include a path in a publish request.
	 *
	 * @param path            the path to include
	 * @param includeChildren whether to include the children of the path
	 * @param includeSoftDeps whether to include the soft dependencies of the path (and children's soft-deps when including children)
	 */
	record PublishRequestPath(@ValidExistingContentPath String path, boolean includeChildren, boolean includeSoftDeps) {
	}

	/**
	 * Result of a get-dependencies request
	 *
	 * @param items            the items to publish. Includes paths selected by the user.
	 *                         i.e.: each path with children (if requested) and their soft dependencies (if requested).
	 *                         paths extracted from commit ids
	 * @param deletedItems     the deleted paths found in the requested commits
	 * @param hardDependencies the hard dependencies of the items
	 * @param softDependencies the soft dependencies of the items
	 */
	record CalculatedPublishPackageResult(Collection<PublishDependency> items, Collection<String> deletedItems,
										  Collection<PublishDependency> hardDependencies,
										  Collection<PublishDependency> softDependencies) {
	}

	/**
	 * LightItem wrapper with flags to indicate if the current user can approve or request publish for the item
	 */
	public static class PublishDependency {
		@JsonUnwrapped
		private final LightItem item;
		@JsonProperty
		private final boolean canApprove;
		@JsonProperty
		private final boolean canRequestPublish;

		public PublishDependency(LightItem item, boolean canApprove, boolean canRequestPublish) {
			this.item = item;
			this.canApprove = canApprove;
			this.canRequestPublish = canRequestPublish;
		}

		public LightItem getItem() {
			return item;
		}

		public boolean canApprove() {
			return canApprove;
		}

		public boolean canRequestPublish() {
			return canRequestPublish;
		}
	}
}
