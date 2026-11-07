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

import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it, mock } from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
const globals = ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'getComputedStyle', 'MutationObserver'];
const previous = new Map(globals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
globals.forEach((name) =>
	Object.defineProperty(globalThis, name, { value: (dom.window as any)[name], configurable: true, writable: true })
);
// React needs to know it can use act() outside of a browser
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const { createElement } = await import('react');
const { createRoot } = await import('react-dom/client');
const { act } = await import('react');
const { useSessionTimeoutWarning } = await import('./useSessionTimeoutWarning.ts');

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
	harness.render = async (active, sessionExpiresAt) => {
		function Probe() {
			harness.state = useSessionTimeoutWarning(active, sessionExpiresAt, leadTime);
			return null;
		}
		await act(async () => root.render(createElement(Probe)));
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
				delete (globalThis as any)[name];
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

	it('does not show the warning when the session limit is 20 hours or more', async () => {
		const { harness, unmount } = await mountWarning();
		await harness.render(true, null);
		await act(async () => mock.timers.tick(60 * 1000));
		assert.equal(harness.state.visible, false);

		await harness.render(false, now + 10 * 1000);
		assert.equal(harness.state.visible, false);

		await unmount();
	});
});
