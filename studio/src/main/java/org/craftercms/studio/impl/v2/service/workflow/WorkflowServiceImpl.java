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

package org.craftercms.studio.impl.v2.service.workflow;

import org.craftercms.commons.security.permissions.DefaultPermission;
import org.craftercms.commons.security.permissions.annotations.HasPermission;
import org.craftercms.commons.security.permissions.annotations.ProtectedResourceId;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v1.exception.security.AuthenticationException;
import org.craftercms.studio.api.v2.annotation.precondition.RequireSiteExists;
import org.craftercms.studio.api.v2.annotation.precondition.RequireSiteReady;
import org.craftercms.studio.api.v2.annotation.publish.PackageIds;
import org.craftercms.studio.api.v2.annotation.resourceids.ContentPathList;
import org.craftercms.studio.api.v2.annotation.resourceids.SiteId;
import org.craftercms.studio.api.v2.dal.item.ContentItem;
import org.craftercms.studio.api.v2.security.publish.PeerReviewCapable;
import org.craftercms.studio.api.v2.service.workflow.WorkflowService;
import org.craftercms.studio.permissions.CompositePermission;

import java.time.Instant;
import java.util.Collection;
import java.util.List;

import static org.craftercms.studio.permissions.StudioPermissionsConstants.*;

@RequireSiteReady
public class WorkflowServiceImpl implements WorkflowService {

	private final WorkflowService workflowServiceInternal;

	public WorkflowServiceImpl(final WorkflowService workflowServiceInternal) {
		this.workflowServiceInternal = workflowServiceInternal;
	}

	@Override
	@RequireSiteExists
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_READ)
	public int getItemStatesTotal(@SiteId String siteId,
				      @ProtectedResourceId(PATH_RESOURCE_ID) String path, Long states) throws SiteNotFoundException {
		return workflowServiceInternal.getItemStatesTotal(siteId, path, states);
	}

	@Override
	@RequireSiteExists
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_READ)
	public List<ContentItem> getItemsByStates(@SiteId String siteId,
											  @ProtectedResourceId(PATH_RESOURCE_ID) String path, Long states,
											  int offset, int limit) throws SiteNotFoundException {
		return workflowServiceInternal.getItemsByStates(siteId, path, states, offset, limit);
	}

	@Override
	@RequireSiteExists
	@HasPermission(type = CompositePermission.class, action = PERMISSION_SET_ITEM_STATES)
	public void updateItemStates(@SiteId String siteId,
				     @ContentPathList List<String> paths, boolean clearSystemProcessing,
				     boolean clearUserLocked, Boolean live, Boolean staged, Boolean isNew, Boolean modified) throws SiteNotFoundException {
		workflowServiceInternal.updateItemStates(siteId, paths, clearSystemProcessing, clearUserLocked, live, staged, isNew, modified);
	}

	@Override
	@RequireSiteExists
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_SET_ITEM_STATES)
	public void updateItemStatesByQuery(@SiteId String siteId, @ProtectedResourceId(PATH_RESOURCE_ID) String path,
					    Long states, boolean clearSystemProcessing,
					    boolean clearUserLocked, Boolean live, Boolean staged, Boolean isNew, Boolean modified) throws SiteNotFoundException {
		workflowServiceInternal.updateItemStatesByQuery(siteId, path, states, clearSystemProcessing, clearUserLocked,
			live, staged, isNew, modified);
	}

	@Override
	@RequireSiteExists
	// Notice that here we just validate the user is a member of the site. The actual permission checking will
	// be done in the internal service by checking all the items in the packages.
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_READ)
	@PeerReviewCapable
	public void approvePackages(@SiteId String siteId, @PackageIds Collection<Long> packageIds, Instant schedule, boolean updateSchedule, String comment)
		throws AuthenticationException, ServiceLayerException {
		workflowServiceInternal.approvePackages(siteId, packageIds, schedule, updateSchedule, comment);
	}

	@Override
	@RequireSiteExists
	// Notice that here we just validate the user is a member of the site. The actual permission checking will
	// be done in the internal service by checking all the items in the packages.
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_READ)
	public void rejectPackages(@SiteId String siteId, Collection<Long> packageIds, String comment) throws ServiceLayerException, AuthenticationException {
		workflowServiceInternal.rejectPackages(siteId, packageIds, comment);
	}

	@Override
	@RequireSiteExists
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_PUBLISH_CANCEL)
	public void cancelPackages(@SiteId String siteId, Collection<Long> packageIds, String comment) throws ServiceLayerException, AuthenticationException {
		workflowServiceInternal.cancelPackages(siteId, packageIds, comment);
	}
}
