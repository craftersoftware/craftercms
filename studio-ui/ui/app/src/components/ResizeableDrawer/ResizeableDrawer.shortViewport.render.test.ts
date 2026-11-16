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
 * At 320x256 the preview toolbar wraps to about 190px and scrolls away. A tools drawer fixed below it would be
 * left about 66px. On that viewport an open drawer must scroll with the shell at the viewport height instead.
 * jsdom does not evaluate media queries, so the tests read the CSS the drawer emits.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

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

const React = await import('react');
const { createRoot } = await import('react-dom/client');
const { act } = await import('react');
const { ThemeProvider, createTheme } = await import('@mui/material/styles');
const { ResizeableDrawer } = await import('./ResizeableDrawer.tsx');
const { PREVIEW_REFLOW_SHORT_QUERY, PREVIEW_REFLOW_STICKY_QUERY } = await import('../Preview/previewReflow.ts');

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];

afterEach(async () => {
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => {
			unmount();
		});
		host.remove();
	}
});

/** The rules a drawer paper emits inside the short-viewport media query, with whitespace removed. */
async function shortViewportRules(props: Record<string, unknown>): Promise<string> {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	await act(async () => {
		root.render(
			React.createElement(
				ThemeProvider,
				{ theme: createTheme() },
				React.createElement(ResizeableDrawer, { open: true, width: 300, belowToolbar: true, ...props }, 'Tools')
			)
		);
	});
	mounted.push({ unmount: () => root.unmount(), host });
	// Emotion's cache outlives each test, so read only the rules that target this drawer's paper classes.
	const paperClasses = Array.from(host.querySelector('.MuiDrawer-paper')?.classList ?? []).map((name) => `.${name}`);
	const query = PREVIEW_REFLOW_SHORT_QUERY.replace(/\s+/g, '');
	return Array.from(document.styleSheets)
		.flatMap((sheet) => Array.from(sheet.cssRules))
		.map((rule) => rule.cssText.replace(/\s+/g, ''))
		.filter((text) => text.startsWith(query) && paperClasses.some((name) => text.includes(`${name}{`)))
		.join('');
}

describe('short viewport query', () => {
	it('starts where the sticky toolbar query stops', () => {
		assert.match(PREVIEW_REFLOW_SHORT_QUERY, /max-height: 599px/);
		assert.match(PREVIEW_REFLOW_STICKY_QUERY, /min-height: 600px/);
	});
});

describe('ResizeableDrawer on a short narrow viewport', () => {
	it('scrolls with the shell at the viewport height when it opts in and is open', async () => {
		const rules = await shortViewportRules({ scrollsWithShell: true });
		assert.match(rules, /position:absolute/);
		assert.match(rules, /bottom:auto/);
		assert.match(rules, /height:100vh/);
	});

	it('stays fixed when it does not opt in', async () => {
		assert.equal(await shortViewportRules({}), '');
	});

	it('stays fixed while closed, so a hidden drawer adds no scroll height', async () => {
		assert.equal(await shortViewportRules({ scrollsWithShell: true, open: false }), '');
	});

	it('stays fixed when it is not below the toolbar', async () => {
		assert.equal(await shortViewportRules({ scrollsWithShell: true, belowToolbar: false }), '');
	});
});
