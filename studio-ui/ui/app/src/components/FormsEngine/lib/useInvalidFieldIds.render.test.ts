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

import '../../../../test/stringListDomSetup.mjs';
import '../../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';

const React = await import('react');
const { createRoot } = await import('react-dom/client');
const { act, useState } = await import('react');
const { atom, createStore, Provider: JotaiProvider } = await import('jotai');
const { createFormStackData } = await import('./formUtils.tsx');
const { invalidFieldReadDebounceMs, useInvalidFieldIds } = await import('./useInvalidFieldIds.ts');

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function entryWith(validations: Record<string, { isValid: boolean }>) {
	const entry = createFormStackData({
		itemMeta: {} as never,
		originalValues: {}
	});
	entry.atoms = {
		relevanceVersion: atom(0),
		validationByFieldId: Object.fromEntries(
			Object.entries(validations).map(([id, state]) => [id, atom(Promise.resolve(state))])
		)
	} as never;
	return entry;
}

type HookProps = {
	entry: ReturnType<typeof entryWith> | null;
	parentPath?: string;
};

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
});

async function renderHook(initial: HookProps, store = createStore()) {
	const results: string[][] = [];
	let setProps!: (next: HookProps) => void;
	function Probe() {
		const [props, update] = useState(initial);
		setProps = update;
		results.push(useInvalidFieldIds(props.entry, props.parentPath));
		return null;
	}
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	await act(async () => {
		root.render(React.createElement(JotaiProvider, { store }, React.createElement(Probe)));
	});
	// Async validation atoms settle after the first paint.
	await act(async () => pause(20));
	mounted.push({ unmount: () => root.unmount(), host });
	return {
		store,
		latest: () => results[results.length - 1],
		async setProps(next: HookProps) {
			await act(async () => setProps(next));
			await act(async () => pause(20));
		}
	};
}

describe('useInvalidFieldIds', () => {
	it('applies the first read immediately', async () => {
		const entry = entryWith({ title_s: { isValid: false }, body_html: { isValid: true } });
		const { latest } = await renderHook({ entry });
		assert.deepEqual(latest(), ['title_s']);
	});

	it('waits for a trailing pause before later updates', async () => {
		const title = atom('bad');
		const entry = createFormStackData({ itemMeta: {} as never, originalValues: {} });
		entry.atoms = {
			relevanceVersion: atom(0),
			validationByFieldId: {
				title_s: atom(async (get) => ({ isValid: get(title) !== 'bad' }))
			}
		} as never;
		const { store, latest } = await renderHook({ entry });
		assert.deepEqual(latest(), ['title_s']);

		await act(async () => {
			store.set(title, 'ok');
		});
		await act(async () => pause(20));
		assert.deepEqual(latest(), ['title_s'], 'still the first ids before the pause ends');

		await act(async () => pause(invalidFieldReadDebounceMs - 40));
		assert.deepEqual(latest(), ['title_s'], 'still waiting out the trailing pause');

		await act(async () => pause(80));
		assert.deepEqual(latest(), []);
	});

	it('keeps the last ids when a plugin validator rejects', async () => {
		const fail = atom(false);
		const entry = createFormStackData({ itemMeta: {} as never, originalValues: {} });
		entry.atoms = {
			relevanceVersion: atom(0),
			validationByFieldId: {
				title_s: atom(async (get) => {
					if (get(fail)) throw new Error('boom');
					return { isValid: false };
				})
			}
		} as never;
		const error = mock.method(console, 'error', () => undefined);
		try {
			const { store, latest } = await renderHook({ entry });
			assert.deepEqual(latest(), ['title_s']);

			await act(async () => {
				store.set(fail, true);
			});
			await act(async () => pause(invalidFieldReadDebounceMs + 50));
			assert.deepEqual(latest(), ['title_s']);
			assert.ok(error.mock.callCount() >= 1);
		} finally {
			error.mock.restore();
		}
	});

	it('resets and reads immediately when the entry or its atoms change', async () => {
		const first = entryWith({ title_s: { isValid: false } });
		const { latest, setProps } = await renderHook({ entry: first });
		assert.deepEqual(latest(), ['title_s']);

		const second = entryWith({ body_html: { isValid: false } });
		await setProps({ entry: second });
		assert.deepEqual(latest(), ['body_html'], 'a new entry applies without waiting out the pause');

		const replacedAtoms = entryWith({ sidebar_s: { isValid: false } });
		second.atoms = replacedAtoms.atoms;
		await setProps({ entry: second });
		assert.deepEqual(latest(), ['sidebar_s'], 'replaced atoms on the same entry also reset');
	});

	it('returns the empty list while there is no form yet', async () => {
		const { latest } = await renderHook({ entry: null });
		assert.deepEqual(latest(), []);
	});
});
