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

/**
 * Represents a Crafter site from the database.
 */
public class Site {

	protected long id;
	protected String siteUuid;
	protected String siteId;
	protected String name;
	protected String description;
	protected boolean deleted;
	protected String liveUrl;
	protected String lastCommitId;
	protected boolean publishingEnabled;
	protected String publishingStatus;
	protected String sandboxBranch;
	protected boolean publishedRepoCreated;
	protected boolean stagingEnabled;
	protected boolean stagingBlobsCopied;
	protected String state;

	public long getId() {
		return id;
	}

	public void setId(long id) {
		this.id = id;
	}

	public String getSiteUuid() {
		return siteUuid;
	}

	public void setSiteUuid(String siteUuid) {
		this.siteUuid = siteUuid;
	}

	public String getSiteId() {
		return siteId;
	}

	public void setSiteId(String siteId) {
		this.siteId = siteId;
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public String getDescription() {
		return description;
	}

	public void setDescription(String description) {
		this.description = description;
	}

	public String getLiveUrl() {
		return liveUrl;
	}

	public void setLiveUrl(String liveUrl) {
		this.liveUrl = liveUrl;
	}

	public String getLastCommitId() {
		return lastCommitId;
	}

	public void setLastCommitId(String lastCommitId) {
		this.lastCommitId = lastCommitId;
	}

	public boolean getPublishingEnabled() {
		return publishingEnabled;
	}

	public void setPublishingEnabled(boolean publishingEnabled) {
		this.publishingEnabled = publishingEnabled;
	}

	public String getPublishingStatus() {
		return publishingStatus;
	}

	public void setPublishingStatus(String publishingStatus) {
		this.publishingStatus = publishingStatus;
	}

	public String getSandboxBranch() {
		return sandboxBranch;
	}

	public void setSandboxBranch(String sandboxBranch) {
		this.sandboxBranch = sandboxBranch;
	}

	public boolean getDeleted() {
		return deleted;
	}

	public void setDeleted(boolean deleted) {
		this.deleted = deleted;
	}

	public boolean getPublishedRepoCreated() {
		return publishedRepoCreated;
	}

	public void setPublishedRepoCreated(boolean publishedRepoCreated) {
		this.publishedRepoCreated = publishedRepoCreated;
	}

	public boolean isStagingEnabled() {
		return stagingEnabled;
	}

	public void setStagingEnabled(boolean stagingEnabled) {
		this.stagingEnabled = stagingEnabled;
	}

	public boolean isStagingBlobsCopied() {
		return stagingBlobsCopied;
	}

	public void setStagingBlobsCopied(boolean stagingBlobsCopied) {
		this.stagingBlobsCopied = stagingBlobsCopied;
	}

	public String getState() {
		return state;
	}

	public void setState(String state) {
		this.state = state;
	}

	public static class State {
		public static final String INITIALIZING = "INITIALIZING";
		public static final String LOCKED = "LOCKED";
		public static final String READY = "READY";
		public static final String DELETING = "DELETING";
		public static final String DELETED = "DELETED";

		// Special state used when system is bootstrapping and site is not fully checked/upgraded yet.
		public static final String BOOTSTRAPPING = "BOOTSTRAPPING";
	}
}
