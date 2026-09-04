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

package org.craftercms.commons.http;

import jakarta.servlet.http.HttpServletResponse;

/**
 * Wrapper around {@link CookieManager} that is configured with a cookie name, so that the name does not have to be
 * specified on every method call.
 */
@SuppressWarnings("unused")
public class NamedCookieManager {

	private final CookieManager cookieManager;
	/* The name of the cookie */
	private final String name;

	public NamedCookieManager(String name, Integer maxAge,
							  String path, boolean secure,
							  boolean httpOnly, String domain) {
		this(name, maxAge, path, secure, httpOnly, domain, null);
	}

	public NamedCookieManager(String name, Integer maxAge,
							  String path, boolean secure,
							  boolean httpOnly, String domain,
							  String sameSite) {
		this.cookieManager = new CookieManager();
		cookieManager.setMaxAge(maxAge);
		cookieManager.setPath(path);
		cookieManager.setSecure(secure);
		cookieManager.setHttpOnly(httpOnly);
		cookieManager.setDomain(domain);
		cookieManager.setSameSite(sameSite);
		this.name = name;
	}

	public String getName() {
		return name;
	}

	public String getDomain() {
		return cookieManager.getDomain();
	}

	public boolean isHttpOnly() {
		return cookieManager.isHttpOnly();
	}

	public Integer getMaxAge() {
		return cookieManager.getMaxAge();
	}

	public String getPath() {
		return cookieManager.getPath();
	}

	public boolean isSecure() {
		return cookieManager.isSecure();
	}

	/**
	 * Adds a cookie with the configured name and the given value to the response.
	 *
	 * @param value    the cookie value
	 * @param response the HTTP response to add the cookie to
	 */
	public void addCookie(String value, HttpServletResponse response) {
		cookieManager.addCookie(name, value, response);
	}

	/**
	 * Deletes the cookie with the configured name from the response.
	 *
	 * @param response the HTTP response to delete the cookie from
	 */
	public void deleteCookie(HttpServletResponse response) {
		cookieManager.deleteCookie(name, response);
	}
}
