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
 * AsyncVideoPlayer checks that the video exists before showing it. video.js (VideoPlayer) is large, so it must only
 * be requested once the video is known to be playable. VideoPlayer is replaced with a stub that records its evaluation
 * (the chunk download). This file must run in its own process (node:test does that per file) because evaluated modules
 * stay cached.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { afterEach, beforeEach, describe, it } from 'node:test';

const globals = globalThis as unknown as { __videoPlayerLoads: number; __videoPlayerProps: unknown[] };
globals.__videoPlayerLoads = 0;
globals.__videoPlayerProps = [];

const emptyModule = 'data:text/javascript,';
const stubSource = `globalThis.__videoPlayerLoads++;
export default function VideoPlayerStub(props) { globalThis.__videoPlayerProps.push(props); return null; }`;
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

beforeEach(() => {
	globals.__videoPlayerProps = [];
});

afterEach(async () => {
	globalThis.fetch = realFetch;
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
});

async function render(status: number | 'network-error') {
	globalThis.fetch = (async () => {
		if (status === 'network-error') throw new Error('offline');
		return { status };
	}) as unknown as typeof fetch;
	const host = document.createElement('div');
	document.body.append(host);
	const root = createRoot(host);
	mounted.push({ unmount: () => root.unmount(), host });
	await act(async () => {
		root.render(
			React.createElement(
				IntlProvider,
				{ locale: 'en', messages: {} },
				React.createElement(AsyncVideoPlayer, { playerOptions: { src: '/static-assets/video.mp4', controls: true } })
			)
		);
	});
	await act(async () => void (await new Promise<void>((resolve) => setTimeout(resolve, 0))));
	return host;
}

describe('AsyncVideoPlayer', () => {
	it('does not request the video player code while the video is being checked, nor when it is not playable', async () => {
		const missing = await render(404);
		assert.match(missing.textContent, /Video is being processed/);
		const failed = await render('network-error');
		assert.match(failed.textContent, /Video is being processed/);
		assert.equal(globals.__videoPlayerLoads, 0);
	});

	it('requests the video player code and renders it once the video is playable', async () => {
		const host = await render(200);
		assert.equal(globals.__videoPlayerLoads, 1);
		assert.ok(host.querySelector('section.async-video-player'));
		assert.deepEqual(globals.__videoPlayerProps[0], { src: '/static-assets/video.mp4', controls: true });
	});
});
