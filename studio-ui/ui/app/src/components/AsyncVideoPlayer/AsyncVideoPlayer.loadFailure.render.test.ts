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
 * If the video player code (video.js) fails to load once the video is known to be playable, the failure must stay inside
 * AsyncVideoPlayer: the siblings keep rendering, a message replaces the player, and a later player requests the code
 * again. VideoPlayer is replaced with a stub whose evaluation fails, which is how a failed chunk request surfaces.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { afterEach, describe, it, mock } from 'node:test';

const globals = globalThis as unknown as { __videoPlayerLoadAttempts: number };
globals.__videoPlayerLoadAttempts = 0;

const emptyModule = 'data:text/javascript,';
const stubSource = `globalThis.__videoPlayerLoadAttempts++;
throw new Error('Loading chunk failed');`;
const stubUrl = `data:text/javascript,${encodeURIComponent(stubSource)}`;
registerHooks({
	resolve(specifier, context, nextResolve) {
		if (specifier.endsWith('.scss')) return { url: emptyModule, shortCircuit: true };
		if (specifier === '../VideoPlayer/VideoPlayer' && context.parentURL?.endsWith('/AsyncVideoPlayer.tsx')) {
			return { url: stubUrl, format: 'module', shortCircuit: true };
		}
		return nextResolve(specifier, context);
	},
	load(url, context, nextLoad) {
		return url === stubUrl ? { format: 'module', source: stubSource, shortCircuit: true } : nextLoad(url, context);
	}
});

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { IntlProvider } = await import('react-intl');
const { default: AsyncVideoPlayer } = await import('./AsyncVideoPlayer.tsx');

const realFetch = globalThis.fetch;
const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];

afterEach(async () => {
	mock.restoreAll();
	globalThis.fetch = realFetch;
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
});

async function render() {
	globalThis.fetch = (async () => ({ status: 200 })) as unknown as typeof fetch;
	const host = document.createElement('div');
	document.body.append(host);
	const root = createRoot(host);
	mounted.push({ unmount: () => root.unmount(), host });
	await act(async () => {
		root.render(
			React.createElement(
				IntlProvider,
				{ locale: 'en', messages: {} },
				React.createElement('aside', null, 'sibling'),
				React.createElement(AsyncVideoPlayer, { playerOptions: { src: '/static-assets/video.mp4', controls: true } })
			)
		);
	});
	await act(async () => void (await new Promise<void>((resolve) => setTimeout(resolve, 0))));
	return host;
}

describe('AsyncVideoPlayer when the video player code fails to load', () => {
	it('contains the failure, shows a message and leaves its siblings rendered', async () => {
		mock.method(console, 'error', () => {});
		const host = await render();
		assert.equal(host.querySelector('aside')?.textContent, 'sibling');
		assert.match(host.querySelector('[role="alert"]')?.textContent ?? '', /video player could not be loaded/);
		assert.equal(host.querySelector('.async-video-player--loading'), null);
		assert.ok(globals.__videoPlayerLoadAttempts >= 1);
	});
});
