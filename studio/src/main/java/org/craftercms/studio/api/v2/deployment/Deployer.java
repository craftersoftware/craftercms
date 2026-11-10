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
package org.craftercms.studio.api.v2.deployment;

import org.springframework.web.client.RestClientException;

/**
 * Helper/client class for doing Crafter Deployer operations.
 *
 * @author avasquez
 */
public interface Deployer {

	/**
	 * Calls a Crafter Deployer to create any necessary targets for the site.
	 *
	 * @param site the site
	 * @throws RestClientException if an error occurs
	 */
	void createTargets(String site) throws RestClientException;

	/**
	 * Deletes the targets associated with the site.
	 *
	 * @param site the site
	 * @throws RestClientException if an error occurs
	 */
	void deleteTargets(String site) throws RestClientException;

	/**
	 * Call Crafter Deployer API to duplicate the site targets
	 *
	 * @param sourceSiteId the site to duplicate from
	 * @param siteId       the new site id
	 * @throws RestClientException if an error occurs while calling Deployer API
	 */
	void duplicateTargets(String sourceSiteId, String siteId);

	/**
	 * Create the staging delivery target for the site.
	 * Implementations that do not provision a staging target do nothing.
	 *
	 * @param site the site
	 * @throws RestClientException if an error occurs
	 */
	default void createStagingTarget(String site) throws RestClientException {
	}

	/**
	 * Delete the staging delivery target for the site if one exists.
	 * Implementations that do not provision a staging target do nothing.
	 *
	 * @param site the site
	 * @throws RestClientException if an error occurs
	 */
	default void deleteStagingTarget(String site) throws RestClientException {
	}

	/**
	 * Duplicate the staging delivery target from the source site.
	 * Implementations that do not provision a staging target do nothing.
	 *
	 * @param sourceSiteId the site to duplicate from
	 * @param siteId       the new site id
	 * @throws RestClientException if an error occurs
	 */
	default void duplicateStagingTarget(String sourceSiteId, String siteId) throws RestClientException {
	}
}
