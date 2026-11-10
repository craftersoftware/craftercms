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

package org.craftercms.studio.model.site;

import org.craftercms.studio.api.v2.dal.Site;
import org.craftercms.studio.api.v2.repository.blob.StudioBlobStore;

import java.util.List;

/**
 * Site details.
 * Extra information (blob stores config) is meant to be used by the UI during duplicate site operations.
 */
public class SiteDetails {
	private final long id;
	private final String siteId;
	private final String siteUuid;
	private final String name;
	private final String description;
	private final String liveUrl;
	private final String lastCommitId;
	private final boolean publishingEnabled;
	private final String publishingStatus;
	private final String sandboxBranch;
	private final boolean publishedRepoCreated;
	private final boolean stagingEnabled;
	private final String state;
	private final List<StudioBlobStore> blobStores;

	public SiteDetails(Site site, List<StudioBlobStore> blobStores) {
		this.blobStores = blobStores;
		this.id = site.getId();
		this.siteId = site.getSiteId();
		this.siteUuid = site.getSiteUuid();
		this.name = site.getName();
		this.description = site.getDescription();
		this.liveUrl = site.getLiveUrl();
		this.lastCommitId = site.getLastCommitId();
		this.publishingEnabled = site.getPublishingEnabled();
		this.publishingStatus = site.getPublishingStatus();
		this.sandboxBranch = site.getSandboxBranch();
		this.publishedRepoCreated = site.getPublishedRepoCreated();
		this.stagingEnabled = site.isStagingEnabled();
		this.state = site.getState();
	}

	public List<StudioBlobStore> getBlobStores() {
		return blobStores;
	}

	public String getDescription() {
		return description;
	}

	public long getId() {
		return id;
	}

	public String getLastCommitId() {
		return lastCommitId;
	}

	public String getLiveUrl() {
		return liveUrl;
	}

	public String getName() {
		return name;
	}

	public boolean isPublishedRepoCreated() {
		return publishedRepoCreated;
	}

	public boolean isStagingEnabled() {
		return stagingEnabled;
	}

	public boolean isPublishingEnabled() {
		return publishingEnabled;
	}

	public String getPublishingStatus() {
		return publishingStatus;
	}

	public String getSandboxBranch() {
		return sandboxBranch;
	}

	public String getSiteId() {
		return siteId;
	}

	public String getSiteUuid() {
		return siteUuid;
	}

	public String getState() {
		return state;
	}
}
