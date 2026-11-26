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
 * A rejected `lazy()` stays rejected forever, so `lazyWithRetry` must create a fresh one after a failure: the next mount
 * requests the chunk again, while successful loads are still shared.
 */

import '../../test/stringListDomSetup.mjs';
import '../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';

const React = await import('react');
const { act, Suspense } = await import('react');
const { createRoot } = await import('react-dom/client');
const { lazyWithRetry } = await import('./lazyWithRetry.ts');
const { LoadFailureBoundary } = await import('../components/ErrorBoundary/LoadFailureBoundary.tsx');

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];

afterEach(async () => {
	mock.restoreAll();
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
});

function setup() {
	const network = { online: true };
	let requests = 0;
	const Component = lazyWithRetry(() => {
		requests++;
		return network.online
			? Promise.resolve({ default: (props: { label: string }) => React.createElement('p', null, props.label) })
			: Promise.reject(new Error('Loading chunk failed'));
	});
	const host = document.createElement('div');
	document.body.append(host);
	const root = createRoot(host);
	mounted.push({ unmount: () => root.unmount(), host });
	const render = (retryWhen: boolean) =>
		act(async () => {
			root.render(
				React.createElement(
					LoadFailureBoundary,
					{ retryWhen, fallback: React.createElement('span', null, 'failed') },
					React.createElement(Suspense, { fallback: 'loading' }, React.createElement(Component, { label: 'loaded' }))
				)
			);
		});
	const mountNew = async () => {
		const other = document.createElement('div');
		document.body.append(other);
		const otherRoot = createRoot(other);
		mounted.push({ unmount: () => otherRoot.unmount(), host: other });
		await act(async () => {
			otherRoot.render(
				React.createElement(
					LoadFailureBoundary,
					{ fallback: React.createElement('span', null, 'failed') },
					React.createElement(Suspense, { fallback: 'loading' }, React.createElement(Component, { label: 'loaded' }))
				)
			);
		});
		return other;
	};
	return { host, network, render, mountNew, requests: () => requests };
}

describe('lazyWithRetry', () => {
	it('passes props through and requests the module once for any number of mounts', async () => {
		const { host, render, requests } = setup();
		await render(true);
		assert.equal(host.textContent, 'loaded');
		await render(false);
		await render(true);
		assert.equal(requests(), 1);
	});

	it('is contained by LoadFailureBoundary when the load fails, without throwing past it', async () => {
		mock.method(console, 'error', () => {});
		const { host, network, render } = setup();
		network.online = false;
		await render(true);
		assert.equal(host.textContent, 'failed');
	});

	it('keeps showing the failure, with no new request, until the boundary is told to retry', async () => {
		mock.method(console, 'error', () => {});
		const { host, network, render, requests } = setup();
		network.online = false;
		await render(true);
		const afterFailure = requests();
		await render(true);
		await render(false);
		assert.equal(host.textContent, 'failed');
		assert.equal(requests(), afterFailure);
	});

	it('requests the module again, instead of reusing the rejection, when retried', async () => {
		mock.method(console, 'error', () => {});
		const { host, network, render, requests } = setup();
		network.online = false;
		await render(true);
		const afterFailure = requests();
		network.online = true;
		await render(false);
		await render(true);
		assert.equal(host.textContent, 'loaded');
		assert.equal(requests(), afterFailure + 1);
	});

	it('fails again, and can be retried again, when the retry fails too', async () => {
		mock.method(console, 'error', () => {});
		const { host, network, render } = setup();
		network.online = false;
		await render(true);
		await render(false);
		await render(true);
		assert.equal(host.textContent, 'failed');
		network.online = true;
		await render(false);
		await render(true);
		assert.equal(host.textContent, 'loaded');
	});

	it('also retries when a new boundary mounts after the failure', async () => {
		mock.method(console, 'error', () => {});
		const { host, network, render, mountNew, requests } = setup();
		network.online = false;
		await render(true);
		assert.equal(host.textContent, 'failed');
		const afterFailure = requests();
		network.online = true;
		const second = await mountNew();
		assert.equal(second.textContent, 'loaded');
		assert.equal(requests(), afterFailure + 1);
	});
});
