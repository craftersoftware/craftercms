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
 * Per-item validity is a cached boolean. A row is notified only when its own flag flips, not when another item's
 * messages change or another row becomes invalid.
 */

import '../../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const { atom, createStore } = await import('jotai');
const { listItemValidityAtom } = await import('./formUtils.tsx');
import type { FieldValidityState } from './validators.ts';

function validityAtoms(initial: FieldValidityState) {
	const base = atom(initial);
	const validationAtom = atom(async (get) => get(base));
	return { base, validationAtom };
}

const item = (key: string, message = 'required') => ({
	key,
	fields: [{ fieldId: 'title_s', fieldName: 'Title', messages: [message] }]
});

/** Waits until the sync derived atom is `true` (unwrap has settled on an invalid item). */
function waitUntilInvalid(store: ReturnType<typeof createStore>, itemAtom: ReturnType<typeof listItemValidityAtom>) {
	if (store.get(itemAtom)) return Promise.resolve();
	return new Promise<void>((resolve) => {
		const unsub = store.sub(itemAtom, () => {
			if (store.get(itemAtom)) {
				unsub();
				resolve();
			}
		});
	});
}

describe('listItemValidityAtom', () => {
	it('caches per validation atom and item key', () => {
		const { validationAtom } = validityAtoms({ isValid: true, messages: [] });
		const aAtom = listItemValidityAtom(validationAtom, 'a');
		assert.equal(listItemValidityAtom(validationAtom, 'a'), aAtom);
		assert.notEqual(listItemValidityAtom(validationAtom, 'b'), aAtom);
		assert.equal(listItemValidityAtom(null, 'a'), listItemValidityAtom(undefined, 'b'));
	});

	it('does not notify a row that stays invalid when another item changes', async () => {
		const store = createStore();
		const { base, validationAtom } = validityAtoms({
			isValid: false,
			messages: [],
			invalidItems: [item('a'), item('b')]
		});
		const aAtom = listItemValidityAtom(validationAtom, 'a');
		const bAtom = listItemValidityAtom(validationAtom, 'b');
		await store.get(validationAtom);
		await waitUntilInvalid(store, aAtom);
		const heard = { a: 0, b: 0 };
		store.sub(aAtom, () => {
			heard.a += 1;
		});
		store.sub(bAtom, () => {
			heard.b += 1;
		});

		store.set(base, { isValid: false, messages: [], invalidItems: [item('a'), item('b', 'fixed')] });
		await store.get(validationAtom);
		assert.equal(store.get(aAtom), true);
		assert.equal(store.get(bAtom), true);
		assert.equal(heard.a, 0);
		assert.equal(heard.b, 0);
	});

	it('notifies only the row whose flag flips', async () => {
		const store = createStore();
		const { base, validationAtom } = validityAtoms({ isValid: true, messages: [] });
		const aAtom = listItemValidityAtom(validationAtom, 'a');
		const bAtom = listItemValidityAtom(validationAtom, 'b');
		await store.get(validationAtom);
		assert.equal(store.get(aAtom), false);
		assert.equal(store.get(bAtom), false);
		const heard = { a: 0, b: 0 };
		store.sub(aAtom, () => {
			heard.a += 1;
		});
		store.sub(bAtom, () => {
			heard.b += 1;
		});

		store.set(base, {
			isValid: false,
			messages: ['One or more items are invalid.'],
			invalidItems: [item('a')]
		});
		await store.get(validationAtom);
		await waitUntilInvalid(store, aAtom);
		assert.equal(heard.a, 1);
		assert.equal(heard.b, 0);
		assert.equal(store.get(bAtom), false);
	});
});
