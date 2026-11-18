/*
 * Copyright (C) 2007-2025 Crafter Software Corporation. All Rights Reserved.
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

import '../../../../test/stringListDomSetup.mjs';
import '../../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const React = await import('react');
const { createRoot } = await import('react-dom/client');
const { act } = await import('react');
const { atom, createStore, Provider: JotaiProvider } = await import('jotai');
const { useLoadableAtom } = await import('./useLoadableAtom.tsx');

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
});

/** Renders `useLoadableAtom` and records every state it returns, as `loading`, `data:<value>` or `error:<message>`. */
async function renderLoadable(anAtom: Parameters<typeof useLoadableAtom>[0], store = createStore()) {
	const states: string[] = [];
	function Probe() {
		const loadable = useLoadableAtom(anAtom);
		states.push(
			loadable.state === 'hasData'
				? `data:${loadable.data}`
				: loadable.state === 'hasError'
					? `error:${(loadable.error as Error).message}`
					: 'loading'
		);
		return null;
	}
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	await act(async () => {
		root.render(React.createElement(JotaiProvider, { store }, React.createElement(Probe)));
	});
	mounted.push({ unmount: () => root.unmount(), host });
	return { store, states };
}

describe('useLoadableAtom', () => {
	it('is loading until the first result, then has data', async () => {
		const slow = atom(async () => {
			await pause(10);
			return 'a';
		});
		const { states } = await renderLoadable(slow);
		assert.equal(states[0], 'loading');
		await act(async () => pause(40));
		assert.equal(states[states.length - 1], 'data:a');
	});

	it('keeps the previous data while the atom runs again, with no loading flash', async () => {
		const source = atom('a');
		const releases: Record<string, () => void> = {};
		const slow = atom(async (get) => {
			const value = get(source);
			await new Promise<void>((resolve) => (releases[value] = resolve));
			return value;
		});
		const { store, states } = await renderLoadable(slow);
		await act(async () => releases.a());
		const settled = states.length;
		assert.equal(states[settled - 1], 'data:a');

		await act(async () => store.set(source, 'b'));
		await act(async () => pause(20));
		assert.equal(states[states.length - 1], 'data:a', 'the previous data stays while the rerun is pending');

		await act(async () => releases.b());
		const afterChange = states.slice(settled);
		assert.equal(afterChange.includes('loading'), false, afterChange.join(','));
		assert.equal(states[states.length - 1], 'data:b');
	});

	it('reports an error from the atom', async () => {
		const failing = atom(async () => {
			throw new Error('boom');
		});
		const { states } = await renderLoadable(failing);
		await act(async () => pause(20));
		assert.equal(states[states.length - 1], 'error:boom');
	});
});
