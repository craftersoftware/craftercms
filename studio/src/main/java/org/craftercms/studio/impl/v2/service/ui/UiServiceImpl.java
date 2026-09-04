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

package org.craftercms.studio.impl.v2.service.ui;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.apache.commons.lang3.StringUtils;
import org.craftercms.commons.entitlements.validator.EntitlementValidator;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.security.AuthenticationException;
import org.craftercms.studio.api.v1.exception.security.UserNotFoundException;
import org.craftercms.studio.api.v2.service.security.UserService;
import org.craftercms.studio.api.v2.service.ui.UiService;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import org.craftercms.studio.impl.v2.service.ui.internal.UiServiceInternal;
import org.craftercms.studio.impl.v2.utils.security.SecurityUtils;
import org.craftercms.studio.model.Site;
import org.craftercms.studio.model.ui.MenuItem;
import org.craftercms.studio.model.ui.UiBootstrap;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.CsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestHandler;
import org.springframework.security.web.csrf.DeferredCsrfToken;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.util.List;
import java.util.Set;

import static org.craftercms.commons.http.HttpUtils.getCookieValue;
import static org.craftercms.studio.api.v1.constant.StudioConstants.ADMIN_ROLE;
import static org.craftercms.studio.api.v1.constant.StudioConstants.COOKIE_PATH;
import static org.craftercms.studio.api.v1.constant.StudioConstants.LANGUAGE_COOKIE_NAME;
import static org.craftercms.studio.api.v1.constant.StudioConstants.ROOT_PATH;
import static org.craftercms.studio.api.v1.constant.StudioConstants.SITE_COOKIE_NAME;
import static org.craftercms.studio.api.v1.constant.StudioConstants.UNSET;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.CONFIGURATION_DEFAULT_LANGUAGE;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.CONFIGURATION_ENVIRONMENT_ACTIVE;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.SECURITY_PASSWORD_REQUIREMENTS_MINIMUM_COMPLEXITY;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.STUDIO_COOKIE_USE_BASE_DOMAIN;
import static org.craftercms.studio.api.v2.utils.StudioUtils.getCookieDomain;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.DEFAULT_PATH_RESOURCE_VALUE;

/**
 * Default implementation of {@link UiService}. Delegates to the {@link UiServiceInternal} for the actual work.
 *
 * @author avasquez
 */
public class UiServiceImpl implements UiService {

	private final UserService userService;
	private final UiServiceInternal uiServiceInternal;
	private final EntitlementValidator entitlementValidator;
	private final CsrfTokenRepository csrfTokenRepository;
	private final CsrfTokenRequestHandler csrfTokenRequestHandler;
	private StudioConfiguration studioConfiguration;

	public UiServiceImpl(UserService userService, UiServiceInternal uiServiceInternal,
			     EntitlementValidator entitlementValidator, CsrfTokenRepository csrfTokenRepository,
			     CsrfTokenRequestHandler csrfTokenRequestHandler) {
		this.userService = userService;
		this.uiServiceInternal = uiServiceInternal;
		this.entitlementValidator = entitlementValidator;
		this.csrfTokenRepository = csrfTokenRepository;
		this.csrfTokenRequestHandler = csrfTokenRequestHandler;
	}

	public void setStudioConfiguration(StudioConfiguration studioConfiguration) {
		this.studioConfiguration = studioConfiguration;
	}

	@Override
	public List<MenuItem> getGlobalMenu() throws AuthenticationException, ServiceLayerException, UserNotFoundException {
		String user = SecurityUtils.getCurrentUsername();
		if (StringUtils.isNotEmpty(user)) {
			Set<String> permissions = userService.getUserPermissions(StringUtils.EMPTY, DEFAULT_PATH_RESOURCE_VALUE, user);

			return uiServiceInternal.getGlobalMenu(permissions);
		}

		throw new AuthenticationException("User is not authenticated");
	}

	@Override
	public String getActiveEnvironment() throws AuthenticationException {
		String user = SecurityUtils.getCurrentUsername();
		if (StringUtils.isNotEmpty(user)) {
			return studioConfiguration.getProperty(CONFIGURATION_ENVIRONMENT_ACTIVE);
		}
		throw new AuthenticationException("User is not authenticated");
	}

	@Override
	public UiBootstrap getBootstrap(HttpServletRequest request, HttpServletResponse response)
		throws AuthenticationException, ServiceLayerException, UserNotFoundException {
		String requestedSite = getCookieValue(SITE_COOKIE_NAME, request);
		String language = getCookieValue(LANGUAGE_COOKIE_NAME, request);

		UiBootstrap bootstrap = new UiBootstrap();
		CsrfToken csrfToken = resolveCsrfToken(request, response);
		bootstrap.setXsrfHeader(csrfToken.getHeaderName());
		bootstrap.setXsrfArgument(csrfToken.getParameterName());
		bootstrap.setXsrfToken(csrfToken.getToken());
		bootstrap.setUseBaseDomain(Boolean.parseBoolean(
			studioConfiguration.getProperty(STUDIO_COOKIE_USE_BASE_DOMAIN)));
		bootstrap.setEnvironment(studioConfiguration.getProperty(CONFIGURATION_ENVIRONMENT_ACTIVE));
		bootstrap.setPasswordRequirementsMinComplexity(Integer.parseInt(
			studioConfiguration.getProperty(SECURITY_PASSWORD_REQUIREMENTS_MINIMUM_COMPLEXITY)));
		bootstrap.setFooterHtml(entitlementValidator.getDescription());
		bootstrap.setLanguage(StringUtils.isBlank(language) || UNSET.equals(language)
			? studioConfiguration.getProperty(CONFIGURATION_DEFAULT_LANGUAGE)
			: language);
		populateRequestContext(bootstrap, request);

		String username = SecurityUtils.getCurrentUsername();
		if (StringUtils.isBlank(username)) {
			return bootstrap;
		}

		bootstrap.setUser(username);

		List<Site> sites = userService.getCurrentUserSites();
		if (sites.isEmpty()) {
			return bootstrap;
		}

		Site activeSite = sites.stream()
			.filter(site -> site.getSiteId().equals(requestedSite))
			.findFirst()
			.orElse(sites.getFirst());
		bootstrap.setSite(activeSite.getSiteId());
		bootstrap.setSiteId(activeSite.getSiteId());
		bootstrap.setSiteTitle(activeSite.getName());

		if (!activeSite.getSiteId().equals(requestedSite)) {
			Cookie siteCookie = new Cookie(SITE_COOKIE_NAME, activeSite.getSiteId());
			siteCookie.setDomain(getCookieDomain(request.getServerName(), bootstrap.isUseBaseDomain()));
			siteCookie.setPath(COOKIE_PATH);
			response.addCookie(siteCookie);
		}

		List<String> roles = userService.getCurrentUserSiteRoles(activeSite.getSiteId());
		if (!roles.isEmpty()) {
			bootstrap.setRole(roles.contains(ADMIN_ROLE) ? ADMIN_ROLE : roles.getFirst());
		}

		return bootstrap;
	}

	/**
	 * Resolves the CSRF token for the current request, masking it through the {@link CsrfTokenRequestHandler} so that
	 * every response carries a distinct value for the same underlying token. The CSRF filter is disabled for the API
	 * security chain, so the token is not already available as a request attribute.
	 *
	 * @param request  the current request
	 * @param response the current response, used to persist a newly generated token
	 * @return the masked token
	 */
	private CsrfToken resolveCsrfToken(HttpServletRequest request, HttpServletResponse response) {
		DeferredCsrfToken deferredCsrfToken = csrfTokenRepository.loadDeferredToken(request, response);
		csrfTokenRequestHandler.handle(request, response, deferredCsrfToken);

		return (CsrfToken) request.getAttribute(CsrfToken.class.getName());
	}

	private static void populateRequestContext(UiBootstrap bootstrap, HttpServletRequest request) {
		String origin = ServletUriComponentsBuilder.fromRequestUri(request)
			.replacePath(null)
			.replaceQuery(null)
			.build()
			.toUriString();
		String contextPath = request.getContextPath();

		bootstrap.setStudioContext(contextPath.startsWith(ROOT_PATH) ? contextPath.substring(1) : contextPath);
		bootstrap.setPreviewAppBaseUri(origin);
		bootstrap.setCookieDomain(getCookieDomain(request.getServerName(), bootstrap.isUseBaseDomain()));
	}

}
