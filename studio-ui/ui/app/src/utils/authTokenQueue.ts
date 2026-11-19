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

import type { Observable } from 'rxjs';
import type { ObtainAuthTokenResponse } from '../services/auth';
import { applyClientLocalExpiry } from './clientLocalExpiry';

/**
 * Fraction of the token lifetime at which it is refreshed.
 */
export const refreshAtFactor = 0.5;
/**
 * The server removes expired sessions once a minute, so they can outlive `sessionExpiresAt` by up to that long.
 */
export const sessionCleanupGraceMs = 61 * 1000;
/**
 * How long before the warning is due the session is checked, so the check has landed (and any activity extended the
 * session) before tabs decide whether to open the warning, which would otherwise open and close right away.
 */
export const sessionWarningCheckpointLeadMs = 5000;

/**
 * Half of the access token's remaining lifetime. `expiresAt` is a client-local expiry (the server's seconds remaining,
 * added to the clock at receipt), so this does not compare the server's absolute timestamp with the client clock.
 */
export function getAccessTokenRefreshInterval(expiresAt: number, now = Date.now()): number {
	return Math.floor((expiresAt - now) * refreshAtFactor);
}

/**
 * Delay before the next token refresh: the regular one, or sooner to check the session right before the warning is due
 * (so tabs warn based on up to date information, as the session may have been extended by activity) and right after it
 * should have expired. `sessionExpiresAt` is a client-local expiry derived from the server's seconds remaining.
 */
export function getNextRefreshDelay(
	current: Pick<ObtainAuthTokenResponse, 'sessionExpiresAt'>,
	refreshInterval: number,
	warningLeadTimeMs: number,
	now = Date.now()
): number {
	if (current.sessionExpiresAt) {
		const checkpoints = [
			current.sessionExpiresAt - warningLeadTimeMs - sessionWarningCheckpointLeadMs,
			current.sessionExpiresAt + sessionCleanupGraceMs
		].filter((checkpoint) => checkpoint > now);
		if (checkpoints.length) {
			return Math.min(refreshInterval, checkpoints[0] - now);
		}
	}
	return refreshInterval;
}

/**
 * How far a newly received client-local session expiry may sit from the previous one and still be the same server
 * limit. The server counts whole seconds and each response is re-based on the clock at receipt, so a routine refresh
 * lands up to about a second off, plus a little delay before the response is read. A real extension moves the limit
 * by minutes.
 */
export const sameSessionLimitWindowMs = 2000;

/**
 * The client-local token, the access-token refresh interval, and the delay until the next refresh.
 *
 * `sessionExpiresAt` is kept from `previous` when the new value is within `sameSessionLimitWindowMs`. AuthMonitor and
 * useSessionTimeoutWarning compare that value by equality, so a refresh that did not move the server limit must not
 * look like a new expiry. The countdown and the refresh delay still use the client-local value.
 */
export function getTokenSchedule(
	token: ObtainAuthTokenResponse,
	warningLeadTimeMs: number,
	receivedAt = Date.now(),
	previous?: Pick<ObtainAuthTokenResponse, 'sessionExpiresAt'> | null
): { current: ObtainAuthTokenResponse; refreshInterval: number; delay: number } {
	const local = applyClientLocalExpiry(token, receivedAt);
	const previousSessionExpiresAt = previous?.sessionExpiresAt;
	const current =
		previousSessionExpiresAt != null &&
		local.sessionExpiresAt != null &&
		Math.abs(local.sessionExpiresAt - previousSessionExpiresAt) < sameSessionLimitWindowMs
			? { ...local, sessionExpiresAt: previousSessionExpiresAt }
			: local;
	const refreshInterval = getAccessTokenRefreshInterval(current.expiresAt, receivedAt);
	return {
		current,
		refreshInterval,
		delay: getNextRefreshDelay(current, refreshInterval, warningLeadTimeMs, receivedAt)
	};
}

/**
 * A request for tokens, either a promise or an observable.
 */
export type TokenRequest = Promise<ObtainAuthTokenResponse> | Pick<Observable<ObtainAuthTokenResponse>, 'subscribe'>;

export interface AuthTokenQueueCallbacks {
	/** Gets new tokens. */
	obtain: () => TokenRequest;
	/** Gets new tokens and extends the limit the user is being warned about. */
	extend: (xsrfToken: string) => TokenRequest;
	/** Called with each new set of tokens. */
	onToken: (token: ObtainAuthTokenResponse) => void;
	/** Called when the session is gone (a 401 or an empty response). */
	onUnauthenticated: () => void;
	/** Called when a request failed for any other reason. */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	onError: (error: any) => void;
	log: (message: string) => void;
}

export interface AuthTokenQueue {
	/** Refreshes the tokens, or extends the session if an XSRF token is given. */
	retrieve: (extendXsrfToken?: string) => void;
	/** Indicates if a request is in flight. */
	isRetrieving: () => boolean;
	/** Indicates if an extension is waiting for the in-flight request. */
	getPendingExtend: () => string;
	/** Drops a queued extension, used when the session is gone. */
	clearPendingExtend: () => void;
	/** Number of consecutive failed requests since the last successful one. */
	getRetries: () => number;
	/** Indicates whether a failed request should be retried (up to `maxRetries` in a row). */
	shouldRetry: () => boolean;
}

/**
 * Number of consecutive failed requests after which requests are not retried until one succeeds.
 */
export const maxRetries = 3;

/**
 * Serializes the requests for new tokens, so the warning checkpoint and an extension requested by the user don't
 * overlap. An extension requested while another request is in flight runs as soon as that one finishes, so a click on
 * "Stay signed in" is never dropped.
 */
export function createAuthTokenQueue(callbacks: AuthTokenQueueCallbacks): AuthTokenQueue {
	let isRetrieving = false;
	let isRetrievingExtend = false;
	let pendingExtendXsrfToken: string;
	// Consecutive failures, reset whenever a request succeeds or the session is gone
	let retries = 0;

	const toPromise = (request: TokenRequest) =>
		request instanceof Promise
			? request
			: new Promise<ObtainAuthTokenResponse>((resolve, reject) => request.subscribe({ next: resolve, error: reject }));

	const runPendingExtend = () => {
		const xsrfToken = pendingExtendXsrfToken;
		pendingExtendXsrfToken = undefined;
		if (xsrfToken) {
			retrieve(xsrfToken);
		}
	};

	const retrieve = (extendXsrfToken?: string) => {
		if (isRetrieving) {
			if (extendXsrfToken) {
				if (isRetrievingExtend) {
					// Two extensions in a row would use two of the limited extensions, and the first one is enough
					callbacks.log('The session extension already in flight will extend the session');
					return;
				}
				callbacks.log('Request in flight, the session extension will run after it');
				pendingExtendXsrfToken = extendXsrfToken;
			}
			return;
		}
		isRetrieving = true;
		isRetrievingExtend = extendXsrfToken != null;
		toPromise(extendXsrfToken != null ? callbacks.extend(extendXsrfToken) : callbacks.obtain()).then(
			(token) => {
				isRetrieving = false;
				isRetrievingExtend = false;
				retries = 0;
				if (token) {
					// A failing callback must not look like a failed request, nor stop the queue
					try {
						callbacks.onToken(token);
					} catch (callbackError) {
						callbacks.log(`Token callback failed: ${callbackError}`);
					}
				} else {
					pendingExtendXsrfToken = undefined;
					callbacks.onUnauthenticated();
				}
				runPendingExtend();
			},
			// The rejection handler as the second argument (not a catch), so an exception thrown by the callbacks is
			// not treated as a failed request
			(error) => {
				isRetrieving = false;
				isRetrievingExtend = false;
				if (error?.status === 401) {
					// The session is gone, so there is nothing to extend
					retries = 0;
					pendingExtendXsrfToken = undefined;
					callbacks.onUnauthenticated();
				} else {
					retries++;
					callbacks.onError(error);
					runPendingExtend();
				}
			}
		);
	};

	return {
		retrieve,
		isRetrieving: () => isRetrieving,
		getPendingExtend: () => pendingExtendXsrfToken,
		clearPendingExtend: () => (pendingExtendXsrfToken = undefined),
		getRetries: () => retries,
		shouldRetry: () => retries < maxRetries
	};
}
