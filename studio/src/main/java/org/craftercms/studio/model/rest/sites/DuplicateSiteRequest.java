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

package org.craftercms.studio.model.rest.sites;

import org.craftercms.commons.validation.annotations.param.ValidSiteId;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Holds the parameters to a duplicate site request
 */
public class DuplicateSiteRequest {
	@NotBlank
	@Size(max = 255)
	private String siteName;
	@NotBlank
	@ValidSiteId
	private String siteId;
	@Size(max = 4000)
	private String description;
	@Size(max = 255)
	private String sandboxBranch;
	/**
	 * If true, the blob stores will be read only
	 * If false, the blob stores will retain the same configuration as the source site
	 */
	private boolean readOnlyBlobStores = false;
	/**
	 * When true, staging is enabled on the new site regardless of the source site.
	 * Staging cannot be disabled afterwards.
	 */
	private boolean enableStaging = false;

	public String getSiteName() {
		return siteName;
	}

	public void setSiteName(String siteName) {
		this.siteName = siteName;
	}

	public String getSiteId() {
		return siteId;
	}

	public void setSiteId(String siteId) {
		this.siteId = siteId;
	}

	public String getDescription() {
		return description;
	}

	public void setDescription(String description) {
		this.description = description;
	}

	public String getSandboxBranch() {
		return sandboxBranch;
	}

	public void setSandboxBranch(String sandboxBranch) {
		this.sandboxBranch = sandboxBranch;
	}

	public boolean isReadOnlyBlobStores() {
		return readOnlyBlobStores;
	}

	public void setReadOnlyBlobStores(boolean readOnlyBlobStores) {
		this.readOnlyBlobStores = readOnlyBlobStores;
	}

	public boolean isEnableStaging() {
		return enableStaging;
	}

	public void setEnableStaging(boolean enableStaging) {
		this.enableStaging = enableStaging;
	}
}
