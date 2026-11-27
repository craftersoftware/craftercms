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
 * The request queue of the shared worker (utils/authTokenQueue.ts) and the scheduling of the session warning.
 * The race this guards: the worker checks the session shortly before the warning dialog opens (at
 * `sessionExpiresAt - warningLeadTime`), and a "Stay signed in" click that lands during a check used to be dropped, so
 * the session was never extended. An extend now waits for the in-flight request and runs right after it.
 */

import '../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { after, before, describe, it, mock } from 'node:test';
import { applyClientLocalExpiry } from './clientLocalExpiry.ts';
import type { ObtainAuthTokenResponse } from '../services/auth';

const {
	createAuthTokenQueue,
	getAccessTokenRefreshInterval,
	getNextRefreshDelay,
	getTokenSchedule,
	refreshAtFactor,
	sameSessionLimitWindowMs,
	sessionCleanupGraceMs,
	sessionWarningCheckpointLeadMs
} = await import('./authTokenQueue.ts');

const warningLeadTimeMs = 60 * 1000;
const token = (name: string) => ({ token: name, expiresAt: 0, sessionExpiresAt: null });

/**
 * A deferred request, so a test decides when it settles.
 */
function deferred() {
	let resolve: (value: ObtainAuthTokenResponse) => void;
	let reject: (reason?: unknown) => void;
	const promise = new Promise<ObtainAuthTokenResponse>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function createQueue(
	requests: { obtain: Promise<ObtainAuthTokenResponse>[]; extend: Promise<ObtainAuthTokenResponse>[] },
	onToken?: (token: ObtainAuthTokenResponse) => void
) {
	const events: string[] = [];
	const logs: string[] = [];
	const callbacks = {
		obtain: () => {
			const request = requests.obtain.shift();
			assert.ok(request, 'Unexpected obtain request');
			events.push('obtain');
			return request;
		},
		extend: (xsrfToken: string) => {
			const request = requests.extend.shift();
			assert.ok(request, 'Unexpected extend request');
			events.push(`extend:${xsrfToken}`);
			return request;
		},
		onToken: (newToken) => {
			events.push(`token:${newToken.token}`);
			onToken?.(newToken);
		},
		onUnauthenticated: () => events.push('unauthenticated'),
		onError: (error: { status?: number }) => events.push(`error:${error.status}`),
		log: (message) => logs.push(message)
	};
	return { queue: createAuthTokenQueue(callbacks), events, logs };
}

describe('getNextRefreshDelay', () => {
	it('checks the session before the warning is due when nothing else is due sooner', () => {
		const now = 1_000_000;
		const sessionExpiresAt = now + 10 * 60 * 1000;
		const delay = getNextRefreshDelay({ sessionExpiresAt }, 60 * 60 * 1000, warningLeadTimeMs, now);
		assert.equal(delay, 10 * 60 * 1000 - warningLeadTimeMs - sessionWarningCheckpointLeadMs);
		assert.equal(now + delay, sessionExpiresAt - warningLeadTimeMs - 5000);
	});

	it('keeps the regular refresh when it comes before the warning checkpoint', () => {
		const now = 1_000_000;
		const delay = getNextRefreshDelay({ sessionExpiresAt: now + 30 * 60 * 1000 }, 60 * 1000, warningLeadTimeMs, now);
		assert.equal(delay, 60 * 1000);
	});

	it('checks again after the session should have expired', () => {
		const now = 1_000_000;
		const sessionExpiresAt = now + 5 * 1000;
		// The warning checkpoint is in the past, so the next check is after the expected expiration
		const delay = getNextRefreshDelay({ sessionExpiresAt }, 10 * 60 * 1000, warningLeadTimeMs, now);
		assert.equal(delay, 5 * 1000 + sessionCleanupGraceMs);
	});

	it('falls back to the regular refresh without a session expiry (20 h or more, or unknown)', () => {
		assert.equal(getNextRefreshDelay({ sessionExpiresAt: null }, 90 * 1000, warningLeadTimeMs, 0), 90 * 1000);
		assert.equal(getNextRefreshDelay({}, 90 * 1000, warningLeadTimeMs, 0), 90 * 1000);
	});

	it('schedules from the server seconds remaining when the client clock is behind', () => {
		const now = 1_000_000;
		const skewMs = 90 * 1000;
		const expiresIn = 600;
		const sessionExpiresIn = 10 * 60;
		// Absolute instants as a slow client would read them: the server clock is 90s ahead.
		const absoluteExpiresAt = now + skewMs + expiresIn * 1000;
		const absoluteSessionExpiresAt = now + skewMs + sessionExpiresIn * 1000;
		const local = applyClientLocalExpiry(
			{ expiresAt: absoluteExpiresAt, expiresIn, sessionExpiresAt: absoluteSessionExpiresAt, sessionExpiresIn },
			now
		);

		assert.equal(getAccessTokenRefreshInterval(local.expiresAt, now), expiresIn * 1000 * refreshAtFactor);
		assert.ok(
			getAccessTokenRefreshInterval(absoluteExpiresAt, now) > getAccessTokenRefreshInterval(local.expiresAt, now)
		);
		const delay = getNextRefreshDelay(local, 60 * 60 * 1000, warningLeadTimeMs, now);
		assert.equal(delay, sessionExpiresIn * 1000 - warningLeadTimeMs - sessionWarningCheckpointLeadMs);

		// A second pass, after the seconds were dropped at receipt, does not move the expiry.
		const later = now + 5 * 1000;
		assert.equal(applyClientLocalExpiry(local, later).sessionExpiresAt, local.sessionExpiresAt);
	});

	it('falls back to the absolute timestamp when the server omits the seconds remaining', () => {
		const now = 1_000_000;
		const expiresAt = now + 600 * 1000;
		const sessionExpiresAt = now + 10 * 60 * 1000;
		const local = applyClientLocalExpiry({ expiresAt, sessionExpiresAt }, now);

		assert.equal(local.expiresAt, expiresAt);
		assert.equal(local.sessionExpiresAt, sessionExpiresAt);
		assert.equal(getAccessTokenRefreshInterval(local.expiresAt, now), 600 * 1000 * refreshAtFactor);
	});
});

describe('getTokenSchedule', () => {
	it('schedules from the client clock when the server clock is 90s ahead', () => {
		const now = 1_000_000;
		const skewMs = 90 * 1000;
		const expiresIn = 600;
		const sessionExpiresIn = 90;
		const token = {
			token: 't',
			expiresAt: now + skewMs + expiresIn * 1000,
			expiresIn,
			sessionExpiresAt: now + skewMs + sessionExpiresIn * 1000,
			sessionExpiresIn
		};

		const schedule = getTokenSchedule(token, warningLeadTimeMs, now);
		const unconvertedRefresh = getAccessTokenRefreshInterval(token.expiresAt, now);
		const unconvertedDelay = getNextRefreshDelay(token, unconvertedRefresh, warningLeadTimeMs, now);

		// The warning checkpoint is due before the regular refresh, so the delay is the session countdown. Comparing
		// the server's absolute timestamps with this clock instead would schedule both the refresh and the warning
		// 90s late.
		assert.equal(schedule.current.expiresAt, now + expiresIn * 1000);
		assert.equal(schedule.current.sessionExpiresAt, now + sessionExpiresIn * 1000);
		assert.equal(schedule.refreshInterval, expiresIn * 1000 * refreshAtFactor);
		assert.equal(schedule.delay, sessionExpiresIn * 1000 - warningLeadTimeMs - sessionWarningCheckpointLeadMs);
		assert.notEqual(schedule.refreshInterval, unconvertedRefresh);
		assert.notEqual(schedule.delay, unconvertedDelay);
	});

	it('keeps the previous session expiry when a refresh reports the same limit', () => {
		const now = 1_000_000;
		const first = getTokenSchedule(
			{
				token: 'a',
				expiresAt: now + 90_000 + 600_000,
				expiresIn: 600,
				sessionExpiresAt: now + 90_000 + 30_000,
				sessionExpiresIn: 30
			},
			warningLeadTimeMs,
			now
		);
		assert.equal(first.current.sessionExpiresAt, now + 30_000);

		// 5.3s later the server floors the same limit to 25s, which would land 300ms later than the value above.
		const later = now + 5300;
		const refreshed = getTokenSchedule(
			{
				token: 'b',
				expiresAt: now + 90_000 + 600_000,
				expiresIn: 595,
				sessionExpiresAt: now + 90_000 + 30_000,
				sessionExpiresIn: 25
			},
			warningLeadTimeMs,
			later,
			first.current
		);

		assert.equal(later + 25_000 - first.current.sessionExpiresAt, 300);
		assert.ok(later + 25_000 - first.current.sessionExpiresAt < sameSessionLimitWindowMs);
		assert.equal(refreshed.current.sessionExpiresAt, first.current.sessionExpiresAt);
	});

	it('adopts a new session expiry when the limit is extended', () => {
		const now = 1_000_000;
		const first = getTokenSchedule(
			{
				token: 'a',
				expiresAt: now + 600_000,
				expiresIn: 600,
				sessionExpiresAt: now + 30_000,
				sessionExpiresIn: 30
			},
			warningLeadTimeMs,
			now
		);
		const later = now + 5300;
		const extendedByMs = 8 * 60 * 60 * 1000;
		const extended = getTokenSchedule(
			{
				token: 'b',
				expiresAt: later + 600_000,
				expiresIn: 600,
				sessionExpiresAt: later + extendedByMs,
				sessionExpiresIn: extendedByMs / 1000
			},
			warningLeadTimeMs,
			later,
			first.current
		);

		assert.equal(extended.current.sessionExpiresAt, later + extendedByMs);
		assert.notEqual(extended.current.sessionExpiresAt, first.current.sessionExpiresAt);
	});
});

describe('createAuthTokenQueue', () => {
	before(() => mock.timers.enable({ apis: ['setInterval', 'Date'], now: 1_000_000 }));
	after(() => mock.timers.reset());

	it('runs an extend that arrives during an in-flight refresh right after it', async () => {
		const inFlight = deferred();
		const { queue, events, logs } = createQueue({
			obtain: [inFlight.promise],
			extend: [Promise.resolve(token('new'))]
		});

		queue.retrieve();
		assert.equal(queue.isRetrieving(), true);

		// The click lands while the warning checkpoint is open
		queue.retrieve('xsrf-1');
		assert.equal(queue.getPendingExtend(), 'xsrf-1');
		// The extend did not start, it is waiting for the in-flight request
		assert.deepEqual(events, ['obtain']);

		inFlight.resolve(token('refreshed'));
		await flush();

		assert.deepEqual(events, ['obtain', 'token:refreshed', 'extend:xsrf-1', 'token:new']);
		assert.deepEqual(logs, ['Request in flight, the session extension will run after it']);
		assert.equal(queue.getPendingExtend(), undefined);
	});

	it('extends at once when no request is in flight', async () => {
		const { queue, events } = createQueue({ obtain: [], extend: [Promise.resolve(token('extended'))] });

		queue.retrieve('xsrf-1');
		await flush();

		assert.deepEqual(events, ['extend:xsrf-1', 'token:extended']);
	});

	it('only runs one extension for a double click', async () => {
		const inFlight = deferred();
		const { queue, events } = createQueue({
			obtain: [inFlight.promise],
			extend: [Promise.resolve(token('extended'))]
		});

		queue.retrieve();
		queue.retrieve('xsrf-1');
		queue.retrieve('xsrf-2');

		inFlight.resolve(token('refreshed'));
		await flush();

		// The second click replaced the queued token, so exactly one extension runs
		assert.deepEqual(events, ['obtain', 'token:refreshed', 'extend:xsrf-2', 'token:extended']);
	});

	it('still runs a queued extend when the in-flight request fails with a server error', async () => {
		const inFlight = deferred();
		const { queue, events } = createQueue({ obtain: [inFlight.promise], extend: [Promise.resolve(token('extended'))] });

		queue.retrieve();
		queue.retrieve('xsrf-1');
		inFlight.reject({ status: 500 });
		await flush();

		assert.deepEqual(events, ['obtain', 'error:500', 'extend:xsrf-1', 'token:extended']);
	});

	it('drops a queued extend when the session is gone', async () => {
		const inFlight = deferred();
		const { queue, events } = createQueue({ obtain: [inFlight.promise], extend: [] });

		queue.retrieve();
		queue.retrieve('xsrf-1');
		inFlight.reject({ status: 401 });
		await flush();

		assert.deepEqual(events, ['obtain', 'unauthenticated']);
		assert.equal(queue.getPendingExtend(), undefined);
	});

	it('drops a queued extend that is explicitly cleared (logout)', async () => {
		const inFlight = deferred();
		const { queue, events } = createQueue({ obtain: [inFlight.promise], extend: [] });

		queue.retrieve();
		queue.retrieve('xsrf-1');
		queue.clearPendingExtend();
		inFlight.resolve(token('refreshed'));
		await flush();

		assert.deepEqual(events, ['obtain', 'token:refreshed']);
	});

	it('treats an empty response as an expired session', async () => {
		const { queue, events } = createQueue({ obtain: [Promise.resolve(null)], extend: [] });

		queue.retrieve();
		await flush();

		assert.deepEqual(events, ['obtain', 'unauthenticated']);
	});

	it('retries the extend after a failure once the user clicks again', async () => {
		const failing = deferred();
		const { queue, events } = createQueue({
			obtain: [],
			extend: [failing.promise, Promise.resolve(token('extended'))]
		});

		queue.retrieve('xsrf-1');
		failing.reject({ status: 500 });
		await flush();
		assert.deepEqual(events, ['extend:xsrf-1', 'error:500']);
		assert.equal(queue.isRetrieving(), false);

		queue.retrieve('xsrf-2');
		await flush();
		assert.deepEqual(events, ['extend:xsrf-1', 'error:500', 'extend:xsrf-2', 'token:extended']);
	});

	it('logs a queued extend so it is visible in the worker debug output', async () => {
		const inFlight = deferred();
		const { queue, logs } = createQueue({ obtain: [inFlight.promise], extend: [Promise.resolve(token('extended'))] });

		queue.retrieve();
		queue.retrieve('xsrf-1');

		assert.deepEqual(logs, ['Request in flight, the session extension will run after it']);
		inFlight.resolve(token('refreshed'));
		await flush();
	});

	it('drops an extend requested while an extend is in flight, so only one extension is used', async () => {
		const inFlight = deferred();
		const { queue, events, logs } = createQueue({
			obtain: [],
			extend: [inFlight.promise, Promise.resolve(token('second-extend'))]
		});

		queue.retrieve('xsrf-tab-1');
		// A second tab clicks Stay signed in while the first extension is still in flight
		queue.retrieve('xsrf-tab-2');
		assert.equal(queue.getPendingExtend(), undefined);

		inFlight.resolve(token('first-extend'));
		await flush();

		assert.deepEqual(events, ['extend:xsrf-tab-1', 'token:first-extend']);
		assert.ok(logs.includes('The session extension already in flight will extend the session'));
	});

	it('counts consecutive failures, resets on success, and still retries afterwards', async () => {
		const failures = [deferred(), deferred(), deferred(), deferred()];
		const { queue, events } = createQueue({
			obtain: [
				failures[0].promise,
				failures[1].promise,
				failures[2].promise,
				Promise.resolve(token('recovered')),
				failures[3].promise
			],
			extend: []
		});

		for (let i = 0; i < 3; i++) {
			assert.equal(queue.shouldRetry(), true, `retry allowed before failure ${i + 1}`);
			queue.retrieve();
			failures[i].reject({ status: 500 + i });
			await flush();
		}
		assert.equal(queue.getRetries(), 3);
		assert.equal(queue.shouldRetry(), false, 'not retried after 3 consecutive failures');

		queue.retrieve();
		await flush();
		assert.equal(queue.getRetries(), 0, 'reset by the successful request');
		assert.equal(queue.shouldRetry(), true);

		queue.retrieve();
		failures[3].reject({ status: 504 });
		await flush();
		assert.equal(queue.getRetries(), 1);
		assert.equal(queue.shouldRetry(), true, 'still retried after a failure that follows a success');

		assert.deepEqual(
			events.filter((event) => event !== 'obtain'),
			['error:500', 'error:501', 'error:502', 'token:recovered', 'error:504']
		);
	});

	it('resets the failure count when the session is gone', async () => {
		const first = deferred();
		const second = deferred();
		const { queue } = createQueue({ obtain: [first.promise, second.promise], extend: [] });

		queue.retrieve();
		first.reject({ status: 500 });
		await flush();
		assert.equal(queue.getRetries(), 1);

		queue.retrieve();
		second.reject({ status: 401 });
		await flush();
		assert.equal(queue.getRetries(), 0);
		assert.equal(queue.shouldRetry(), true);
	});

	it('treats an exception thrown by onToken as a callback error, not a failed request', async () => {
		const { queue, events, logs } = createQueue({ obtain: [Promise.resolve(token('first'))], extend: [] }, () => {
			throw new Error('callback failed');
		});

		queue.retrieve();
		await flush();

		assert.equal(queue.isRetrieving(), false);
		assert.equal(queue.getRetries(), 0, 'the request itself succeeded, so it is not a request error');
		assert.deepEqual(
			events.filter((event) => event !== 'obtain'),
			['token:first'],
			'onError was not called'
		);
		assert.equal(logs.length, 1);
		assert.match(logs[0], /Token callback failed/);
	});
});
