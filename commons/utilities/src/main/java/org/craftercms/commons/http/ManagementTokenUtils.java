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

import jakarta.servlet.http.HttpServletRequest;
import org.craftercms.commons.exceptions.InvalidManagementTokenException;
import org.craftercms.commons.rest.ManagementTokenResolver;

import static org.apache.commons.lang3.Strings.CS;

/**
 * Shared checks for the Crafter management token.
 */
public final class ManagementTokenUtils {

	public static final String INVALID_MANAGEMENT_TOKEN_MESSAGE = "Management authorization failed, invalid token.";

	private ManagementTokenUtils() {
	}

	/**
	 * Requires a management token on the request that matches {@code configuredToken}.
	 * The {@code X-Crafter-Management-Token} header is used when present; the {@code token} query parameter is used
	 * only when the header is absent. A blank or wrong header does not fall back to the query value.
	 *
	 * @param request         the current request
	 * @param configuredToken the expected token
	 * @throws InvalidManagementTokenException if the token is missing, blank, or does not match
	 */
	public static void validateToken(HttpServletRequest request, String configuredToken)
		throws InvalidManagementTokenException {
		validateToken(ManagementTokenResolver.resolve(request), configuredToken);
	}

	/**
	 * Requires {@code token} to be present and equal to {@code configuredToken}.
	 *
	 * @param token           the supplied token
	 * @param configuredToken the expected token
	 * @throws InvalidManagementTokenException if the token is missing, blank, or does not match
	 */
	public static void validateToken(String token, String configuredToken) throws InvalidManagementTokenException {
		if (token == null || token.isEmpty() || !CS.equals(token, configuredToken)) {
			throw new InvalidManagementTokenException(INVALID_MANAGEMENT_TOKEN_MESSAGE);
		}
	}

}
