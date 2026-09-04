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
import org.craftercms.commons.entitlements.validator.EntitlementValidator;
import org.craftercms.studio.api.v2.service.security.UserService;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import org.craftercms.studio.impl.v2.service.ui.internal.UiServiceInternal;
import org.craftercms.studio.impl.v2.utils.security.SecurityUtils;
import org.craftercms.studio.model.Site;
import org.craftercms.studio.model.ui.UiBootstrap;
import org.junit.Before;
import org.junit.Test;
import org.mockito.MockedStatic;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.CsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestHandler;
import org.springframework.security.web.csrf.DeferredCsrfToken;

import java.util.List;

import static org.craftercms.studio.api.v1.constant.StudioConstants.COOKIE_PATH;
import static org.craftercms.studio.api.v1.constant.StudioConstants.LANGUAGE_COOKIE_NAME;
import static org.craftercms.studio.api.v1.constant.StudioConstants.SITE_COOKIE_NAME;
import static org.craftercms.studio.api.v1.constant.StudioConstants.UNSET;
import static org.craftercms.studio.api.v1.constant.StudioConstants.XSRF_HEADER_NAME;
import static org.craftercms.studio.api.v1.constant.StudioConstants.XSRF_PARAMETER_NAME;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.CONFIGURATION_DEFAULT_LANGUAGE;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.CONFIGURATION_ENVIRONMENT_ACTIVE;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.SECURITY_PASSWORD_REQUIREMENTS_MINIMUM_COMPLEXITY;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.STUDIO_COOKIE_USE_BASE_DOMAIN;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

public class UiServiceImplTest {

	private static final String XSRF_TOKEN = "csrf-token";

	private UserService userService;
	private UiServiceImpl uiService;
	private HttpServletRequest request;
	private HttpServletResponse response;
	private CsrfTokenRequestHandler csrfTokenRequestHandler;
	private DeferredCsrfToken deferredCsrfToken;

	@Before
	public void setUp() {
		userService = mock(UserService.class);
		StudioConfiguration studioConfiguration = mock(StudioConfiguration.class);
		EntitlementValidator entitlementValidator = mock(EntitlementValidator.class);
		CsrfTokenRepository csrfTokenRepository = mock(CsrfTokenRepository.class);
		csrfTokenRequestHandler = mock(CsrfTokenRequestHandler.class);
		request = mock(HttpServletRequest.class);
		response = mock(HttpServletResponse.class);
		uiService = new UiServiceImpl(userService, mock(UiServiceInternal.class), entitlementValidator,
			csrfTokenRepository, csrfTokenRequestHandler);
		uiService.setStudioConfiguration(studioConfiguration);

		CsrfToken csrfToken = mock(CsrfToken.class);
		deferredCsrfToken = mock(DeferredCsrfToken.class);
		when(csrfToken.getHeaderName()).thenReturn(XSRF_HEADER_NAME);
		when(csrfToken.getParameterName()).thenReturn(XSRF_PARAMETER_NAME);
		when(csrfToken.getToken()).thenReturn(XSRF_TOKEN);
		when(deferredCsrfToken.get()).thenReturn(csrfToken);
		when(csrfTokenRepository.loadDeferredToken(any(), any())).thenReturn(deferredCsrfToken);
		// The request handler masks the token and exposes it as a request attribute
		when(request.getAttribute(CsrfToken.class.getName())).thenReturn(csrfToken);

		when(request.getScheme()).thenReturn("https");
		when(request.getServerName()).thenReturn("localhost");
		when(request.getServerPort()).thenReturn(443);
		when(request.getRequestURI()).thenReturn("/studio/api/2/ui/bootstrap");
		when(request.getContextPath()).thenReturn("/studio");
		when(request.getCookies()).thenReturn(new Cookie[0]);

		when(studioConfiguration.getProperty(CONFIGURATION_ENVIRONMENT_ACTIVE)).thenReturn("authoring");
		when(studioConfiguration.getProperty(SECURITY_PASSWORD_REQUIREMENTS_MINIMUM_COMPLEXITY)).thenReturn("3");
		when(studioConfiguration.getProperty(STUDIO_COOKIE_USE_BASE_DOMAIN)).thenReturn("true");
		when(studioConfiguration.getProperty(CONFIGURATION_DEFAULT_LANGUAGE)).thenReturn("en");
		when(entitlementValidator.getDescription()).thenReturn("CrafterCMS");
	}

	@Test
	public void returnsGlobalContextForAnonymousUsers() throws Exception {
		try (MockedStatic<SecurityUtils> securityUtils = mockStatic(SecurityUtils.class)) {
			securityUtils.when(SecurityUtils::getCurrentUsername).thenReturn(null);

			UiBootstrap bootstrap = uiService.getBootstrap(request, response);

			assertEquals(XSRF_HEADER_NAME, bootstrap.getXsrfHeader());
			assertEquals(XSRF_PARAMETER_NAME, bootstrap.getXsrfArgument());
			assertEquals(XSRF_TOKEN, bootstrap.getXsrfToken());
			verify(csrfTokenRequestHandler).handle(request, response, deferredCsrfToken);
			assertEquals("authoring", bootstrap.getEnvironment());
			assertEquals(3, bootstrap.getPasswordRequirementsMinComplexity());
			assertEquals("CrafterCMS", bootstrap.getFooterHtml());
			assertEquals("en", bootstrap.getLanguage());
			assertEquals("studio", bootstrap.getStudioContext());
			assertEquals("https://localhost", bootstrap.getPreviewAppBaseUri());
			assertEquals("localhost", bootstrap.getCookieDomain());
			assertNull(bootstrap.getUser());
			assertNull(bootstrap.getSite());
		}
	}

	@Test
	public void selectsFirstSiteAndPrefersAdminRole() throws Exception {
		when(request.getCookies()).thenReturn(new Cookie[]{
			new Cookie(SITE_COOKIE_NAME, UNSET),
			new Cookie(LANGUAGE_COOKIE_NAME, "es")
		});
		Site site = mock(Site.class);
		when(site.getSiteId()).thenReturn("editorial");
		when(site.getName()).thenReturn("Editorial");
		when(userService.getCurrentUserSites()).thenReturn(List.of(site));
		when(userService.getCurrentUserSiteRoles("editorial")).thenReturn(List.of("author", "admin"));

		try (MockedStatic<SecurityUtils> securityUtils = mockStatic(SecurityUtils.class)) {
			securityUtils.when(SecurityUtils::getCurrentUsername).thenReturn("admin");

			UiBootstrap bootstrap = uiService.getBootstrap(request, response);

			assertEquals("admin", bootstrap.getUser());
			assertEquals("editorial", bootstrap.getSite());
			assertEquals("editorial", bootstrap.getSiteId());
			assertEquals("Editorial", bootstrap.getSiteTitle());
			assertEquals("admin", bootstrap.getRole());
			assertEquals("es", bootstrap.getLanguage());
			verify(response).addCookie(argThat(cookie ->
				SITE_COOKIE_NAME.equals(cookie.getName())
					&& "editorial".equals(cookie.getValue())
					&& "localhost".equals(cookie.getDomain())
					&& COOKIE_PATH.equals(cookie.getPath())));
		}
	}

	@Test
	public void keepsAnAuthorizedRequestedSite() throws Exception {
		when(request.getCookies()).thenReturn(new Cookie[]{
			new Cookie(SITE_COOKIE_NAME, "intranet"),
			new Cookie(LANGUAGE_COOKIE_NAME, UNSET)
		});
		Site firstSite = mock(Site.class);
		when(firstSite.getSiteId()).thenReturn("editorial");
		Site requestedSite = mock(Site.class);
		when(requestedSite.getSiteId()).thenReturn("intranet");
		when(requestedSite.getName()).thenReturn("Intranet");
		when(userService.getCurrentUserSites()).thenReturn(List.of(firstSite, requestedSite));
		when(userService.getCurrentUserSiteRoles("intranet")).thenReturn(List.of("author"));

		try (MockedStatic<SecurityUtils> securityUtils = mockStatic(SecurityUtils.class)) {
			securityUtils.when(SecurityUtils::getCurrentUsername).thenReturn("john");

			UiBootstrap bootstrap = uiService.getBootstrap(request, response);

			assertEquals("intranet", bootstrap.getSite());
			assertEquals("Intranet", bootstrap.getSiteTitle());
			assertEquals("author", bootstrap.getRole());
			assertEquals("en", bootstrap.getLanguage());
			verify(response, never()).addCookie(any());
		}
	}

}
