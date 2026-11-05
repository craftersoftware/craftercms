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
package org.craftercms.studio.model.security;

import java.time.Instant;

/**
 * Holds the access token information for a user
 *
 * @author joseross
 * @since 3.2
 */
public class AccessToken {

	/**
	 * The value of the token
	 */
	protected String token;

	/**
	 * The date of expiration of the token
	 */
	protected Instant expiresAt;

	/**
	 * The earliest date in which the session of the user can expire, null if there is no time limit to warn about
	 */
	protected Instant sessionExpiresAt;

	public void setToken(String token) {
		this.token = token;
	}

	public void setExpiresAt(Instant expiresAt) {
		this.expiresAt = expiresAt;
	}

	public void setSessionExpiresAt(Instant sessionExpiresAt) {
		this.sessionExpiresAt = sessionExpiresAt;
	}

	public String getToken() {
		return token;
	}

	public Instant getExpiresAt() {
		return expiresAt;
	}

	public Instant getSessionExpiresAt() {
		return sessionExpiresAt;
	}

}
