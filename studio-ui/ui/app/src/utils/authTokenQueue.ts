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

import type { ObtainAuthTokenResponse } from '../services/auth';

/**
 * Fraction of the token lifetime at which it is refreshed.
 */
export const refreshAtFactor = 0.5;
/**
 * The server removes expired sessions once a minute, so they can outlive `sessionExpiresAt` by up to that long.
 */
export const sessionCleanupGraceMs = 61 * 1000;
/**
 * The extra time added to the warning checkpoint so tabs see the session as inside the warning window even if the
 * timer fires early.
 */
export const sessionWarningCheckpointOffsetMs = 1000;

/**
 * Delay before the next token refresh: the regular one, or sooner to check the session right after the warning is due
 * (so tabs warn based on up to date information, as the session may have been extended by activity) and right after it
 * should have expired.
 */
export function getNextRefreshDelay(
	current: Pick<ObtainAuthTokenResponse, 'sessionExpiresAt'>,
	refreshInterval: number,
	warningLeadTimeMs: number,
	now = Date.now()
): number {
	if (current.sessionExpiresAt) {
		const checkpoints = [
			current.sessionExpiresAt - warningLeadTimeMs + sessionWarningCheckpointOffsetMs,
			current.sessionExpiresAt + sessionCleanupGraceMs
		].filter((checkpoint) => checkpoint > now);
		if (checkpoints.length) {
			return Math.min(refreshInterval, checkpoints[0] - now);
		}
	}
	return refreshInterval;
}

export interface AuthTokenQueueCallbacks {
	/** Gets new tokens. */
	obtain: () => Promise<ObtainAuthTokenResponse> | { subscribe: Function };
	/** Gets new tokens and restarts the session time limits. */
	extend: (xsrfToken: string) => Promise<ObtainAuthTokenResponse> | { subscribe: Function };
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
}

/**
 * Serializes the requests for new tokens, so the warning checkpoint and an extension requested by the user don't
 * overlap. An extension requested while another request is in flight runs as soon as that one finishes, so a click on
 * "Stay signed in" is never dropped.
 */
export function createAuthTokenQueue(callbacks: AuthTokenQueueCallbacks): AuthTokenQueue {
	let isRetrieving = false;
	let pendingExtendXsrfToken: string;

	const toPromise = (request: Promise<ObtainAuthTokenResponse> | { subscribe: Function }) =>
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
				callbacks.log('Request in flight, the session extension will run after it');
				pendingExtendXsrfToken = extendXsrfToken;
			}
			return;
		}
		isRetrieving = true;
		toPromise(extendXsrfToken ? callbacks.extend(extendXsrfToken) : callbacks.obtain())
			.then((token) => {
				isRetrieving = false;
				if (token) {
					callbacks.onToken(token);
				} else {
					pendingExtendXsrfToken = undefined;
					callbacks.onUnauthenticated();
				}
				runPendingExtend();
			})
			.catch((error) => {
				isRetrieving = false;
				if (error?.status === 401) {
					// The session is gone, so there is nothing to extend
					pendingExtendXsrfToken = undefined;
					callbacks.onUnauthenticated();
				} else {
					callbacks.onError(error);
					runPendingExtend();
				}
			});
	};

	return {
		retrieve,
		isRetrieving: () => isRetrieving,
		getPendingExtend: () => pendingExtendXsrfToken,
		clearPendingExtend: () => (pendingExtendXsrfToken = undefined)
	};
}
