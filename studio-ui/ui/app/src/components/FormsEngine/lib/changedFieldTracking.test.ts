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
 * Changed-field tracking. The changed ids are one atom holding an immutable set, and `fieldUpdates$` is the event
 * stream of value writes. A write updates the set first, then emits, so a synchronous subscriber (and a controller's
 * `onFieldChange` listener) reads the new state. Clears are state changes only: they never emit.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import '../../../../test/registerTsLoader.mjs';
import type { ContentTypeField } from '../../../models/ContentType';

const { createStore } = await import('jotai');
const {
	EMPTY_CHANGED_FIELD_IDS,
	applyValuesCheckpoint,
	changedFieldAtom,
	createFieldAtoms,
	createFormStackData,
	generateDefaultChangesComment,
	getAdditionalFieldIds,
	mapAdditionalFieldsToParents
} = await import('./formUtils.tsx');
const { createFormControllerContext } = await import('../formControllers/runtime.ts');

const fieldOf = (id: string, name = id, type = 'input') => ({ id, name, type, validations: {} }) as ContentTypeField;
const fields = ['a_s', 'b_s', 'c_s'].map((id) => fieldOf(id, id.toUpperCase()));

function openForm() {
	const store = createStore();
	const context = createFormStackData({
		itemMeta: { path: '/site/components/thing.xml' } as never,
		originalValues: { a_s: 'a', b_s: 'b', c_s: 'c' }
	});
	context.atoms = { valueByFieldId: {}, validationByFieldId: {} } as never;
	const valueAtoms: Record<string, ReturnType<typeof createFieldAtoms>[0]> = {};
	for (const field of fields) {
		const [valueAtom, validationAtom] = createFieldAtoms(field, context.originalValues[field.id], { current: context });
		valueAtoms[field.id] = valueAtom;
		context.atoms.valueByFieldId[field.id] = valueAtom;
		context.atoms.validationByFieldId[field.id] = validationAtom;
	}
	const emitted: string[] = [];
	context.fieldUpdates$.subscribe((update) => emitted.push(update.fieldId));
	const changed = () => store.get(context.changedFieldIds);
	return { store, context, valueAtoms, emitted, changed };
}

describe('changed ids as one atom', () => {
	it('starts as the shared empty set', () => {
		const { changed } = openForm();
		assert.equal(changed(), EMPTY_CHANGED_FIELD_IDS);
	});

	it('keeps the same set when a write leaves the membership unchanged', () => {
		const { store, valueAtoms, changed } = openForm();
		store.set(valueAtoms.a_s, 'a1');
		const afterFirst = changed();
		assert.deepEqual([...afterFirst], ['a_s']);
		// More keystrokes in a field that is already changed, and a write that equals the original of one that is not.
		store.set(valueAtoms.a_s, 'a12');
		store.set(valueAtoms.a_s, 'a123');
		store.set(valueAtoms.b_s, 'b');
		assert.equal(changed(), afterFirst);
	});

	it('replaces the set on a flip and never mutates the previous one', () => {
		const { store, valueAtoms, changed } = openForm();
		store.set(valueAtoms.a_s, 'a1');
		const first = changed();
		store.set(valueAtoms.b_s, 'b1');
		assert.notEqual(changed(), first);
		assert.deepEqual([...first], ['a_s']);
		store.set(valueAtoms.a_s, 'a');
		store.set(valueAtoms.b_s, 'b');
		assert.equal(changed(), EMPTY_CHANGED_FIELD_IDS);
	});

	it('keeps insertion order, which the default version comment reads as last added', () => {
		const { store, valueAtoms, changed } = openForm();
		store.set(valueAtoms.c_s, 'c1');
		store.set(valueAtoms.a_s, 'a1');
		store.set(valueAtoms.b_s, 'b1');
		assert.deepEqual([...changed()], ['c_s', 'a_s', 'b_s']);
		const byId = Object.fromEntries(fields.map((field) => [field.id, field]));
		const comment = generateDefaultChangesComment(byId, fields, changed(), '');
		// Names come out in the order the fields were changed.
		assert.ok(comment.indexOf('C_S') < comment.indexOf('A_S') && comment.indexOf('A_S') < comment.indexOf('B_S'));
		// The version comment the form last generated is replaced when the last field is added, not when the user wrote it.
		const withoutLast = generateDefaultChangesComment(byId, fields, new Set(['c_s', 'a_s']), '');
		assert.equal(generateDefaultChangesComment(byId, fields, changed(), withoutLast), comment);
		assert.equal(generateDefaultChangesComment(byId, fields, changed(), 'my own comment'), undefined);
	});

	it('updates the set before a synchronous fieldUpdates$ subscriber runs', () => {
		const { store, context, valueAtoms } = openForm();
		const seen: string[][] = [];
		context.fieldUpdates$.subscribe(() => seen.push([...store.get(context.changedFieldIds)]));
		store.set(valueAtoms.a_s, 'a1');
		store.set(valueAtoms.a_s, 'a');
		assert.deepEqual(seen, [['a_s'], []]);
	});

	it('flips a field atom on edit and rollback, and not for another field', () => {
		const { store, valueAtoms, context } = openForm();
		const aAtom = changedFieldAtom(context.changedFieldIds, 'a_s');
		const bAtom = changedFieldAtom(context.changedFieldIds, 'b_s');
		assert.equal(changedFieldAtom(context.changedFieldIds, 'a_s'), aAtom);
		const heard = { a: [] as boolean[], b: [] as boolean[] };
		store.sub(aAtom, () => heard.a.push(store.get(aAtom)));
		store.sub(bAtom, () => heard.b.push(store.get(bAtom)));
		store.set(valueAtoms.a_s, 'a1');
		store.set(valueAtoms.a_s, 'a12');
		store.set(valueAtoms.a_s, 'a');
		assert.deepEqual(heard.a, [true, false]);
		assert.deepEqual(heard.b, []);
	});

	it('has a constant false atom when the form has no changed ids atom', () => {
		const store = createStore();
		assert.equal(store.get(changedFieldAtom(null, 'a_s')), false);
		assert.equal(changedFieldAtom(null, 'a_s'), changedFieldAtom(undefined, 'b_s'));
	});

	it('lights a parent field atom when a related additional field id is in the set', () => {
		const { store, context } = openForm();
		const placeInNav = changedFieldAtom(context.changedFieldIds, 'placeInNav', ['orderDefault_f']);
		assert.equal(store.get(placeInNav), false);
		store.set(context.changedFieldIds, new Set(['orderDefault_f']));
		assert.equal(store.get(placeInNav), true);
		store.set(context.changedFieldIds, EMPTY_CHANGED_FIELD_IDS);
		assert.equal(store.get(placeInNav), false);
	});
});

describe('additional fields', () => {
	const placeInNav = fieldOf('placeInNav', 'Place in Nav', 'page-nav-order');
	const title = fieldOf('title_s', 'Title');

	it('maps orderDefault_f to the Place in Nav parent from the page-nav-order descriptor', () => {
		assert.deepEqual(getAdditionalFieldIds(placeInNav), ['orderDefault_f']);
		assert.equal(mapAdditionalFieldsToParents([placeInNav, title]).orderDefault_f, placeInNav);
	});

	it('names the parent in the default version comment when only the additional field changed', () => {
		const byId = { placeInNav, title_s: title };
		const comment = generateDefaultChangesComment(byId, [placeInNav, title], new Set(['orderDefault_f']), '');
		assert.equal(comment, 'Updated Place in Nav');
	});

	it('dedupes the parent name when both the parent and additional field are changed', () => {
		const byId = { placeInNav, title_s: title };
		const comment = generateDefaultChangesComment(
			byId,
			[placeInNav, title],
			new Set(['placeInNav', 'orderDefault_f', 'title_s']),
			''
		);
		assert.equal(comment, 'Updated Place in Nav and Title');
	});

	it('maps additional fields from configured custom control descriptors', () => {
		const customField = fieldOf('widget_s', 'Widget', 'custom-widget');
		const customControls = {
			'custom-widget': {
				id: 'custom-widget',
				name: 'Custom Widget',
				description: '',
				sections: [],
				fields: {},
				metadata: { additionalFields: ['{id}_extra'] }
			}
		};
		assert.deepEqual(getAdditionalFieldIds(customField, customControls), ['widget_s_extra']);
		assert.equal(mapAdditionalFieldsToParents([customField, title], customControls).widget_s_extra, customField);
		const comment = generateDefaultChangesComment(
			{ widget_s: customField, title_s: title },
			[customField, title],
			new Set(['widget_s_extra']),
			'',
			customControls
		);
		assert.equal(comment, 'Updated Widget');
		// Without customControls, the additional field id is unknown and omitted from the comment.
		assert.equal(mapAdditionalFieldsToParents([customField, title]).widget_s_extra, undefined);
		assert.equal(
			generateDefaultChangesComment(
				{ widget_s: customField, title_s: title },
				[customField, title],
				new Set(['widget_s_extra']),
				''
			),
			''
		);
	});
});

describe('clearing the changed ids', () => {
	it('a save checkpoint clears the set and flips the markers, and does not emit', () => {
		const { store, context, valueAtoms, emitted } = openForm();
		store.set(valueAtoms.a_s, 'a1');
		const aAtom = changedFieldAtom(context.changedFieldIds, 'a_s');
		assert.equal(store.get(aAtom), true);
		emitted.length = 0;
		applyValuesCheckpoint(context, { a_s: 'a1', b_s: 'b', c_s: 'c' }, store.set);
		assert.equal(store.get(aAtom), false);
		assert.equal(store.get(context.changedFieldIds), EMPTY_CHANGED_FIELD_IDS);
		assert.deepEqual(context.originalValues, { a_s: 'a1', b_s: 'b', c_s: 'c' });
		assert.deepEqual(emitted, []);
	});

	it('compares later edits with the new checkpoint', () => {
		const { store, context, valueAtoms } = openForm();
		store.set(valueAtoms.a_s, 'a1');
		applyValuesCheckpoint(context, { a_s: 'a1' }, store.set);
		store.set(valueAtoms.a_s, 'a1');
		assert.equal(store.get(context.changedFieldIds), EMPTY_CHANGED_FIELD_IDS);
		store.set(valueAtoms.a_s, 'a2');
		assert.deepEqual([...store.get(context.changedFieldIds)], ['a_s']);
	});

	// What Type Builder's commit does: it sets the empty set itself and emits nothing.
	it('setting the empty set flips the marker', () => {
		const { store, context, valueAtoms, emitted } = openForm();
		store.set(valueAtoms.a_s, 'a1');
		const aAtom = changedFieldAtom(context.changedFieldIds, 'a_s');
		emitted.length = 0;
		store.set(context.changedFieldIds, EMPTY_CHANGED_FIELD_IDS);
		assert.equal(store.get(aAtom), false);
		assert.deepEqual(emitted, []);
	});
});

describe('onFieldChange', () => {
	function controllerContext(form: ReturnType<typeof openForm>) {
		return createFormControllerContext({
			siteId: 'editorial',
			store: form.store,
			atoms: form.context.atoms,
			contentType: { id: '/component/thing', fields: {} } as never,
			getPath: () => '/site/components/thing.xml',
			mode: 'edit' as never,
			isEmbedded: false,
			fieldUpdates$: form.context.fieldUpdates$,
			dispatch: (() => undefined) as never,
			fieldChangeTeardowns: new Set(),
			isDisposed: () => false
		});
	}

	it('fires once per value write, synchronously, with the new value', () => {
		const form = openForm();
		const calls: Array<[string, unknown]> = [];
		controllerContext(form).onFieldChange((id, value) => calls.push([id, value]));
		form.store.set(form.valueAtoms.a_s, 'a1');
		assert.deepEqual(calls, [['a_s', 'a1']]);
		// A write that leaves the membership alone is still a value write.
		form.store.set(form.valueAtoms.a_s, 'a12');
		form.store.set(form.valueAtoms.b_s, 'b');
		assert.deepEqual(calls, [
			['a_s', 'a1'],
			['a_s', 'a12'],
			['b_s', 'b']
		]);
	});

	it('does not fire when the changed ids are cleared', () => {
		const form = openForm();
		const calls: string[] = [];
		controllerContext(form).onFieldChange((id) => calls.push(id));
		form.store.set(form.valueAtoms.a_s, 'a1');
		calls.length = 0;
		applyValuesCheckpoint(form.context, { a_s: 'a1' }, form.store.set);
		form.store.set(form.context.changedFieldIds, EMPTY_CHANGED_FIELD_IDS);
		assert.deepEqual(calls, []);
	});

	it('does not hand the changed ids, the store or the event stream to the controller', () => {
		const form = openForm();
		const api = controllerContext(form) as unknown as Record<string, unknown>;
		for (const name of ['changedFieldIds', 'fieldUpdates$', 'store', 'atoms']) assert.equal(name in api, false);
	});
});

describe('controller setValue on a repeat row', () => {
	/** A controller context over a repeat field's value atom, the way the form hands it to a controller. */
	async function repeatController() {
		const { atom, createStore } = await import('jotai');
		const { repeatItemKeysFor } = await import('./repeatItemKeys.ts');
		const store = createStore();
		const rows = [{ name_s: 'a' }, { name_s: 'b' }, { name_s: 'c' }];
		const rowsAtom = atom<unknown>(rows);
		const context = createFormControllerContext({
			siteId: 'editorial',
			store,
			atoms: { valueByFieldId: { rows_o: rowsAtom }, validationByFieldId: {} } as never,
			contentType: { id: '/component/thing', fields: {} } as never,
			getPath: () => '/site/components/thing.xml',
			mode: 'edit' as never,
			isEmbedded: false,
			fieldUpdates$: createFormStackData({ itemMeta: {} as never, originalValues: {} }).fieldUpdates$,
			dispatch: (() => undefined) as never,
			fieldChangeTeardowns: new Set(),
			isDisposed: () => false
		});
		return { store, rows, rowsAtom, context, keys: repeatItemKeysFor<Record<string, unknown>>(rowsAtom) };
	}

	// The copy of the row is a new object. Without the carry it is a new row for React, and the row remounts.
	it('keeps the row key of an item it copies to write a nested field', async () => {
		const { store, rows, rowsAtom, context, keys } = await repeatController();
		const keyOfB = keys.keyOf(rows[1]);
		context.setValue('rows_o.1.name_s', 'b2');
		const next = store.get(rowsAtom) as typeof rows;
		assert.deepEqual(
			next.map((row) => row.name_s),
			['a', 'b2', 'c']
		);
		assert.notEqual(next[1], rows[1]);
		assert.equal(keys.keyOf(next[1]), keyOfB);
		// Rows that were not copied keep their object and key.
		assert.ok(next[0] === rows[0] && next[2] === rows[2]);
		assert.equal(keys.keyOf(next[2]), keys.keyOf(rows[2]));
	});

	it('keeps the key of a row it never rendered, so a later lookup still finds it', async () => {
		const { store, rows, rowsAtom, context, keys } = await repeatController();
		context.setValue('rows_o.0.name_s', 'a2');
		const next = store.get(rowsAtom) as typeof rows;
		assert.equal(keys.keyOf(next[0]), keys.keyOf(rows[0]));
	});
});
