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
package org.craftercms.studio.controller.rest.v2;

import jakarta.servlet.http.HttpServletRequest;
import org.apache.commons.lang3.StringUtils;
import org.craftercms.commons.exceptions.InvalidManagementTokenException;
import org.craftercms.commons.http.ManagementTokenUtils;
import org.craftercms.commons.rest.ManagementToken;
import org.craftercms.commons.rest.ManagementTokenResolver;
import org.craftercms.studio.api.v2.exception.InvalidParametersException;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import org.craftercms.studio.impl.v2.utils.security.SecurityUtils;

import java.util.Objects;

import static org.craftercms.studio.api.v2.utils.StudioConfiguration.CONFIGURATION_MANAGEMENT_AUTHORIZATION_TOKEN;

/**
 * Base class for all controllers that use the management token to protect public urls
 *
 * @author joseross
 * @since 4.0
 */
public abstract class ManagementTokenAware {

	protected final StudioConfiguration studioConfiguration;

	public ManagementTokenAware(StudioConfiguration studioConfiguration) {
		this.studioConfiguration = studioConfiguration;
	}

	protected void validateToken(HttpServletRequest request) throws InvalidManagementTokenException, InvalidParametersException {
		validateToken(request, false);
	}

	/**
	 * Validates the management token from the request against the configured one.
	 * The {@code X-Crafter-Management-Token} header is used when present; the {@code token} query parameter is used
	 * only when the header is absent. A blank or wrong header does not fall back to the query value.
	 * If requireToken is false, the token is validated only when there is no authenticated user in the current session.
	 *
	 * @param request      the current request
	 * @param requireToken if true, the token is always validated
	 * @throws InvalidManagementTokenException if the token is present but does not match
	 * @throws InvalidParametersException      if the token is required but neither the header nor the query parameter is present
	 */
	protected void validateToken(HttpServletRequest request, boolean requireToken)
		throws InvalidManagementTokenException, InvalidParametersException {
		if (requireToken || StringUtils.isEmpty(SecurityUtils.getCurrentUsername())) {
			String token = ManagementTokenResolver.resolve(request);
			if (Objects.isNull(token)) {
				throw new InvalidParametersException("Missing parameter: 'token'");
			}
			ManagementTokenUtils.validateToken(token, getConfiguredToken());
		}
	}

	/**
	 * Requires the value of {@link ManagementToken#HEADER_NAME}. A logged-in session does not replace it.
	 *
	 * @param token the header value
	 * @throws InvalidManagementTokenException if the header is missing or does not match the configured token
	 */
	protected void validateHeaderToken(String token) throws InvalidManagementTokenException {
		ManagementTokenUtils.validateToken(token, getConfiguredToken());
	}

	protected String getConfiguredToken() {
		return studioConfiguration.getProperty(CONFIGURATION_MANAGEMENT_AUTHORIZATION_TOKEN);
	}

}
