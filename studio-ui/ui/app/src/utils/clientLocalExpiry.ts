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

/**
 * A token as the server sends it: absolute instants, plus the seconds remaining counted on the server clock.
 * The seconds are optional so a response from an older server still works.
 */
export interface ServerExpiry {
	expiresAt?: number | string | null;
	expiresIn?: number | null;
	sessionExpiresAt?: number | string | null;
	sessionExpiresIn?: number | null;
}

/**
 * Client-local epoch millis for an expiry. Prefers the server's seconds remaining (`now + seconds * 1000`), so a
 * skewed client clock does not shorten the session warning or the token refresh (WCAG 2.1 SC 2.2.1). Falls back to
 * the absolute timestamp when the seconds are missing.
 */
export function clientLocalExpiry(
	secondsRemaining: number | null | undefined,
	absoluteTimestamp: number | string | null | undefined,
	now: number
): number | null {
	if (typeof secondsRemaining === 'number' && Number.isFinite(secondsRemaining)) {
		return now + secondsRemaining * 1000;
	}
	return absoluteMillis(absoluteTimestamp);
}

function absoluteMillis(value: number | string | null | undefined): number | null {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === 'string' && value) {
		const parsed = new Date(value).getTime();
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
}

/**
 * Copies a token with client-local `expiresAt` and `sessionExpiresAt`, and drops the seconds remaining so a second
 * pass keeps the expiry that was captured at receipt.
 */
export function applyClientLocalExpiry<T extends ServerExpiry>(token: T, now = Date.now()): T {
	const local = {
		...token,
		expiresAt: clientLocalExpiry(token.expiresIn, token.expiresAt, now),
		sessionExpiresAt: clientLocalExpiry(token.sessionExpiresIn, token.sessionExpiresAt, now)
	};
	// Drop the seconds so a later pass (the tab, after the worker) keeps the expiry captured at receipt.
	delete local.expiresIn;
	delete local.sessionExpiresIn;
	return local;
}
