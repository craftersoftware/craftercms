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
 * Focus and ARIA state of the More button when the bar is resized (zoom, window width).
 * Each toolbar control is 100px wide and the More button 40px.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

// See ToolbarOverflow.focusReturn.render.test.ts for why these are replaced.
globalThis.setInterval = (() => 0) as typeof setInterval;
const runFrame = (callback: FrameRequestCallback) => {
	callback(0);
	return 0;
};
globalThis.requestAnimationFrame = runFrame;
window.requestAnimationFrame = runFrame;

if (typeof globalThis.ShadowRoot === 'undefined') {
	Object.defineProperty(globalThis, 'ShadowRoot', { value: window.ShadowRoot, configurable: true });
}

const observerCallbacks = new Set<() => void>();
class ResizeObserverStub {
	callback: () => void;
	constructor(callback: () => void) {
		this.callback = callback;
	}
	observe() {
		observerCallbacks.add(this.callback);
	}
	unobserve() {}
	disconnect() {
		observerCallbacks.delete(this.callback);
	}
}
globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
window.ResizeObserver = globalThis.ResizeObserver;

let barWidth = 1000;
Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
	configurable: true,
	get() {
		return this.getAttribute('aria-label') === 'More toolbar actions' ? 40 : 100;
	}
});
Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
	configurable: true,
	get() {
		return this.hasAttribute('data-toolbar-overflow') ? barWidth : 100;
	}
});

const React = await import('react');
const { createRoot } = await import('react-dom/client');
const { act } = await import('react');
const { RawIntlProvider } = await import('react-intl');
const { createTestIntl } = await import('../../../test/createTestIntl.mjs');
const { ThemeProvider, createTheme } = await import('@mui/material/styles');
const { ToolbarOverflow } = await import('./ToolbarOverflow.tsx');
const { getFocusRingThemeOptions } = await import('../../styles/focusRing.ts');

(globalThis as { localStorage?: Storage }).localStorage ??= window.localStorage;

const intl = createTestIntl();
const MORE = 'More toolbar actions';
// Three controls need 300px. At 108px of bar (100px after the focus ring room) none fit next to More,
// at 258px (250px) the first two do, and at 1000px all three do.
const ALL_FIT = 1000;
const TWO_FIT = 258;
const NONE_FIT = 108;

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];

afterEach(async () => {
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => {
			unmount();
		});
		host.remove();
	}
	observerCallbacks.clear();
	barWidth = ALL_FIT;
});

async function renderBar(align: 'start' | 'end' = 'start', width = ALL_FIT) {
	barWidth = width;
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	const theme = createTheme({ ...getFocusRingThemeOptions('light'), palette: { mode: 'light' } });
	await act(async () => {
		root.render(
			React.createElement(
				ThemeProvider,
				{ theme },
				React.createElement(
					RawIntlProvider,
					{ value: intl as never },
					React.createElement(
						ToolbarOverflow,
						{ align },
						['A', 'B', 'C'].map((label) =>
							React.createElement('button', { key: label, type: 'button', 'aria-label': label })
						)
					)
				)
			)
		);
	});
	mounted.push({ unmount: () => root.unmount(), host });
}

async function resize(width: number) {
	barWidth = width;
	await act(async () => {
		Array.from(observerCallbacks).forEach((callback) => callback());
	});
	await act(async () => {});
}

function button(label: string): HTMLButtonElement {
	const found = document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
	assert.ok(found, `missing button ${label}`);
	return found;
}

/** Compares by description. A failed assert.equal on DOM nodes would try to print both trees. */
function assertFocused(label: string) {
	const active = document.activeElement;
	const actual = active?.getAttribute('aria-label') ?? active?.tagName ?? 'nothing';
	assert.equal(actual, label);
}

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');

async function openMore() {
	await act(async () => {
		button(MORE).click();
	});
	await act(async () => {});
}

describe('ToolbarOverflow focus when the bar shrinks', () => {
	it('moves focus to More when the focused control moves into the closed menu', async () => {
		await renderBar();
		assert.equal(document.querySelector(`button[aria-label="${MORE}"]`), null);
		await act(async () => button('C').focus());
		assertFocused('C');
		await resize(TWO_FIT);
		assert.equal(document.querySelector('button[aria-label="C"]'), null, 'C is in the closed menu');
		assertFocused(MORE);
	});

	it('moves focus to More when every control leaves the bar', async () => {
		await renderBar();
		await act(async () => button('A').focus());
		await resize(NONE_FIT);
		assertFocused(MORE);
	});

	it('moves focus to More for an end-aligned bar, which moves its leading controls first', async () => {
		await renderBar('end');
		await act(async () => button('A').focus());
		await resize(TWO_FIT);
		assert.equal(document.querySelector('button[aria-label="A"]'), null, 'A is in the closed menu');
		assertFocused(MORE);
	});

	it('keeps focus on a control that stays in the bar', async () => {
		await renderBar();
		await act(async () => button('A').focus());
		await resize(TWO_FIT);
		assertFocused('A');
	});

	it('leaves focus alone when it is outside the bar', async () => {
		await renderBar();
		const outside = document.createElement('button');
		document.body.appendChild(outside);
		await act(async () => outside.focus());
		await resize(TWO_FIT);
		assert.ok(document.activeElement === outside, 'focus stays outside the bar');
		outside.remove();
	});
});

describe('ToolbarOverflow More button state', () => {
	it('exposes aria-expanded and aria-controls for the dialog it opens', async () => {
		await renderBar('start', TWO_FIT);
		await act(async () => {});
		const more = button(MORE);
		assert.equal(more.getAttribute('aria-haspopup'), 'dialog');
		assert.equal(more.getAttribute('aria-expanded'), 'false');
		assert.equal(more.hasAttribute('aria-controls'), false);

		await openMore();
		assert.equal(more.getAttribute('aria-expanded'), 'true');
		const controls = more.getAttribute('aria-controls');
		assert.ok(controls, 'aria-controls is set while open');
		assert.equal(dialog()?.id, controls);
		assert.equal(dialog()?.getAttribute('aria-label'), MORE);

		await act(async () => {
			document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
			dialog()?.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		});
		await act(async () => {});
		assert.equal(more.getAttribute('aria-expanded'), 'false');
		assert.equal(more.hasAttribute('aria-controls'), false);
	});
});

describe('ToolbarOverflow focus when the menu closes because everything fits again', () => {
	it('moves focus from the menu to the same control in the bar', async () => {
		await renderBar('start', TWO_FIT);
		await act(async () => {});
		await openMore();
		await act(async () => button('C').focus());
		assertFocused('C');
		await resize(ALL_FIT);
		assert.equal(document.querySelector(`button[aria-label="${MORE}"]`), null);
		assertFocused('C');
		assert.ok(button('C').closest('[data-toolbar-overflow]'), 'C is back in the bar');
	});

	it('moves focus on the menu itself to the first control that comes back', async () => {
		await renderBar('start', TWO_FIT);
		await act(async () => {});
		await openMore();
		await act(async () => dialog()?.focus());
		await resize(ALL_FIT);
		assertFocused('C');
	});
});
