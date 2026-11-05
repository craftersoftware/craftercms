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
 * The race this guards: the warning dialog opens at `sessionExpiresAt - warningLeadTime`, the worker checks the session
 * about a second later, and a "Stay signed in" click that lands during that check used to be dropped, so the session
 * was never extended. An extend now waits for the in-flight request and runs right after it.
 */

import assert from 'node:assert/strict';
import { beforeEach, describe, it, mock } from 'node:test';
import {
	createAuthTokenQueue,
	getNextRefreshDelay,
	sessionCleanupGraceMs,
	sessionWarningCheckpointOffsetMs
} from './authTokenQueue.ts';

const warningLeadTimeMs = 60 * 1000;
const token = (name: string) => ({ token: name, expiresAt: 0, sessionExpiresAt: null });

/**
 * A deferred request, so a test decides when it settles.
 */
function deferred() {
	let resolve;
	let reject;
	const promise = new Promise((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function createQueue(requests: { obtain: any[]; extend: any[] }) {
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
		onToken: (newToken) => events.push(`token:${newToken.token}`),
		onUnauthenticated: () => events.push('unauthenticated'),
		onError: (error) => events.push(`error:${error.status}`),
		log: (message) => logs.push(message)
	};
	return { queue: createAuthTokenQueue(callbacks), events, logs };
}

describe('getNextRefreshDelay', () => {
	it('checks the session one second into the warning window when nothing else is due sooner', () => {
		const now = 1_000_000;
		const sessionExpiresAt = now + 10 * 60 * 1000;
		const delay = getNextRefreshDelay({ sessionExpiresAt }, 60 * 60 * 1000, warningLeadTimeMs, now);
		assert.equal(delay, 10 * 60 * 1000 - warningLeadTimeMs + sessionWarningCheckpointOffsetMs);
		assert.equal(now + delay, sessionExpiresAt - warningLeadTimeMs + 1000);
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
});

describe('createAuthTokenQueue', () => {
	beforeEach(() => mock.timers.reset());

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

	it('logs a skipped extend so it is visible in the worker debug output', () => {
		const inFlight = deferred();
		const { queue, logs } = createQueue({ obtain: [inFlight.promise], extend: [] });

		queue.retrieve();
		queue.retrieve('xsrf-1');

		assert.deepEqual(logs, ['Request in flight, the session extension will run after it']);
		inFlight.resolve(token('refreshed'));
	});
});
