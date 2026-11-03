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
package org.craftercms.studio.api.v2.repository.blob;

import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v2.dal.publish.PublishPackage;
import org.craftercms.studio.api.v2.repository.ContentRepository;
import org.craftercms.studio.api.v2.repository.GitContentRepository;
import org.craftercms.studio.api.v2.repository.PublishCapableRepository;
import org.craftercms.studio.api.v2.repository.PublishItemTO;
import org.craftercms.studio.api.v2.repository.publish.GitPublishChangeSet;

/**
 * {@link ContentRepository} extension that provides blob aware operations.
 */
public interface StudioBlobAwareContentRepository extends GitContentRepository, PublishCapableRepository {

	/**
	 * Extract every blob from the source site and store it in the target site in the blob store matching its path
	 *
	 * @param sourceSiteId the source site
	 * @param siteId       the target site
	 * @throws ServiceLayerException if an error occurs during the operation
	 */
	void duplicateBlobs(String sourceSiteId, String siteId) throws ServiceLayerException;

	/**
	 * Copy published blob-store assets from one publishing target to another in the same site.
	 * Paths are listed from {@code sourceEnvironment}. Sites with no blob stores are skipped.
	 *
	 * @param siteId            the site id
	 * @param sourceEnvironment the publishing target to copy from
	 * @param targetEnvironment the publishing target to copy to
	 * @throws ServiceLayerException if an error occurs during the operation
	 */
	void copyBlobs(String siteId, String sourceEnvironment, String targetEnvironment) throws ServiceLayerException;

	/**
	 * Copy published blob-store assets from one publishing target to another in the same site.
	 * Paths are listed from {@code revision}. Blob bytes are read from {@code sourceEnvironment}.
	 * Sites with no blob stores are skipped.
	 *
	 * @param siteId            the site id
	 * @param sourceEnvironment the publishing target to copy bytes from
	 * @param targetEnvironment the publishing target to copy bytes to
	 * @param revision          git revision whose tree lists the blobs to copy
	 * @throws ServiceLayerException if an error occurs during the operation
	 */
	void copyBlobs(String siteId, String sourceEnvironment, String targetEnvironment, String revision) throws ServiceLayerException;

	/**
	 * Execute initial publish for given site
	 *
	 * @param publishPackage the package to publish
	 * @return commit id of the initial publish.
	 * After this method runs, the returned value is the last
	 * commit in the published repository for the target branch
	 */
	GitPublishChangeSet<? extends PublishItemTO> initialPublish(PublishPackage publishPackage, String target) throws ServiceLayerException;
}
