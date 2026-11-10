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

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import '../../../../test/registerTsLoader.mjs';

const { atom, createStore } = await import('jotai');
const { createFormStackData, invalidFieldIdsAtom } = await import('./formUtils.tsx');

describe('invalidFieldIdsAtom', () => {
	function entryWith(validations: Record<string, { isValid: boolean }>, irrelevantFieldPaths?: ReadonlySet<string>) {
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
		if (irrelevantFieldPaths) {
			entry.formControllerState = { irrelevantFieldPaths } as never;
		}
		return entry;
	}

	it('returns the same atom for the same entry and parentPath', () => {
		const entry = entryWith({ title_s: { isValid: true } });
		assert.equal(invalidFieldIdsAtom(entry), invalidFieldIdsAtom(entry));
		assert.equal(invalidFieldIdsAtom(entry, 'rows_o'), invalidFieldIdsAtom(entry, 'rows_o'));
		assert.notEqual(invalidFieldIdsAtom(entry), invalidFieldIdsAtom(entry, 'rows_o'));
	});

	it('lists only invalid fields and excludes controller-irrelevant paths', async () => {
		const entry = entryWith(
			{
				title_s: { isValid: false },
				body_html: { isValid: true },
				sidebar_s: { isValid: false }
			},
			new Set(['sidebar_s'])
		);
		const store = createStore();
		assert.deepEqual(await store.get(invalidFieldIdsAtom(entry)), ['title_s']);
	});

	it('recomputes after a validation atom changes', async () => {
		const title = atom('bad');
		const validation = atom(async (get) => ({ isValid: get(title) !== 'bad' }));
		const entry = createFormStackData({ itemMeta: {} as never, originalValues: {} });
		entry.atoms = {
			relevanceVersion: atom(0),
			validationByFieldId: { title_s: validation }
		} as never;
		const store = createStore();
		const idsAtom = invalidFieldIdsAtom(entry);
		assert.deepEqual(await store.get(idsAtom), ['title_s']);
		store.set(title, 'ok');
		assert.deepEqual(await store.get(idsAtom), []);
	});

	it('keeps the same array when a recompute leaves membership unchanged', async () => {
		const title = atom('bad');
		const tick = atom(0);
		const validation = atom(async (get) => {
			get(tick);
			return { isValid: get(title) !== 'bad' };
		});
		const entry = createFormStackData({ itemMeta: {} as never, originalValues: {} });
		entry.atoms = {
			relevanceVersion: atom(0),
			validationByFieldId: { title_s: validation }
		} as never;
		const store = createStore();
		const idsAtom = invalidFieldIdsAtom(entry);
		const first = await store.get(idsAtom);
		assert.deepEqual(first, ['title_s']);
		store.set(tick, 1);
		assert.equal(await store.get(idsAtom), first);
		store.set(title, 'ok');
		const empty = await store.get(idsAtom);
		assert.deepEqual(empty, []);
		store.set(tick, 2);
		assert.equal(await store.get(idsAtom), empty);
	});
});
