/*
 * Copyright (C) 2007-2022 Crafter Software Corporation. All Rights Reserved.
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
package org.craftercms.studio.controller.web;

import org.craftercms.studio.api.v2.service.security.AccessTokenService;
import org.craftercms.studio.model.AuthenticatedUser;
import org.craftercms.studio.model.security.AccessToken;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.beans.ConstructorProperties;
import java.io.IOException;
import java.util.Map;

import static org.springframework.http.MediaType.APPLICATION_JSON_VALUE;

/**
 * Controller that handles the refresh of the tokens
 *
 * @author joseross
 * @since 3.2
 */
@RestController
public class AccessTokenController {

	protected AccessTokenService accessTokenService;

	@ConstructorProperties({"accessTokenService"})
	public AccessTokenController(AccessTokenService accessTokenService) {
		this.accessTokenService = accessTokenService;
	}

	@GetMapping(value = "/refresh", produces = APPLICATION_JSON_VALUE)
	public AccessToken refreshToken(Authentication authentication, HttpServletRequest request,
					HttpServletResponse response) throws Exception {
		return refreshToken(authentication, request, response, false);
	}

	/**
	 * Refreshes the tokens and extends the session, which changes state so it requires the CSRF token
	 */
	@PostMapping(value = "/refresh", produces = APPLICATION_JSON_VALUE)
	public AccessToken extendSession(Authentication authentication, HttpServletRequest request,
					 HttpServletResponse response) throws Exception {
		return refreshToken(authentication, request, response, true);
	}

	protected AccessToken refreshToken(Authentication authentication, HttpServletRequest request,
					   HttpServletResponse response, boolean extendSession) throws Exception {
		// If the session has expired, return an empty response
		if (authentication == null || authentication instanceof AnonymousAuthenticationToken ||
			!accessTokenService.hasValidRefreshToken(authentication, request, response)) {
			response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
			response.flushBuffer();
			return null;
		}

		return accessTokenService.createTokens(authentication, request, response, extendSession);
	}

	@GetMapping(value = "/authType", produces = APPLICATION_JSON_VALUE)
	public Object authType(Authentication authentication, HttpServletResponse response)
		throws IOException {
		// If the session has expired, return an empty response
		if (authentication == null || authentication instanceof AnonymousAuthenticationToken) {
			response.setStatus(HttpServletResponse.SC_OK);
			response.flushBuffer();
			return null;
		}

		return Map.of("authType", ((AuthenticatedUser) authentication.getPrincipal()).getAuthenticationType());
	}

}
