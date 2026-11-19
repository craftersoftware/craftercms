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
 * The session timeout warning state with fake timers.
 * The dialog dismisses on Close, Escape and backdrop clicks; the dismissal must last until the session is extended
 * or the next warning starts, and must not be cleared by the countdown ticking.
 */

import '../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it, mock } from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
const globals = ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'getComputedStyle', 'MutationObserver'];
const previous = new Map(globals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
globals.forEach((name) =>
	Object.defineProperty(globalThis, name, {
		value: (dom.window as unknown as Record<string, unknown>)[name],
		configurable: true,
		writable: true
	})
);
// React needs to know it can use act() outside of a browser
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { createElement } = await import('react');
const { createRoot } = await import('react-dom/client');
const { act } = await import('react');
const { useSessionTimeoutWarning } = await import('./useSessionTimeoutWarning.ts');
const { applyClientLocalExpiry } = await import('../utils/clientLocalExpiry.ts');
const { getTokenSchedule } = await import('../utils/authTokenQueue.ts');

const leadTime = 60 * 1000;
const now = Date.now();

interface Harness {
	state: { visible: boolean; secondsLeft: number; dismiss: () => void };
	render: (active: boolean, sessionExpiresAt: number) => Promise<void>;
	unmount: () => Promise<void>;
}

async function mountWarning(): Promise<{ host: HTMLElement; harness: Harness; unmount: () => Promise<void> }> {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	const harness = { state: null } as Harness;
	// One component for the whole test, so a re-render keeps the state like in the app
	function Probe(props: { active: boolean; sessionExpiresAt: number }) {
		harness.state = useSessionTimeoutWarning(props.active, props.sessionExpiresAt, leadTime);
		return null;
	}
	harness.render = async (active, sessionExpiresAt) => {
		await act(async () => root.render(createElement(Probe, { active, sessionExpiresAt })));
	};
	return {
		host,
		harness,
		unmount: async () => {
			await act(async () => root.unmount());
			host.remove();
		}
	};
}

describe('useSessionTimeoutWarning', () => {
	before(() => mock.timers.enable({ apis: ['setInterval', 'Date'], now }));
	after(() => {
		mock.timers.reset();
		globals.forEach((name) => {
			const descriptor = previous.get(name);
			if (descriptor) {
				Object.defineProperty(globalThis, name, descriptor);
			} else {
				delete (globalThis as Record<string, unknown>)[name];
			}
		});
	});
	beforeEach(() => mock.timers.reset());
	beforeEach(() => mock.timers.enable({ apis: ['setInterval', 'Date'], now }));

	it('stays hidden until the warning lead time', async () => {
		const { harness, unmount } = await mountWarning();
		await harness.render(true, now + leadTime + 20 * 1000);
		assert.equal(harness.state.visible, false);

		// Ticking down to 69 s left is still outside the 60 s window
		await act(async () => mock.timers.tick(11 * 1000));
		assert.equal(harness.state.visible, false);

		// Entering the window shows it
		await act(async () => mock.timers.tick(10 * 1000));
		assert.equal(harness.state.visible, true);

		await unmount();
	});

	it('opens the warning at the lead time and counts down', async () => {
		const { harness, unmount } = await mountWarning();
		await harness.render(true, now + leadTime + 1000);
		assert.equal(harness.state.visible, false);

		await act(async () => mock.timers.tick(1000));
		assert.equal(harness.state.visible, true);
		assert.equal(harness.state.secondsLeft, 60);

		await act(async () => mock.timers.tick(5000));
		assert.equal(harness.state.visible, true);
		assert.equal(harness.state.secondsLeft, 55);

		await unmount();
	});

	it('stays closed after Close, even while the countdown keeps ticking', async () => {
		const { harness, unmount } = await mountWarning();
		await harness.render(true, now + 30 * 1000);
		assert.equal(harness.state.visible, true);

		await act(async () => harness.state.dismiss());
		assert.equal(harness.state.visible, false);

		// This is the regression: the next ticks used to clear the dismissal and reopen the dialog
		await act(async () => mock.timers.tick(2000));
		assert.equal(harness.state.visible, false);

		await act(async () => mock.timers.tick(10 * 1000));
		assert.equal(harness.state.visible, false);

		await unmount();
	});

	it('stays closed when a refresh reports the same session expiry', async () => {
		const { harness, unmount } = await mountWarning();
		const sessionExpiresAt = now + 30 * 1000;
		await harness.render(true, sessionExpiresAt);
		await act(async () => harness.state.dismiss());
		assert.equal(harness.state.visible, false);

		// A routine refresh lands with the same expiry
		await act(async () => mock.timers.tick(5 * 1000));
		await harness.render(true, sessionExpiresAt);
		assert.equal(harness.state.visible, false);

		await unmount();
	});

	it('reopens when a new session expiry brings a new warning', async () => {
		const { harness, unmount } = await mountWarning();
		await harness.render(true, now + 30 * 1000);
		await act(async () => harness.state.dismiss());
		assert.equal(harness.state.visible, false);

		// The session was extended, so the warning is due again later
		await harness.render(true, now + 3 * 60 * 1000);
		assert.equal(harness.state.visible, false);

		await act(async () => mock.timers.tick(2 * 60 * 1000 + 1000));
		assert.equal(harness.state.visible, true);

		await unmount();
	});

	it('counts down the server seconds remaining when the client clock is behind', async () => {
		const { harness, unmount } = await mountWarning();
		const clientNow = Date.now();
		const skewMs = 90 * 1000;
		const sessionExpiresIn = 90;
		// The server clock is 90s ahead and 90s of session remain. Compared with this client clock, that absolute
		// instant looks 180s away, so a 60s warning would open after the session had already ended.
		const serverAbsolute = clientNow + skewMs + sessionExpiresIn * 1000;
		const sessionExpiresAt = applyClientLocalExpiry(
			{ sessionExpiresAt: serverAbsolute, sessionExpiresIn },
			clientNow
		).sessionExpiresAt;

		await harness.render(true, sessionExpiresAt);
		assert.equal(harness.state.visible, false);
		assert.equal(harness.state.secondsLeft, 90);

		await act(async () => mock.timers.tick(30 * 1000));
		assert.equal(harness.state.visible, true);
		assert.equal(harness.state.secondsLeft, 60);
		assert.ok(serverAbsolute - Date.now() > leadTime);

		await unmount();
	});

	it('does not show the warning when the session limit is 20 hours or more', async () => {
		const { harness, unmount } = await mountWarning();
		await harness.render(true, null);
		await act(async () => mock.timers.tick(60 * 1000));
		assert.equal(harness.state.visible, false);

		await harness.render(false, now + 10 * 1000);
		assert.equal(harness.state.visible, false);

		await unmount();
	});

	it('stays dismissed when a refresh reports the same server limit a few seconds later', async () => {
		const { harness, unmount } = await mountWarning();
		const start = Date.now();
		const first = getTokenSchedule(
			{
				token: 'a',
				expiresAt: start + 90_000 + 600_000,
				expiresIn: 600,
				sessionExpiresAt: start + 90_000 + 30_000,
				sessionExpiresIn: 30
			},
			leadTime,
			start
		);
		await harness.render(true, first.current.sessionExpiresAt);
		assert.equal(harness.state.visible, true);

		await act(async () => harness.state.dismiss());
		assert.equal(harness.state.visible, false);

		// The server floors the same limit. Re-basing those seconds on the later clock would move the expiry by 300ms
		// and reopen the warning if that value were stored as-is.
		await act(async () => mock.timers.tick(5300));
		const later = Date.now();
		const refreshed = getTokenSchedule(
			{
				token: 'b',
				expiresAt: start + 90_000 + 600_000,
				expiresIn: 595,
				sessionExpiresAt: start + 90_000 + 30_000,
				sessionExpiresIn: 25
			},
			leadTime,
			later,
			first.current
		);
		assert.equal(refreshed.current.sessionExpiresAt, first.current.sessionExpiresAt);

		await harness.render(true, refreshed.current.sessionExpiresAt);
		assert.equal(harness.state.visible, false);

		await unmount();
	});

	it('shows a new warning when an extension moves the session limit', async () => {
		const { harness, unmount } = await mountWarning();
		const start = Date.now();
		const first = getTokenSchedule(
			{
				token: 'a',
				expiresAt: start + 600_000,
				expiresIn: 600,
				sessionExpiresAt: start + 30_000,
				sessionExpiresIn: 30
			},
			leadTime,
			start
		);
		await harness.render(true, first.current.sessionExpiresAt);
		await act(async () => harness.state.dismiss());
		assert.equal(harness.state.visible, false);

		const extendedIn = 3 * 60;
		const extended = getTokenSchedule(
			{
				token: 'b',
				expiresAt: start + 600_000,
				expiresIn: 600,
				sessionExpiresAt: start + extendedIn * 1000,
				sessionExpiresIn: extendedIn
			},
			leadTime,
			start,
			first.current
		);
		assert.notEqual(extended.current.sessionExpiresAt, first.current.sessionExpiresAt);

		await harness.render(true, extended.current.sessionExpiresAt);
		assert.equal(harness.state.visible, false);

		await act(async () => mock.timers.tick(extendedIn * 1000 - leadTime + 1000));
		assert.equal(harness.state.visible, true);

		await unmount();
	});
});
