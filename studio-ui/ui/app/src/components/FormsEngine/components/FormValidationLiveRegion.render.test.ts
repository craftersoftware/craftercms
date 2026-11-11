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
 * An announcement updates the live region and nothing else. The orchestrator stand-in below wires the
 * region the way FormOrchestrator does: a ref, and a stable announce callback for the provider. Its render
 * counter and a field's render counter must not move when messages are announced.
 */

import '../../../../test/stringListDomSetup.mjs';
import '../../../../test/registerTsLoader.mjs';

import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const React = await import('react');
const { act, createElement, useCallback, useContext, useRef } = await import('react');
const { createRoot } = await import('react-dom/client');
const { FormValidationLiveRegion } = await import('./FormValidationLiveRegion.tsx');
const { FormValidationAnnouncerContext } = await import('../lib/fieldA11y.ts');

const counts = { orchestrator: 0, field: 0 };

function Field() {
	counts.field++;
	const announce = useContext(FormValidationAnnouncerContext);
	return createElement(
		'div',
		null,
		createElement('button', { id: 'field', onClick: () => announce('Title is required.') }, 'field'),
		createElement('button', { id: 'other', onClick: () => announce('Body is invalid.') }, 'other')
	);
}

function Orchestrator() {
	counts.orchestrator++;
	const liveRegionRef = useRef<{ announce(message: string): void }>(null);
	const announce = useCallback((message: string) => liveRegionRef.current?.announce(message), []);
	return createElement(
		FormValidationAnnouncerContext.Provider,
		{ value: announce },
		createElement(Field),
		createElement(FormValidationLiveRegion, { ref: liveRegionRef })
	);
}

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
});

async function render() {
	counts.orchestrator = 0;
	counts.field = 0;
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	await act(async () => root.render(createElement(Orchestrator)));
	mounted.push({ unmount: () => root.unmount(), host });
	return { host, root };
}

const wait = (ms: number) => act(async () => new Promise<void>((resolve) => setTimeout(resolve, ms)));
const region = (host: HTMLElement) => host.querySelector('[role="status"]') as HTMLElement;
const click = (host: HTMLElement, id = 'field') =>
	act(async () => (host.querySelector(`#${id}`) as HTMLElement).click());

describe('form validation live region', () => {
	it('is a polite, atomic status region that starts empty', async () => {
		const { host } = await render();
		const node = region(host);
		assert.ok(node);
		assert.equal(node.getAttribute('aria-live'), 'polite');
		assert.equal(node.getAttribute('aria-atomic'), 'true');
		assert.equal(node.textContent, '');
	});

	it('shows the message after the 40 ms delay', async () => {
		const { host } = await render();
		await click(host);
		assert.equal(region(host).textContent, '');
		await wait(120);
		assert.equal(region(host).textContent, 'Title is required.');
	});

	it('clears first so a repeated message is announced again', async () => {
		const { host } = await render();
		await click(host);
		await wait(120);
		assert.equal(region(host).textContent, 'Title is required.');
		await click(host);
		assert.equal(region(host).textContent, '');
		await wait(120);
		assert.equal(region(host).textContent, 'Title is required.');
	});

	it('keeps only the latest message when announced twice within the delay', async () => {
		const { host } = await render();
		await click(host);
		await click(host, 'other');
		await wait(120);
		assert.equal(region(host).textContent, 'Body is invalid.');
	});

	it('does not re-render the orchestrator or the fields when a message is announced', async () => {
		const { host } = await render();
		assert.equal(counts.orchestrator, 1);
		assert.equal(counts.field, 1);
		await click(host);
		await wait(120);
		assert.equal(region(host).textContent, 'Title is required.');
		await click(host);
		await wait(120);
		assert.equal(counts.orchestrator, 1);
		assert.equal(counts.field, 1);
	});

	it('cancels its pending timer on unmount and on re-announce', async () => {
		const { host, root } = await render();
		const created: unknown[] = [];
		const cleared: unknown[] = [];
		const originalSet = globalThis.setTimeout;
		const originalClear = globalThis.clearTimeout;
		globalThis.setTimeout = ((handler: TimerHandler, delay?: number, ...rest: unknown[]) => {
			const handle = originalSet(handler as never, delay, ...rest);
			if (delay === 40) created.push(handle);
			return handle;
		}) as never;
		globalThis.clearTimeout = ((handle: never) => {
			cleared.push(handle);
			return originalClear(handle);
		}) as never;
		try {
			await click(host);
			await click(host, 'other');
			assert.equal(created.length, 2);
			assert.ok(cleared.includes(created[0]), 'the first timer is cleared by the second announcement');
			await act(async () => root.unmount());
			assert.ok(cleared.includes(created[1]), 'the pending timer is cleared on unmount');
		} finally {
			globalThis.setTimeout = originalSet;
			globalThis.clearTimeout = originalClear;
		}
	});
});
