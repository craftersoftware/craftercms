/*
 * Copyright (C) 2007-2023 Crafter Software Corporation. All Rights Reserved.
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

package org.craftercms.studio.api.v2.service.site;

import org.craftercms.commons.plugin.model.PluginDescriptor;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.SiteAlreadyExistsException;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v2.dal.PublishStatus;
import org.craftercms.studio.api.v2.dal.Site;
import org.craftercms.studio.api.v2.exception.InvalidParametersException;
import org.craftercms.studio.api.v2.exception.InvalidSiteStateException;

import java.util.List;

import static java.lang.String.format;

/**
 * Site-related operations
 */
public interface SitesService {

    /**
     * Checks if a site exists. If it does not, it throws a {@link SiteNotFoundException}
     *
     * @param siteId site ID
     * @throws SiteNotFoundException if no site is found for the given site ID
     */
    default void checkSiteExists(String siteId) throws SiteNotFoundException {
        if (!exists(siteId)) {
            throw new SiteNotFoundException(format("Site '%s' not found.", siteId));
        }
    }

    /**
     * Check if site already exists
     *
     * @param siteId site ID
     * @return true if site exists, false otherwise
     */
    boolean exists(String siteId);


    /**
     * Get list of available blueprints
     *
     * @return list of blueprints
     */
    List<PluginDescriptor> getAvailableBlueprints();

    /**
     * Get the blueprint descriptor from the global repo
     * @param id the id of the blueprint
     * @return the descriptor object or null if not found
     */
    PluginDescriptor getBlueprintDescriptor(String id);

    /**
     * Get blueprint location
     *
     * @param blueprintId blueprint id
     * @return blueprint location
     */
    String getBlueprintLocation(String blueprintId);

    /**
     * Get the blueprint descriptor from a site repo
     * @param id the id of the site
     * @return the blueprint object or null if not found
     */
    PluginDescriptor getSiteBlueprintDescriptor(String id);

    /**
     * Updates the name and description for the given site
     *
     * @param siteId the id of the site
     * @param name the name of the site
     * @param description the description of the site
     *
     * @throws SiteNotFoundException if the site doesn't exist
     */
    void updateSite(String siteId, String name, String description)
            throws SiteNotFoundException, SiteAlreadyExistsException, InvalidParametersException;

    /**
     * Unlock a site which is locked with state `LOCKED`
     * @param siteId the id of the site
     * @throws SiteNotFoundException if the site doesn't exist
     * @throws InvalidSiteStateException if the site is not in LOCKED state
     */
    void unlockSite(String siteId) throws SiteNotFoundException, InvalidSiteStateException;

    /**
     * Checks if the currently existent site with the given ID also has the same siteUuid.
     *
     * @param siteId   ID of the site to test
     * @param siteUuid site UUID
     * @return true if the site UUID file exists and contains the same siteUUID value, false otherwise
     */
    boolean checkSiteUuid(String siteId, String siteUuid);

    /**
     * Enables/disables publishing for the given site
     * @param siteId the site id
     * @param enabled true to enable publishing, false to disable
     */
    void enablePublishing(String siteId, boolean enabled);

    /**
     * Get publishing status for site
     * @param siteId site identifier
     * @return publishing status
     */
    PublishStatus getPublishingStatus(String siteId) throws SiteNotFoundException;

    /**
     * Delete a site from the system
     *
     * @param siteId the site id
     * @throws SiteNotFoundException if the site doesn't exist
     */
    void deleteSite(String siteId) throws ServiceLayerException;

    /*
     * Check if current site state is matches the given state
     *
     * @param siteId site id
     * @param state  desired state
     * @throws InvalidSiteStateException if the site state doesn't match the given state
     * @throws SiteNotFoundException if the site doesn't exist
     */
    void checkSiteState(String siteId, String state) throws InvalidSiteStateException, SiteNotFoundException;

    /**
     * Get a site object from DB
     * @param siteId site id
     * @return site object
     */
    Site getSite(String siteId) throws SiteNotFoundException;

    /**
     * Update a site's last commit id
     *
     * @param siteId   site id
     * @param commitId commit id
     */
    void updateLastCommitId(String siteId, String commitId);

    /**
     * Get the last commit id for the given site
     *
     * @param siteId site id
     * @return the last commit id
     */
    String getLastCommitId(String siteId);
    /**
     * Duplicate a site
     *
     * @param sourceSiteId       the id of the site to duplicate
     * @param siteId             the id of the new site
     * @param siteName           the name of the new site
     * @param description        the description of the new site
     * @param sandboxBranch      the sandbox branch to use
     * @param readOnlyBlobStores whether the blob stores should be read only. Notice that this value is
     *                           overridden (forced to false) if serverless delivery is enabled
     * @throws ServiceLayerException if there is an error duplicating the site
     */
    void duplicate(String sourceSiteId, String siteId, String siteName, String description, String sandboxBranch, boolean readOnlyBlobStores)
            throws ServiceLayerException;

    /**
     * Get the sites matching a given state
     *
     * @param state the state to match. See {@link org.craftercms.studio.api.v2.dal.Site.State}
     * @return the list of sites matching the given state
     */
    List<Site> getSitesByState(String state);

    /**
     * Get all non-deleted sites
     *
     * @return the list of sites
     */
    List<Site> getAllSites();

	/**
	 * Site ids that serverless delivery should serve. A site with staging enabled is followed by
	 * {@code siteId-staging}.
	 *
	 * @return the deliverable site ids
	 */
	List<String> getDeliverableSiteIds();
}
