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
import { afterEach, describe, it } from 'node:test';

const React = await import('react');
const { createRoot } = await import('react-dom/client');
const { act } = await import('react');
const { atom, createStore, Provider: JotaiProvider } = await import('jotai');
const { useMinimumSaveRequirements } = await import('./useMinimumSaveRequirements.ts');
const { invalidFieldReadDebounceMs } = await import('./useInvalidFieldIds.ts');

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function createFormAtoms(initial: { fileNameValid: boolean; internalName: unknown }) {
	const fileName = atom(Promise.resolve({ isValid: initial.fileNameValid }));
	const internalName = atom<unknown>(initial.internalName);
	const store = createStore();
	return {
		store,
		fileName,
		internalName,
		atoms: {
			validationByFieldId: { 'file-name': fileName },
			valueByFieldId: { 'internal-name': internalName }
		}
	};
}

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
});

async function renderHook(
	form: ReturnType<typeof createFormAtoms> | null,
	flags: { isRepeatMode: boolean; isEmbedded: boolean }
) {
	const results: string[][] = [];
	function Probe() {
		const missing = useMinimumSaveRequirements((form?.atoms ?? null) as never, flags);
		results.push(missing);
		return null;
	}
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	await act(async () => {
		root.render(
			React.createElement(JotaiProvider, { store: form?.store ?? createStore() }, React.createElement(Probe))
		);
	});
	mounted.push({ unmount: () => root.unmount(), host });
	return { latest: () => results[results.length - 1] };
}

const full = { isRepeatMode: false, isEmbedded: false };

describe('useMinimumSaveRequirements', () => {
	it('reports nothing when both the file name and the internal name are fine', async () => {
		const form = createFormAtoms({ fileNameValid: true, internalName: 'About us' });
		const { latest } = await renderHook(form, full);
		assert.deepEqual(latest(), []);
	});

	it('blocks on an invalid file name', async () => {
		const form = createFormAtoms({ fileNameValid: false, internalName: 'About us' });
		const { latest } = await renderHook(form, full);
		assert.deepEqual(latest(), ['fileName']);
	});

	it('blocks on a blank or whitespace-only internal name', async () => {
		for (const internalName of ['', '   ', undefined, null]) {
			const form = createFormAtoms({ fileNameValid: true, internalName });
			const { latest } = await renderHook(form, full);
			assert.deepEqual(latest(), ['internalName'], `internal name: ${JSON.stringify(internalName)}`);
		}
	});

	it('lists both, file name first', async () => {
		const form = createFormAtoms({ fileNameValid: false, internalName: '' });
		const { latest } = await renderHook(form, full);
		assert.deepEqual(latest(), ['fileName', 'internalName']);
	});

	it('does not require anything of a repeat item', async () => {
		const form = createFormAtoms({ fileNameValid: false, internalName: '' });
		const { latest } = await renderHook(form, { isRepeatMode: true, isEmbedded: false });
		assert.deepEqual(latest(), []);
	});

	it('does not require a file name of an embedded form, only the internal name', async () => {
		const form = createFormAtoms({ fileNameValid: false, internalName: '' });
		const { latest } = await renderHook(form, { isRepeatMode: false, isEmbedded: true });
		assert.deepEqual(latest(), ['internalName']);
	});

	it('reports nothing while the form atoms are not there yet', async () => {
		const { latest } = await renderHook(null, full);
		assert.deepEqual(latest(), []);
	});

	it('re-reads when the internal name atom changes', async () => {
		const form = createFormAtoms({ fileNameValid: true, internalName: '' });
		const { latest } = await renderHook(form, full);
		assert.deepEqual(latest(), ['internalName']);

		await act(async () => {
			form.store.set(form.internalName, 'Home');
		});
		await act(async () => pause(20));
		assert.deepEqual(latest(), ['internalName'], 'still the first list before the pause ends');
		await act(async () => pause(invalidFieldReadDebounceMs + 50));
		assert.deepEqual(latest(), []);

		await act(async () => {
			form.store.set(form.internalName, '  ');
		});
		await act(async () => pause(invalidFieldReadDebounceMs + 50));
		assert.deepEqual(latest(), ['internalName']);
	});

	it('keeps the same list when a re-read finds nothing new', async () => {
		const form = createFormAtoms({ fileNameValid: true, internalName: '' });
		const { latest } = await renderHook(form, full);
		const before = latest();
		await act(async () => {
			// Still blank after trim; the missing list must not be replaced.
			form.store.set(form.internalName, '   ');
		});
		await act(async () => pause(invalidFieldReadDebounceMs + 50));
		assert.equal(latest(), before);
	});
});
