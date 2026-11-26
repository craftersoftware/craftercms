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
	 * Seconds remaining until {@link #expiresAt}, counted on the server clock. Clients should count down from this
	 * instead of comparing {@link #expiresAt} with their own clock. Kept alongside the instant for older clients.
	 */
	protected Long expiresIn;

	/**
	 * The earliest date in which the session of the user can expire, null if there is no time limit to warn about
	 */
	protected Instant sessionExpiresAt;

	/**
	 * Seconds remaining until {@link #sessionExpiresAt}, counted on the server clock. Null when there is nothing to
	 * warn about. Clients should count down from this so a skewed client clock does not shorten the warning
	 * (WCAG 2.1 SC 2.2.1). Kept alongside the instant for older clients.
	 */
	protected Long sessionExpiresIn;

	/**
	 * Indicates if the user can still extend the session before it expires
	 */
	protected boolean canExtendSession = true;

	public void setToken(String token) {
		this.token = token;
	}

	public void setExpiresAt(Instant expiresAt) {
		this.expiresAt = expiresAt;
	}

	public void setExpiresIn(Long expiresIn) {
		this.expiresIn = expiresIn;
	}

	public void setSessionExpiresAt(Instant sessionExpiresAt) {
		this.sessionExpiresAt = sessionExpiresAt;
	}

	public void setSessionExpiresIn(Long sessionExpiresIn) {
		this.sessionExpiresIn = sessionExpiresIn;
	}

	public void setCanExtendSession(boolean canExtendSession) {
		this.canExtendSession = canExtendSession;
	}

	public String getToken() {
		return token;
	}

	public Instant getExpiresAt() {
		return expiresAt;
	}

	public Long getExpiresIn() {
		return expiresIn;
	}

	public Instant getSessionExpiresAt() {
		return sessionExpiresAt;
	}

	public Long getSessionExpiresIn() {
		return sessionExpiresIn;
	}

	public boolean isCanExtendSession() {
		return canExtendSession;
	}

}
