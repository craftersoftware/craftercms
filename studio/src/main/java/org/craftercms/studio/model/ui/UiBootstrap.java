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

package org.craftercms.studio.model.ui;

/**
 * Context required to bootstrap Studio UI applications without server-rendered templates.
 */
public class UiBootstrap {

	private String xsrfHeader;
	private String xsrfArgument;
	private String xsrfToken;
	private boolean useBaseDomain;
	private String environment;
	private int passwordRequirementsMinComplexity;
	private String footerHtml;
	private String user;
	private String role;
	private String site;
	private String siteId;
	private String siteTitle;
	private String language;
	private String studioContext;
	private String previewAppBaseUri;
	private String cookieDomain;

	public String getXsrfHeader() {
		return xsrfHeader;
	}

	public void setXsrfHeader(String xsrfHeader) {
		this.xsrfHeader = xsrfHeader;
	}

	public String getXsrfArgument() {
		return xsrfArgument;
	}

	public void setXsrfArgument(String xsrfArgument) {
		this.xsrfArgument = xsrfArgument;
	}

	public String getXsrfToken() {
		return xsrfToken;
	}

	public void setXsrfToken(String xsrfToken) {
		this.xsrfToken = xsrfToken;
	}

	public boolean isUseBaseDomain() {
		return useBaseDomain;
	}

	public void setUseBaseDomain(boolean useBaseDomain) {
		this.useBaseDomain = useBaseDomain;
	}

	public String getEnvironment() {
		return environment;
	}

	public void setEnvironment(String environment) {
		this.environment = environment;
	}

	public int getPasswordRequirementsMinComplexity() {
		return passwordRequirementsMinComplexity;
	}

	public void setPasswordRequirementsMinComplexity(int passwordRequirementsMinComplexity) {
		this.passwordRequirementsMinComplexity = passwordRequirementsMinComplexity;
	}

	public String getFooterHtml() {
		return footerHtml;
	}

	public void setFooterHtml(String footerHtml) {
		this.footerHtml = footerHtml;
	}

	public String getUser() {
		return user;
	}

	public void setUser(String user) {
		this.user = user;
	}

	public String getRole() {
		return role;
	}

	public void setRole(String role) {
		this.role = role;
	}

	public String getSite() {
		return site;
	}

	public void setSite(String site) {
		this.site = site;
	}

	public String getSiteId() {
		return siteId;
	}

	public void setSiteId(String siteId) {
		this.siteId = siteId;
	}

	public String getSiteTitle() {
		return siteTitle;
	}

	public void setSiteTitle(String siteTitle) {
		this.siteTitle = siteTitle;
	}

	public String getLanguage() {
		return language;
	}

	public void setLanguage(String language) {
		this.language = language;
	}

	public String getStudioContext() {
		return studioContext;
	}

	public void setStudioContext(String studioContext) {
		this.studioContext = studioContext;
	}

	public String getPreviewAppBaseUri() {
		return previewAppBaseUri;
	}

	public void setPreviewAppBaseUri(String previewAppBaseUri) {
		this.previewAppBaseUri = previewAppBaseUri;
	}

	public String getCookieDomain() {
		return cookieDomain;
	}

	public void setCookieDomain(String cookieDomain) {
		this.cookieDomain = cookieDomain;
	}

}
