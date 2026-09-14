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
package org.craftercms.studio.api.v1.to;

import java.io.Serializable;
import java.util.List;
import java.util.Map;

/**
 * This class stores Site Configuration
 *
 * @author hyanghee
 * @author Dejan Brkic
 */
public class SiteConfigTO implements Serializable {

	/**
	 *
	 */
	protected static final long serialVersionUID = 3411780412457597813L;

	/**
	 * web project configuration if the site is dm-based
	 **/
	protected RepositoryConfigTO repositoryConfig = null;

	protected boolean stagingEnvironmentEnabled;

	/**
	 * staging environment
	 **/
	protected String stagingEnvironment;

	/**
	 * live environment
	 **/
	protected String liveEnvironment;

	/**
	 * Map of fields &amp; boosting to use in search
	 */
	protected Map<String, Float> searchFields;

	/**
	 * Configuration for the range facets in search
	 */
	protected Map<String, FacetTO> facets;

	/**
	 * Pattern for the plugins folder
	 */
	protected String pluginFolderPattern;

	/**
	 * Authoring url
	 */
	protected String authoringUrl;

	/**
	 * Live url
	 */
	protected String liveUrl;

	/**
	 * Admin email address for notification service
	 */
	protected String adminEmailAddress;

	protected boolean requirePeerReview = false;

	protected List<String> protectedFolderPatterns;

	protected ContentMonitorConfigTO contentMonitorConfig;

	public RepositoryConfigTO getRepositoryConfig() {
		return repositoryConfig;
	}

	public void setRepositoryConfig(RepositoryConfigTO repositoryConfig) {
		this.repositoryConfig = repositoryConfig;
	}

	public String getStagingEnvironment() {
		return stagingEnvironment;
	}

	public void setStagingEnvironment(String stagingEnvironment) {
		this.stagingEnvironment = stagingEnvironment;
	}

	public String getLiveEnvironment() {
		return liveEnvironment;
	}

	public void setLiveEnvironment(String liveEnvironment) {
		this.liveEnvironment = liveEnvironment;
	}

	public boolean isStagingEnvironmentEnabled() {
		return stagingEnvironmentEnabled;
	}

	public void setStagingEnvironmentEnabled(boolean stagingEnvironmentEnabled) {
		this.stagingEnvironmentEnabled = stagingEnvironmentEnabled;
	}

	public Map<String, Float> getSearchFields() {
		return searchFields;
	}

	public void setSearchFields(Map<String, Float> searchFields) {
		this.searchFields = searchFields;
	}

	public Map<String, FacetTO> getFacets() {
		return facets;
	}

	public void setFacets(final Map<String, FacetTO> facets) {
		this.facets = facets;
	}

	public String getPluginFolderPattern() {
		return pluginFolderPattern;
	}

	public void setPluginFolderPattern(final String pluginFolderPattern) {
		this.pluginFolderPattern = pluginFolderPattern;
	}

	public String getAuthoringUrl() {
		return authoringUrl;
	}

	public void setAuthoringUrl(String authoringUrl) {
		this.authoringUrl = authoringUrl;
	}

	public String getLiveUrl() {
		return liveUrl;
	}

	public void setLiveUrl(String liveUrl) {
		this.liveUrl = liveUrl;
	}

	public String getAdminEmailAddress() {
		return adminEmailAddress;
	}

	public void setAdminEmailAddress(String adminEmailAddress) {
		this.adminEmailAddress = adminEmailAddress;
	}

	public boolean isRequirePeerReview() {
		return requirePeerReview;
	}

	public void setRequirePeerReview(boolean requirePeerReview) {
		this.requirePeerReview = requirePeerReview;
	}

	public List<String> getProtectedFolderPatterns() {
		return protectedFolderPatterns;
	}

	public void setProtectedFolderPatterns(List<String> protectedFolderPatterns) {
		this.protectedFolderPatterns = protectedFolderPatterns;
	}

	public ContentMonitorConfigTO getContentMonitorConfig() {
		return contentMonitorConfig;
	}

	public void setContentMonitorConfig(ContentMonitorConfigTO contentMonitorConfig) {
		this.contentMonitorConfig = contentMonitorConfig;
	}
}
