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
 * Auth state stores a client-local session expiry. The seconds remaining from the server win over the absolute
 * timestamp, so a client clock that is behind the server does not shorten the warning.
 */

import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { after, before, describe, it, mock } from 'node:test';

const clientNow = 1_700_000_000_000;
const { default: reducer, initialState } = await import('./auth.ts');
const { refreshAuthTokenComplete } = await import('../actions/auth.ts');
const { storeInitialized } = await import('../actions/system.ts');

const skewMs = 90 * 1000;
const expiresIn = 600;
const sessionExpiresIn = 90;

function serverToken(overrides: Record<string, unknown> = {}) {
	return {
		token: 'access-token',
		expiresAt: clientNow + skewMs + expiresIn * 1000,
		expiresIn,
		sessionExpiresAt: clientNow + skewMs + sessionExpiresIn * 1000,
		sessionExpiresIn,
		canExtendSession: true,
		...overrides
	};
}

describe('auth reducer session expiry', () => {
	before(() => mock.timers.enable({ apis: ['Date'], now: clientNow }));
	after(() => mock.timers.reset());

	it('stores client-local expiries from the server seconds remaining when the client clock is behind', () => {
		const raw = serverToken();
		const state = reducer(initialState, refreshAuthTokenComplete(raw));

		assert.equal(state.expiresAt, clientNow + expiresIn * 1000);
		assert.equal(state.sessionExpiresAt, clientNow + sessionExpiresIn * 1000);
		assert.notEqual(state.sessionExpiresAt, raw.sessionExpiresAt);
		assert.equal(state.canExtendSession, true);
		assert.equal(state.active, true);
	});

	it('stores the same client-local expiry when the worker delivers the first token', () => {
		const state = reducer(initialState, storeInitialized({ auth: serverToken({ canExtendSession: false }) }));

		assert.equal(state.expiresAt, clientNow + expiresIn * 1000);
		assert.equal(state.sessionExpiresAt, clientNow + sessionExpiresIn * 1000);
		assert.equal(state.canExtendSession, false);
	});

	it('falls back to the absolute timestamp when the seconds remaining are missing', () => {
		const expiresAt = clientNow + 50_000;
		const sessionExpiresAt = clientNow + 80_000;
		const state = reducer(
			initialState,
			refreshAuthTokenComplete({
				token: 'access-token',
				expiresAt,
				sessionExpiresAt,
				canExtendSession: true
			})
		);

		assert.equal(state.expiresAt, expiresAt);
		assert.equal(state.sessionExpiresAt, sessionExpiresAt);
	});

	it('falls back to an absolute timestamp sent as a date string', () => {
		const sessionExpiresAt = clientNow + 80_000;
		const state = reducer(
			initialState,
			refreshAuthTokenComplete({
				token: 'access-token',
				expiresAt: new Date(clientNow + 50_000).toISOString(),
				sessionExpiresAt: new Date(sessionExpiresAt).toISOString()
			})
		);

		assert.equal(state.expiresAt, clientNow + 50_000);
		assert.equal(state.sessionExpiresAt, sessionExpiresAt);
	});

	it('keeps a missing session expiry missing', () => {
		const state = reducer(
			initialState,
			refreshAuthTokenComplete({
				token: 'access-token',
				expiresAt: clientNow + 50_000,
				expiresIn: 50,
				sessionExpiresAt: null,
				sessionExpiresIn: null
			})
		);

		assert.equal(state.expiresAt, clientNow + 50 * 1000);
		assert.equal(state.sessionExpiresAt, null);
		assert.equal(state.canExtendSession, true);
	});
});
