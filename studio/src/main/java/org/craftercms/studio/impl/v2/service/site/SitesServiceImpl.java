/*
 * Copyright (C) 2007-2022 Crafter Software Corporation. All Rights Reserved.
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
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.SiteAlreadyExistsException;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v2.annotation.*;
import org.craftercms.studio.api.v2.dal.PublishStatus;
import org.craftercms.studio.api.v2.dal.Site;
import org.craftercms.studio.api.v2.exception.InvalidParametersException;
import org.craftercms.studio.api.v2.exception.InvalidSiteStateException;
import org.craftercms.studio.api.v2.repository.ContentRepository;
import org.craftercms.studio.api.v2.security.HasAllPermissions;
import org.craftercms.studio.api.v2.service.publish.internal.PublishingProgressObserver;
import org.craftercms.studio.api.v2.service.publish.internal.PublishingProgressServiceInternal;
import org.craftercms.studio.api.v2.service.site.SitesService;

import java.beans.ConstructorProperties;
import java.util.List;
import java.util.Objects;

import static org.apache.commons.lang3.StringUtils.isBlank;
import static org.craftercms.studio.api.v1.dal.SiteFeed.STATE_LOCKED;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.*;

public class SitesServiceImpl implements SitesService {

    private final SitesService sitesServiceInternal;
    private final PublishingProgressServiceInternal publishingProgressServiceInternal;
    private final ContentRepository contentRepository;

    @ConstructorProperties({"sitesServiceInternal", "publishingProgressServiceInternal", "contentRepository"})
    public SitesServiceImpl(final SitesService sitesServiceInternal, final PublishingProgressServiceInternal publishingProgressServiceInternal,
                            final ContentRepository contentRepository) {
        this.sitesServiceInternal = sitesServiceInternal;
        this.publishingProgressServiceInternal = publishingProgressServiceInternal;
        this.contentRepository = contentRepository;
    }

    @Override
    public List<PluginDescriptor> getAvailableBlueprints() {
        return sitesServiceInternal.getAvailableBlueprints();
    }

    @Override
    public PluginDescriptor getBlueprintDescriptor(final String id) {
        return sitesServiceInternal.getBlueprintDescriptor(id);
    }

    @Override
    public String getBlueprintLocation(String blueprintId) {
        return sitesServiceInternal.getBlueprintLocation(blueprintId);
    }

    @Override
    public PluginDescriptor getSiteBlueprintDescriptor(final String id) {
        return sitesServiceInternal.getSiteBlueprintDescriptor(id);
    }

    @Override
    @RequireSiteReady
    @RequireSiteBootstrapComplete
    @HasPermission(type = DefaultPermission.class, action = PERMISSION_EDIT_SITE)
    public void updateSite(@SiteId String siteId, String name, String description)
            throws SiteNotFoundException, SiteAlreadyExistsException, InvalidParametersException {
        if (isBlank(name) && isBlank(description)) {
            throw new InvalidParametersException("The request needs to include a name or a description");
        }
        sitesServiceInternal.updateSite(siteId, name, description);
    }

    @Override
    @RequireSiteState(value = STATE_LOCKED)
    @RequireSiteBootstrapComplete
    @HasPermission(type = DefaultPermission.class, action = PERMISSION_EDIT_SITE)
    public void unlockSite(@SiteId String siteId) throws SiteNotFoundException, InvalidSiteStateException {
        sitesServiceInternal.unlockSite(siteId);
    }

    @Override
    @RequireSiteExists
    @HasPermission(type = DefaultPermission.class, action = PERMISSION_DELETE_SITE)
    public void deleteSite(@SiteId String siteId) throws ServiceLayerException {
        sitesServiceInternal.deleteSite(siteId);
    }

    @Override
    public boolean exists(String siteId) {
        return sitesServiceInternal.exists(siteId);
    }

    @Override
    @RequireSiteReady
    @RequireSiteBootstrapComplete
    @HasPermission(type = DefaultPermission.class, action = PERMISSION_PUBLISH_STATUS)
    public PublishStatus getPublishingStatus(@SiteId String siteId) throws SiteNotFoundException {
        PublishStatus publishStatus = sitesServiceInternal.getPublishingStatus(siteId);
        PublishingProgressObserver publishingProgressObserver =
                publishingProgressServiceInternal.getPublishingProgress(siteId);
        if (Objects.nonNull(publishingProgressObserver)) {
            publishStatus.setPublishingTarget(publishingProgressObserver.getPublishingTarget());
            publishStatus.setSubmissionId(publishingProgressObserver.getPackageId());
            publishStatus.setNumberOfItems(publishingProgressObserver.getNumberOfFilesCompleted());
            publishStatus.setTotalItems(publishingProgressObserver.getNumberOfFilesBeingPublished());
        }
        publishStatus.setPublished(contentRepository.publishedRepositoryExists(siteId));
        return publishStatus;
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
    public Site getSite(String siteId) throws SiteNotFoundException{
        if (exists(siteId)) {
            return sitesServiceInternal.getSite(siteId);
        }
        throw new SiteNotFoundException(siteId);
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
	public List<String> getDeliverableSiteIds() {
		return sitesServiceInternal.getDeliverableSiteIds();
	}
}
