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

package org.craftercms.studio.impl.v2.service.publish;

import org.craftercms.commons.rest.parameters.SortField;
import org.craftercms.commons.security.permissions.DefaultPermission;
import org.craftercms.commons.security.permissions.annotations.HasPermission;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v1.exception.security.AuthenticationException;
import org.craftercms.studio.api.v1.exception.security.UserNotFoundException;
import org.craftercms.studio.api.v2.annotation.precondition.RequireSiteExists;
import org.craftercms.studio.api.v2.annotation.precondition.RequireSiteReady;
import org.craftercms.studio.api.v2.annotation.publish.PackageId;
import org.craftercms.studio.api.v2.annotation.publish.RequirePackageExists;
import org.craftercms.studio.api.v2.annotation.resourceids.ContentPathList;
import org.craftercms.studio.api.v2.annotation.resourceids.SiteId;
import org.craftercms.studio.api.v2.dal.publish.PublishItem;
import org.craftercms.studio.api.v2.dal.publish.PublishItemWithMetadata;
import org.craftercms.studio.api.v2.dal.publish.PublishPackage;
import org.craftercms.studio.api.v2.exception.publish.InvalidPackageStateException;
import org.craftercms.studio.api.v2.exception.publish.PublishPackageNotFoundException;
import org.craftercms.studio.api.v2.exception.repository.RepositoryException;
import org.craftercms.studio.api.v2.security.HasAllPermissions;
import org.craftercms.studio.api.v2.security.publish.PeerReviewCapable;
import org.craftercms.studio.api.v2.security.publish.PackageSubmitter;
import org.craftercms.studio.api.v2.service.publish.PublishService;
import org.craftercms.studio.model.publish.PublishingTarget;
import org.craftercms.studio.permissions.CompositePermission;

import java.io.IOException;
import java.time.Instant;
import java.util.Collection;
import java.util.List;

import static org.craftercms.studio.permissions.StudioPermissionsConstants.*;

@RequireSiteReady
public class PublishServiceImpl implements PublishService {

	private PublishService publishServiceInternal;

	@Override
	@RequireSiteExists
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_PUBLISH_GET_QUEUE)
	public long getPublishPackagesCount(@SiteId final String siteId, final String target,
										final Long states, final Collection<PublishPackage.ApprovalState> approvalStates,
										final String submitter, final String reviewer, final Boolean isScheduled) throws SiteNotFoundException {
		return publishServiceInternal.getPublishPackagesCount(siteId, target, states, approvalStates, submitter, reviewer, isScheduled);
	}

	@Override
	@RequireSiteExists
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_PUBLISH_GET_QUEUE)
	public Collection<PublishPackage> getPublishPackages(@SiteId final String siteId,
														 final String target, final Long states,
														 final Collection<PublishPackage.ApprovalState> approvalStates,
														 final String submitter, final String reviewer,
														 final Boolean isScheduled, final Collection<SortField> sort,
														 final int offset, final int limit) throws ServiceLayerException, UserNotFoundException {
		return publishServiceInternal.getPublishPackages(siteId, target, states,
			approvalStates, submitter, reviewer,
			isScheduled, sort, offset, limit);
	}

	@Override
	@RequirePackageExists
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_PUBLISH_GET_QUEUE)
	public Collection<PublishItemWithMetadata> getPublishPackageItems(@SiteId String siteId, @PackageId long packageId,
																	  String path, Collection<String> systemTypes, String internalName,
																	  int offset, int limit) {
		return publishServiceInternal.getPublishPackageItems(siteId, packageId, path,
			systemTypes, internalName, offset, limit);
	}

	@Override
	@RequirePackageExists
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_PUBLISH_GET_QUEUE)
	public int getPublishPackageItemCount(@SiteId String siteId, @PackageId long packageId, String path, List<String> systemType, String internalName)
		throws PublishPackageNotFoundException, SiteNotFoundException {
		return publishServiceInternal.getPublishPackageItemCount(siteId, packageId, path, systemType, internalName);
	}

	@Override
	@RequireSiteReady
	// Notice that here we just validate the user is a member of the site. The actual permission checking will
	// need to be done in the publish service once the package is entirely calculated.
	@HasAllPermissions(type = CompositePermission.class, actions = PERMISSION_CONTENT_READ)
	@PeerReviewCapable
	public long publish(@SiteId String siteId, String publishingTarget, List<PublishRequestPath> paths,
						List<String> commitIds, Instant schedule, String title, String comment, boolean submitAll)
		throws AuthenticationException, ServiceLayerException {
		return publishServiceInternal.publish(siteId, publishingTarget, paths, commitIds, schedule, title, comment, submitAll);
	}

	@Override
	@RequireSiteReady
	// Notice that here we just validate the user is a member of the site. The actual permission checking will
	// need to be done in the publish service once the package is entirely calculated.
	@HasPermission(type = CompositePermission.class, action = PERMISSION_CONTENT_READ)
	public long requestPublish(@SiteId String siteId, String publishingTarget, List<PublishRequestPath> paths,
							   List<String> commitIds, Instant schedule, String title, String comment, boolean submitAll)
		throws AuthenticationException, ServiceLayerException {
		return publishServiceInternal.requestPublish(siteId, publishingTarget, paths, commitIds, schedule, title, comment, submitAll);
	}

	@Override
	@RequireSiteExists
	@HasPermission(type = CompositePermission.class, action = PERMISSION_CONTENT_READ)
	public int getNumberOfPublishes(@SiteId String siteId, int days) {
		return publishServiceInternal.getNumberOfPublishes(siteId, days);
	}

	@Override
	@RequireSiteExists
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_READ)
	public int getNumberOfPublishedItemsByAction(@SiteId String siteId, int days, PublishItem.Action action) {
		return publishServiceInternal.getNumberOfPublishedItemsByAction(siteId, days, action);
	}

	@Override
	@RequireSiteExists
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_READ)
	public CalculatedPublishPackageResult calculatePublishPackage(@SiteId String siteId, String publishingTarget, Collection<PublishRequestPath> paths,
																  Collection<String> commitIds)
		throws ServiceLayerException, IOException {
		return publishServiceInternal.calculatePublishPackage(siteId, publishingTarget, paths, commitIds);
	}

	@Override
	@RequirePackageExists
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_READ)
	public CalculatedPublishPackageResult recalculatePublishPackage(@SiteId String site, @PackageId long packageId, String target)
		throws ServiceLayerException {
		return publishServiceInternal.recalculatePublishPackage(site, packageId, target);
	}

	@Override
	@RequireSiteExists
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_PUBLISH_GET_QUEUE)
	public PublishPackage getReadyPackageForItem(@SiteId final String site, final String path, final boolean includeChildren) {
		return publishServiceInternal.getReadyPackageForItem(site, path, includeChildren);
	}

	@Override
	@RequireSiteExists
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_PUBLISH_GET_QUEUE)
	public Collection<PublishPackage> getActivePackagesForItems(@SiteId final String siteId, final List<String> paths,
																final boolean includeChildren) throws ServiceLayerException {
		return publishServiceInternal.getActivePackagesForItems(siteId, paths, includeChildren);
	}

	@Override
	@RequireSiteExists
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_DELETE)
	public long publishDelete(@SiteId String siteId, Collection<String> userRequestedPaths,
							  Collection<String> dependencies, String title, String comment) throws ServiceLayerException {
		return publishServiceInternal.publishDelete(siteId, userRequestedPaths, dependencies, title, comment);
	}

	@Override
	@RequirePackageExists
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_PUBLISH_GET_QUEUE)
	public PublishPackage getPackage(@SiteId String siteId, @PackageId long packageId)
		throws ServiceLayerException, UserNotFoundException {
		return publishServiceInternal.getPackage(siteId, packageId);
	}

	@Override
	@RequirePackageExists
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_PUBLISH_GET_QUEUE)
	public Collection<PublishItem> getPublishItems(@SiteId String siteId, @PackageId final long packageId,
												   final Integer offset, final Integer limit)
		throws PublishPackageNotFoundException, SiteNotFoundException {
		return publishServiceInternal.getPublishItems(siteId, packageId, offset, limit);
	}

	@Override
	@RequireSiteExists
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_PUBLISH_GET_QUEUE)
	public Collection<PublishItem> getFailedPublishItems(@SiteId final String siteId, @PackageId final long packageId, Integer offset, Integer limit) {
		return publishServiceInternal.getFailedPublishItems(siteId, packageId, offset, limit);
	}

	@Override
	@RequireSiteExists
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_READ)
	public List<PublishingTarget> getAvailablePublishingTargets(@SiteId String siteId) throws SiteNotFoundException {
		return publishServiceInternal.getAvailablePublishingTargets(siteId);
	}

	@Override
	@RequireSiteExists
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_READ)
	public boolean isSitePublished(@SiteId String siteId) throws SiteNotFoundException, RepositoryException {
		return publishServiceInternal.isSitePublished(siteId);
	}

	@Override
	@RequireSiteExists
	@PackageSubmitter
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_READ)
	public void updatePublishPackage(@SiteId String site, @PackageId long packageId, Instant schedule,
			boolean updateSchedule, String submitterComment, String title, boolean requestApproval) throws InvalidPackageStateException, AuthenticationException, SiteNotFoundException {
		publishServiceInternal.updatePublishPackage(site, packageId, schedule, updateSchedule, submitterComment, title, requestApproval);
	}

	@SuppressWarnings("unused")
	public void setPublishServiceInternal(final PublishService publishServiceInternal) {
		this.publishServiceInternal = publishServiceInternal;
	}
}
