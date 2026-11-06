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

package org.craftercms.studio.api.v2.dal;

import org.apache.ibatis.annotations.Param;
import org.craftercms.studio.api.v2.service.item.ItemService;

import java.util.List;

import static org.craftercms.studio.api.v2.dal.QueryParameterNames.*;

public interface SiteDAO {

	String PUBLISHING_STATUS = "publishingStatus";
	String SITE_ID = "siteId";
	String ENABLED = "enabled";
	String COMMIT_ID = "commitId";
	String STATE = "state";

	/**
	 * Delete site
	 *
	 * @param siteId site identifier
	 */
	void deleteSiteRelatedItems(@Param(SITE_ID) String siteId);

	/**
	 * Mark the site as DELETING
	 *
	 * @param siteId the site id
	 */
	void startSiteDelete(@Param(SITE_ID) String siteId);

	/**
	 * Marks the site as DELETED
	 *
	 * @param siteId the site id
	 */
	void completeSiteDelete(@Param(SITE_ID) String siteId);

	/**
	 * Checks if a non-deleted site exists with the given site id
	 *
	 * @param siteId the site id
	 * @return true if the site exists, false otherwise
	 */
	boolean exists(@Param(SITE_ID) String siteId);

	/**
	 * Checks if a non-deleted site exists with the given name
	 *
	 * @param name the site name
	 * @return true if the site exists, false otherwise
	 */
	boolean existsByName(@Param(NAME) String name);

	/**
	 * Enables/disables publishing for the given site
	 *
	 * @param siteId  the site id
	 * @param enabled true to enable publishing, false to disable
	 */
	void enablePublishing(@Param(SITE_ID) String siteId, @Param(ENABLED) boolean enabled);

	/**
	 * Gets the site with the given site id
	 *
	 * @param siteId the site id
	 * @return the {@link Site} object
	 */
	Site getSite(@Param(SITE_ID) String siteId);

	/**
	 * Get the last commit id for the given site
	 *
	 * @param siteId site id
	 * @return the last commit id
	 */
	String getLastCommitId(@Param(SITE_ID) String siteId);

	/**
	 * Update a site's last commit id
	 *
	 * @param siteId   site id
	 * @param commitId commit id
	 */
	void updateLastCommitId(@Param(SITE_ID) String siteId, @Param(COMMIT_ID) String commitId);

	/**
	 * Get the sites matching the given state
	 *
	 * @param state the state
	 * @return the list of sites
	 */
	List<Site> getSitesByState(@Param(STATE) String state);

	/**
	 * Get all non-deleted sites
	 *
	 * @return the list of sites
	 */
	List<Site> getAllSites();

	/**
	 * Set published repo created flag
	 *
	 * @param siteId the site id
	 */
	void setPublishedRepoCreated(@Param(SITE_ID) String siteId);

	/**
	 * Enable staging for the given site. Staging cannot be disabled once enabled.
	 *
	 * @param siteId the site id
	 * @return the number of rows updated. {@code 0} when staging was already enabled
	 */
	int setStagingEnabled(@Param(SITE_ID) String siteId);

	/**
	 * Record whether the live blob-store assets have been copied to staging.
	 * {@code false} means the next staging publish must copy them before publishing its own delta.
	 *
	 * @param siteId the site id
	 * @param copied true when the copy is done or there is nothing to copy
	 */
	void setStagingBlobsCopied(@Param(SITE_ID) String siteId, @Param("copied") boolean copied);

	/**
	 * Update publishing status
	 *
	 * @param siteId the site id
	 * @param status publisher status
	 */
	void updatePublishingStatus(@Param(SITE_ID) String siteId, @Param(PUBLISHING_STATUS) String status);


	/**
	 * Duplicate a site in the database.
	 *
	 * @param sourceSiteId  the id of the site to duplicate
	 * @param siteId        the id of the new site
	 * @param name          the name of the new site
	 * @param description   the description of the new site
	 * @param sandboxBranch the sandbox branch of the new site
	 * @param siteUuid      the uuid of the new site
	 */
	void duplicate(@Param(SOURCE_SITE_ID) String sourceSiteId, @Param(SITE_ID) String siteId,
				   @Param(NAME) String name, @Param(DESC) String description,
				   @Param(SANDBOX_BRANCH) String sandboxBranch, @Param(UUID) String siteUuid);

	/**
	 * Create a new site in the database
	 *
	 * @param site the site to create
	 */
	void createSite(Site site);

	/**
	 * Update the site state
	 *
	 * @param siteId     the site id
	 * @param stateReady the new state
	 */
	void setSiteState(@Param(SITE_ID) String siteId, @Param(STATE) String stateReady);

	/**
	 * Checks if there is a non-deleted site, different than the siteId, using the given name
	 *
	 * @param siteId   the id of the site
	 * @param siteName the name of the site
	 * @return true if the name is being used by another site, false otherwise
	 */
	boolean isNameUsed(@Param(SITE_ID) String siteId, @Param(NAME) String siteName);

	/**
	 * Updates the name and description for the given site
	 *
	 * @param siteId      the id of the site
	 * @param name        the name of the site
	 * @param description the description of the site
	 */
	int updateSite(@Param(SITE_ID) String siteId, @Param(NAME) String name, @Param(DESC) String description);
}
