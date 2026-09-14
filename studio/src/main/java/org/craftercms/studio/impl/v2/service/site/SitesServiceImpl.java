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

package org.craftercms.studio.impl.v2.service.site;

import org.craftercms.commons.plugin.model.PluginDescriptor;
import org.craftercms.commons.security.permissions.DefaultPermission;
import org.craftercms.commons.security.permissions.annotations.HasPermission;
import org.craftercms.commons.security.permissions.annotations.ProtectedResourceId;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.SiteAlreadyExistsException;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v1.exception.repository.InvalidRemoteRepositoryCredentialsException;
import org.craftercms.studio.api.v1.exception.repository.InvalidRemoteRepositoryException;
import org.craftercms.studio.api.v1.exception.repository.RemoteRepositoryNotFoundException;
import org.craftercms.studio.api.v2.annotation.precondition.RequireSiteBootstrapComplete;
import org.craftercms.studio.api.v2.annotation.precondition.RequireSiteExists;
import org.craftercms.studio.api.v2.annotation.precondition.RequireSiteReady;
import org.craftercms.studio.api.v2.annotation.precondition.RequireSiteState;
import org.craftercms.studio.api.v2.annotation.resourceids.SiteId;
import org.craftercms.studio.api.v2.dal.PublishStatus;
import org.craftercms.studio.api.v2.dal.Site;
import org.craftercms.studio.api.v2.exception.InvalidParametersException;
import org.craftercms.studio.api.v2.exception.InvalidSiteStateException;
import org.craftercms.studio.api.v2.exception.repository.RepositoryException;
import org.craftercms.studio.api.v2.security.HasAllPermissions;
import org.craftercms.studio.api.v2.service.site.SitesService;
import org.craftercms.studio.api.v2.task.TaskProgress;
import org.craftercms.studio.model.rest.sites.CreateSiteRequest;
import org.craftercms.studio.model.site.AllSitesMonitors;
import org.craftercms.studio.model.site.SiteDetails;
import org.craftercms.studio.model.site.SiteMonitor;
import org.craftercms.studio.model.task.PublishTask;

import java.beans.ConstructorProperties;
import java.util.Collection;
import java.util.List;

import static org.apache.commons.lang3.StringUtils.defaultIfBlank;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.*;

public class SitesServiceImpl implements SitesService {

	private final SitesService sitesServiceInternal;

	@ConstructorProperties({"sitesServiceInternal"})
	public SitesServiceImpl(final SitesService sitesServiceInternal) {
		this.sitesServiceInternal = sitesServiceInternal;
	}

	@Override
	public List<PluginDescriptor> getAvailableBlueprints() throws ServiceLayerException {
		return sitesServiceInternal.getAvailableBlueprints();
	}

	@Override
	public PluginDescriptor getBlueprintDescriptor(final String id) throws ServiceLayerException {
		return sitesServiceInternal.getBlueprintDescriptor(id);
	}

	@Override
	public String getBlueprintLocation(String blueprintId) throws ServiceLayerException {
		return sitesServiceInternal.getBlueprintLocation(blueprintId);
	}

	@Override
	@RequireSiteReady
	@RequireSiteBootstrapComplete
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_EDIT_SITE)
	public void updateSite(@SiteId String siteId, String name, String description)
			throws SiteNotFoundException, SiteAlreadyExistsException, InvalidParametersException {

		String normalizedName = defaultIfBlank(name, null);
		String normalizedDescription = defaultIfBlank(description, null);

		if (normalizedDescription == null && normalizedName == null) {
			throw new InvalidParametersException("The request needs to include a name or a description");
		}
		sitesServiceInternal.updateSite(siteId, normalizedName, normalizedDescription);
	}

	@Override
	@RequireSiteState(value = Site.State.LOCKED)
	@RequireSiteBootstrapComplete
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_EDIT_SITE)
	public void unlockSite(@SiteId String siteId) throws SiteNotFoundException, InvalidSiteStateException {
		sitesServiceInternal.unlockSite(siteId);
	}

	@Override
	@RequireSiteExists
	@RequireSiteBootstrapComplete
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_DELETE_SITE)
	public void deleteSite(@SiteId String siteId) throws ServiceLayerException {
		sitesServiceInternal.deleteSite(siteId);
	}

	@Override
	public boolean exists(@SiteId String siteId) {
		return sitesServiceInternal.exists(siteId);
	}

	@Override
	@RequireSiteReady
	@RequireSiteBootstrapComplete
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_PUBLISH_STATUS)
	public PublishStatus getPublishingStatus(@SiteId String siteId) throws SiteNotFoundException, RepositoryException {
		return sitesServiceInternal.getPublishingStatus(siteId);
	}

	@Override
	@RequireSiteReady
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_PUBLISH_GET_QUEUE)
	public TaskProgress<PublishTask.PublishTaskId, Long> getPublishingTaskProgress(@SiteId String siteId, long packageId) throws SiteNotFoundException {
		return sitesServiceInternal.getPublishingTaskProgress(siteId, packageId);
	}

	@Override
	@RequireSiteBootstrapComplete
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_START_STOP_PUBLISHER)
	public void enablePublishing(@SiteId String siteId, boolean enabled) {
		sitesServiceInternal.enablePublishing(siteId, enabled);
	}

	@Override
	public void checkSiteState(final String siteId, final String state) throws InvalidSiteStateException, SiteNotFoundException {
		sitesServiceInternal.checkSiteState(siteId, state);
	}

	@Override
	@RequireSiteExists
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_READ)
	public Site getSite(@SiteId String siteId) throws SiteNotFoundException {
		if (exists(siteId)) {
			return sitesServiceInternal.getSite(siteId);
		}
		throw new SiteNotFoundException(siteId);
	}

	@Override
	@RequireSiteReady
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_READ)
	public SiteDetails getSiteDetails(@SiteId String siteId) throws ServiceLayerException {
		return sitesServiceInternal.getSiteDetails(siteId);
	}

	@Override
	public void updateLastCommitId(String siteId, String commitId) {
		sitesServiceInternal.updateLastCommitId(siteId, commitId);
	}

	@Override
	public String getLastCommitId(String siteId) {
		return sitesServiceInternal.getLastCommitId(siteId);
	}

	@Override
	public boolean checkSiteUuid(String siteId, String siteUuid) {
		return sitesServiceInternal.checkSiteUuid(siteId, siteUuid);
	}

	@Override
	@RequireSiteReady
	@RequireSiteBootstrapComplete
	@HasAllPermissions(type = DefaultPermission.class, actions = {PERMISSION_DUPLICATE_SITE, PERMISSION_CONTENT_READ,
			PERMISSION_READ_CONFIGURATION, PERMISSION_CONTENT_SEARCH})
	public void duplicate(@SiteId String sourceSiteId, String siteId, String siteName, String description, String sandboxBranch, boolean readOnlyBlobStores)
			throws ServiceLayerException {
		if (exists(siteId)) {
			throw new SiteAlreadyExistsException(siteId);
		}
		sitesServiceInternal.duplicate(sourceSiteId, siteId, siteName, description, sandboxBranch, readOnlyBlobStores);
	}

	@Override
	public List<Site> getSitesByState(final String state) {
		return sitesServiceInternal.getSitesByState(state);
	}

	@Override
	public List<Site> getAllSites() {
		return sitesServiceInternal.getAllSites();
	}

	@Override
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_PUBLISH_STATUS)
	public void updatePublishingStatus(String siteId, String status) {
		sitesServiceInternal.updatePublishingStatus(siteId, status);
	}

	@Override
	public void garbageCollectRepositories() throws RepositoryException {
		sitesServiceInternal.garbageCollectRepositories();
	}

	@Override
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CREATE_SITE)
	public void createSite(CreateSiteRequest request) throws ServiceLayerException, InvalidRemoteRepositoryCredentialsException, RemoteRepositoryNotFoundException, InvalidRemoteRepositoryException {
		sitesServiceInternal.createSite(request);
	}

	@RequireSiteReady
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_READ)
	public Collection<SiteMonitor> monitorSite(@SiteId String siteId) throws ServiceLayerException {
		return sitesServiceInternal.monitorSite(siteId);
	}

	@Override
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_READ)
	public AllSitesMonitors monitorAllSites() {
		return sitesServiceInternal.monitorAllSites();
	}
}
