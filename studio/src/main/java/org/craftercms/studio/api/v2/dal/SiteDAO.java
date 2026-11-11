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

package org.craftercms.studio.api.v2.dal;

import org.apache.ibatis.annotations.Param;

import java.util.List;

import static org.craftercms.studio.api.v2.dal.QueryParameterNames.*;

public interface SiteDAO {

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
	 * Site ids that delivery can serve: not deleted, not system, published repository created,
	 * and state {@code READY} or {@code LOCKED}.
	 *
	 * @return the site ids, ordered by site id
	 */
	List<String> getDeliverableSiteIds();
}
