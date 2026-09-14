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
package org.craftercms.engine.util.spring.security.preview;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.craftercms.commons.crypto.CryptoException;
import org.craftercms.commons.crypto.TextEncryptor;
import org.craftercms.commons.http.HttpUtils;
import org.craftercms.engine.exception.PreviewAccessException;
import org.craftercms.engine.service.context.SiteContext;
import org.craftercms.engine.util.http.SameSite;
import org.craftercms.engine.util.spring.cors.SiteAwareCorsConfigurationSource;
import org.springframework.http.HttpStatus;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsUtils;
import org.springframework.web.filter.GenericFilterBean;

import java.beans.ConstructorProperties;
import java.io.IOException;
import java.util.Arrays;
import java.util.List;

import static java.lang.String.format;
import static org.apache.commons.lang3.StringUtils.isEmpty;

/**
 * Filter that checks if the user is authorized to preview the site.
 * If the authorized token is from the QSA, it will set the cookies to support preview workflow.
 */
public class ConfigAwarePreviewAccessTokenFilter extends GenericFilterBean {
	private final static String PREVIEW_SITE_TOKEN_NAME = "crafterPreview";
	private final static String PREVIEW_SITE_TOKEN_HEADER_NAME = "X-Crafter-Preview";
	private final static String ALLOW_ALL_SITES_WILDCARD = "*";

	private final TextEncryptor textEncryptor;
	private final SiteAwareCorsConfigurationSource corsConfigSource;
	private final String siteNameParam;
	private final String cookiePath;
	private final boolean cookieHttpOnly;
	private final SameSite cookieSameSite;

	@ConstructorProperties({"textEncryptor", "corsConfigSource", "siteNameParam", "cookiePath", "cookieHttpOnly",
		"cookieSameSite"})
	public ConfigAwarePreviewAccessTokenFilter(final TextEncryptor textEncryptor,
											   final SiteAwareCorsConfigurationSource corsConfigSource,
											   final String siteNameParam, final String cookiePath,
											   boolean cookieHttpOnly, String cookieSameSite) {
		this.textEncryptor = textEncryptor;
		this.corsConfigSource = corsConfigSource;
		this.siteNameParam = siteNameParam;
		this.cookiePath = cookiePath;
		this.cookieHttpOnly = cookieHttpOnly;
		this.cookieSameSite = SameSite.fromValue(cookieSameSite);
	}

	@Override
	public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain) throws IOException, ServletException {
		HttpServletRequest httpServletRequest = (HttpServletRequest) request;
		HttpServletResponse httpServletResponse = (HttpServletResponse) response;
		String site = SiteContext.getCurrent().getSiteName();
		if (isEmpty(site)) {
			chain.doFilter(request, response);
			return;
		}

		if (skipTokenValidation(httpServletRequest)) {
			chain.doFilter(request, response);
			return;
		}

		boolean tokenFromQueryParam = false;
		String previewToken = httpServletRequest.getHeader(PREVIEW_SITE_TOKEN_HEADER_NAME);
		if (isEmpty(previewToken)) {
			previewToken = httpServletRequest.getParameter(PREVIEW_SITE_TOKEN_NAME);
			tokenFromQueryParam = !isEmpty(previewToken);
		}
		if (isEmpty(previewToken)) {
			previewToken = HttpUtils.getCookieValue(PREVIEW_SITE_TOKEN_NAME, httpServletRequest);
		}

		if (isEmpty(previewToken)) {
			String message = format("User is not authorized to preview site. '%s' header or '%s' token not found",
				PREVIEW_SITE_TOKEN_HEADER_NAME, PREVIEW_SITE_TOKEN_NAME);
			logger.debug(message);
			throw new PreviewAccessException(HttpStatus.UNAUTHORIZED, message);
		}

		String[] tokens = decryptPreviewToken(previewToken);
		if (tokens.length != 2) {
			String message = format("Failed to validate preview site token. Found '%s' header or '%s' token elements but expecting 2",
				PREVIEW_SITE_TOKEN_HEADER_NAME, PREVIEW_SITE_TOKEN_NAME);
			logger.debug(message);
			throw new PreviewAccessException(HttpStatus.UNAUTHORIZED, message);
		}

		long tokenExpiryTimestamp = Long.parseLong(tokens[1]);
		boolean isExpired = tokenExpiryTimestamp < System.currentTimeMillis();
		if (isExpired) {
			String message = format("User is not authorized to preview site '%s', '%s' header or '%s' token has expired",
				site, PREVIEW_SITE_TOKEN_HEADER_NAME, PREVIEW_SITE_TOKEN_NAME);
			logger.debug(message);
			throw new PreviewAccessException(HttpStatus.FORBIDDEN, message);
		}

		String previewSitesFromToken = tokens[0];
		List<String> allowedSites = Arrays.asList(previewSitesFromToken.split(","));
		if (!allowedSites.contains(site) && !allowedSites.contains(ALLOW_ALL_SITES_WILDCARD)) {
			String message = format("User is not authorized to preview site '%s', '%s' header or '%s' token does not match",
				site, PREVIEW_SITE_TOKEN_HEADER_NAME, PREVIEW_SITE_TOKEN_NAME);
			logger.debug(message);
			throw new PreviewAccessException(HttpStatus.FORBIDDEN, message);
		}

		// Create preview token and site name cookies to support preview workflow
		int maxAge = Math.max((int)((tokenExpiryTimestamp - System.currentTimeMillis()) / 1000), 0);
		if (tokenFromQueryParam && maxAge > 0) {
			createPreviewCookie(httpServletRequest, httpServletResponse, previewToken, maxAge);
			createSiteNameCookie(httpServletRequest, httpServletResponse, maxAge);
		}

		chain.doFilter(request, response);
	}

	/**
	 * Creates a preview cookie with the given token.
	 *
	 * @param request the HTTP request
	 * @param response the HTTP response
	 * @param previewToken the preview token
	 * @param  maxAge the max-age value
	 */
	private void createPreviewCookie(HttpServletRequest request, HttpServletResponse response, String previewToken, int maxAge) {
		createCookie(request, response, PREVIEW_SITE_TOKEN_NAME, previewToken, maxAge);
	}

	/**
	 * Creates a cookie with the site name.
	 *
	 * @param request the HTTP request
	 * @param response the HTTP response
	 * @param maxAge the max-age value
	 */
	private void createSiteNameCookie(HttpServletRequest request, HttpServletResponse response, int maxAge) {
		String siteName = request.getParameter(siteNameParam);
		if (isEmpty(siteName)) {
			return;
		}

		createCookie(request, response, siteNameParam, siteName, maxAge);
	}

	/**
	 * Creates a cookie with the given name and value.
	 *
	 * @param request the HTTP request
	 * @param response the HTTP response
	 * @param name the name of the cookie
	 * @param value the value of the cookie
	 * @param maxAge the max-age value
	 */
	private void createCookie(HttpServletRequest request, HttpServletResponse response, String name, String value, int maxAge) {
		Cookie cookie = new Cookie(name, value);
		cookie.setPath(cookiePath);
		cookie.setHttpOnly(cookieHttpOnly);
		cookie.setAttribute("SameSite", cookieSameSite.getValue());
		cookie.setSecure(request.isSecure());
		cookie.setMaxAge(maxAge);
		response.addCookie(cookie);
	}

	/**
	 * Decrypts the preview site token.
	 *
	 * @param encryptedToken the encrypted token
	 * @return the decrypted token as an array of tokens (siteNames, expirationTimestamp)
	 */
	private String[] decryptPreviewToken(final String encryptedToken) {
		try {
			return textEncryptor.decrypt(encryptedToken)
				.split("\\|");
		} catch (CryptoException e) {
			String message = "Failed to decrypt preview site token";
			logger.debug(message, e);
			throw new PreviewAccessException(HttpStatus.UNAUTHORIZED, message);
		}
	}

	/**
	 * Determines whether token validation should be skipped for the given HTTP request.
	 * This is typically used for preflight OPTIONS requests in CORS (Cross-Origin Resource Sharing)
	 * scenarios, where token validation is not required.
	 *
	 * @param request The HTTP request to evaluate.
	 * @return {@code true} if token validation should be skipped, {@code false} otherwise.
	 */
	private boolean skipTokenValidation(HttpServletRequest request) {
		if (!CorsUtils.isCorsRequest(request) || !CorsUtils.isPreFlightRequest(request)) {
			return false;
		}

		return corsAllowedOrigin(request);
	}

	/**
	 * Checks if the `Origin` header of the given HTTP request is allowed based on the
	 * configured CORS (Cross-Origin Resource Sharing) origin patterns. If no CORS configuration
	 * is found or if the `Origin` header is missing or empty, the origin is not allowed.
	 *
	 * @param request The HTTP request to check for allowed CORS origin.
	 * @return {@code true} if the `Origin` header is allowed according to the CORS configuration;
	 *         {@code false} otherwise.
	 */
	private boolean corsAllowedOrigin(HttpServletRequest request) {
		CorsConfiguration corsConfiguration = corsConfigSource.getCorsConfiguration(request);
		if (corsConfiguration == null) {
			return false;
		}

		String origin = request.getHeader("Origin");
		if (isEmpty(origin)) {
			return false;
		}

		return corsConfiguration.checkOrigin(origin) != null;
	}
}
