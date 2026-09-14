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
package org.craftercms.studio.impl.v2.security.listener;

import java.beans.ConstructorProperties;

import org.craftercms.commons.http.RequestContext;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v2.dal.User;
import org.craftercms.studio.api.v2.event.user.DisabledUserEvent;
import org.craftercms.studio.api.v2.event.user.UserUpdatedEvent;
import org.craftercms.studio.api.v2.service.security.AccessTokenService;
import org.springframework.context.event.EventListener;
import org.springframework.security.authentication.event.AuthenticationSuccessEvent;
import org.springframework.security.authentication.event.LogoutSuccessEvent;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.preauth.PreAuthenticatedAuthenticationToken;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Listener for Spring's {@link AuthenticationSuccessEvent} that generates an access token for the user
 *
 * @author joseross
 * @since 4.0
 */
public class AccessTokenAuthenticationListener {

	protected AccessTokenService accessTokenService;

	@ConstructorProperties({"accessTokenService"})
	public AccessTokenAuthenticationListener(AccessTokenService accessTokenService) {
		this.accessTokenService = accessTokenService;
	}

	@EventListener
	public void refreshAuthCookies(AuthenticationSuccessEvent event) throws ServiceLayerException {
		Authentication authentication = event.getAuthentication();
		// Don't change any tokens for pre-authenticated events
		if (authentication instanceof PreAuthenticatedAuthenticationToken) {
			return;
		}
		HttpServletRequest request = RequestContext.getCurrent().getRequest();
		HttpServletResponse response = RequestContext.getCurrent().getResponse();
		accessTokenService.updateRefreshToken(authentication, response);
		accessTokenService.refreshPreviewCookie(authentication, request, response);
	}

	@EventListener
	public void deleteTokens(LogoutSuccessEvent event) {
		// Don't change any tokens for pre-authenticated events
		if (event.getAuthentication() instanceof PreAuthenticatedAuthenticationToken) {
			return;
		}
		long userId = ((User) event.getAuthentication().getPrincipal()).getId();
		accessTokenService.deleteRefreshToken(userId);
		accessTokenService.deletePreviewCookie(RequestContext.getCurrent().getResponse());
	}

	@EventListener
	public void onUserDisabled(DisabledUserEvent event) {
		accessTokenService.deleteUsersTokens(event.getUserIds());
	}

}
