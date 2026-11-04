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

/**
 * `file-name` belongs to the item being edited. A component inside a node selector, or a repeat child, has none:
 * an embedded component saved from its own form carries no `file-name` key, so it must not count as blank, and a
 * stored name must not be checked against the page path. Rollback of an untouched page restores the path-derived
 * name, so it is not a rename.
 */

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import '../../../../test/registerTsLoader.mjs';
import type { ContentTypeField } from '../../../models/ContentType';

const { validateFieldValue } = await import('./validators.ts');
const { createFileNameAtom, createFormsEngineAtoms, createFormStackData, setFieldAtoms, withPathFileName } =
	await import('./formUtils.tsx');
const { atom, createStore } = await import('jotai');

const aboutPath = '/site/website/about/index.xml';
const meta = { siteId: 'editorial', itemMeta: { path: aboutPath, pathInSite: aboutPath } };

/** Counts the requests the validators start. The path-existence check is one of them. */
let requests = 0;
const originalXhr = (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest;
beforeEach(() => {
	requests = 0;
	(globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest = class {
		constructor() {
			requests++;
			throw new Error('no network in tests');
		}
	};
});
afterEach(() => {
	(globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest = originalXhr;
});

const fileNameField = { id: 'file-name', name: 'File Name', type: 'file-name', validations: {} } as ContentTypeField;
const titleField = { id: 'title_s', name: 'Title', type: 'input', validations: {} } as ContentTypeField;

describe('node selector with an embedded component', () => {
	const embedded = { id: 'embedded', type: 'component', fields: { 'file-name': fileNameField, title_s: titleField } };
	const selector = { id: 'items_o', name: 'Items', type: 'node-selector', validations: {} } as ContentTypeField;
	const run = (component: Record<string, unknown>) =>
		validateFieldValue(selector, [{ component: { 'content-type': 'embedded', objectId: 'o1', ...component } }], {
			...meta,
			contentTypesById: { embedded } as never
		});

	it('is valid when the component has no file-name key', async () => {
		const result = await run({ title_s: 'Hello' });
		assert.equal(result.isValid, true);
		assert.deepEqual(result.messages, []);
		assert.equal(requests, 0);
	});

	it('does not check a stored file-name against the page path, nor ask the server', async () => {
		for (const stored of ['', 'index.xml', 'some-name']) {
			const result = await run({ title_s: 'Hello', 'file-name': stored });
			assert.equal(result.isValid, true, `file-name ${JSON.stringify(stored)}`);
		}
		assert.equal(requests, 0);
	});

	it('still validates the component other fields', async () => {
		const required = {
			...embedded,
			fields: {
				title_s: { ...titleField, validations: { required: { id: 'required', value: true, level: 'required' } } }
			}
		};
		const result = await validateFieldValue(
			selector,
			[{ component: { 'content-type': 'embedded', objectId: 'o1', title_s: '' } }],
			{ ...meta, contentTypesById: { embedded: required } as never }
		);
		assert.equal(result.isValid, false);
	});
});

describe('repeat group with a file-name child', () => {
	const repeat = {
		id: 'rows_o',
		name: 'Rows',
		type: 'repeat',
		validations: {},
		fields: { 'file-name': fileNameField, title_s: titleField }
	} as unknown as ContentTypeField;

	it('does not validate the child file-name from the page', async () => {
		for (const item of [{ title_s: 'a' }, { 'file-name': '', title_s: 'a' }, { 'file-name': 'x', title_s: 'a' }]) {
			const result = await validateFieldValue(repeat, [item], meta);
			assert.equal(result.isValid, true, JSON.stringify(item));
		}
		assert.equal(requests, 0);
	});
});

describe('file-name value of a form with no item path', () => {
	it('keeps the value it is given when no item path is passed, as a repeat item does', () => {
		const formContextRef = { current: createFormStackData() };
		const atoms = createFormsEngineAtoms('author', {
			lockResult: atom({ locked: true, lockError: null, affectedPackages: null }),
			readonly: atom(false),
			fileName: createFileNameAtom('', formContextRef)
		});
		formContextRef.current.atoms = atoms;
		formContextRef.current.itemMeta = { path: undefined } as never;
		const contentType = { id: '/page/article', name: 'Article', fields: { 'file-name': fileNameField } } as never;
		setFieldAtoms(formContextRef, contentType, contentType.fields, 'file-name', atoms, 'kept');
		assert.equal(createStore().get(atoms.valueByFieldId['file-name']), 'kept');
	});
});

describe('rollback of an untouched page whose xml file-name differs from the path', () => {
	/** Opens /site/website/about/index.xml, whose xml says `<file-name>index.xml</file-name>`. */
	function openAbout() {
		const formContextRef = { current: createFormStackData() };
		const atoms = createFormsEngineAtoms('author', {
			lockResult: atom({ locked: true, lockError: null, affectedPackages: null }),
			readonly: atom(false),
			fileName: createFileNameAtom(aboutPath, formContextRef)
		});
		formContextRef.current.atoms = atoms;
		formContextRef.current.itemMeta = { path: aboutPath, pathInSite: aboutPath } as never;
		const contentType = {
			id: '/page/article',
			name: 'Article',
			fields: { 'file-name': fileNameField, title_s: titleField }
		} as never;
		const xmlValues = { 'file-name': 'index.xml', title_s: 'About' };
		Object.entries(xmlValues).forEach(([id, value]) =>
			setFieldAtoms(formContextRef, contentType, contentType.fields, id, atoms, value, undefined, false, aboutPath)
		);
		const originalValues = withPathFileName(xmlValues, atoms, aboutPath);
		formContextRef.current.originalValues = originalValues;
		return { atoms, store: createStore(), originalValues, formContextRef };
	}

	// The same writes FormsEngine's rollback() and rollbackField() make: each initial value into its value atom.
	const rollbackField = (form: ReturnType<typeof openAbout>, id: string) =>
		form.store.set(form.atoms.valueByFieldId[id], form.originalValues[id]);

	it('seeds the original values with the path-derived name', () => {
		const { originalValues } = openAbout();
		assert.equal(originalValues['file-name'], 'about');
		assert.equal(originalValues.title_s, 'About');
	});

	it('leaves the name alone on a whole-form rollback', () => {
		const form = openAbout();
		Object.keys(form.originalValues).forEach((id) => rollbackField(form, id));
		assert.equal(form.store.get(form.atoms.fileName), 'about');
		assert.equal(form.store.get(form.atoms.valueByFieldId['file-name']), 'about');
		assert.equal(form.formContextRef.current.changedFieldIds.has('file-name'), false);
	});

	it('leaves the name alone on a field rollback', () => {
		const form = openAbout();
		rollbackField(form, 'file-name');
		assert.equal(form.store.get(form.atoms.fileName), 'about');
		assert.equal(form.formContextRef.current.changedFieldIds.has('file-name'), false);
	});

	it('returns values with no file-name, or no file-name atom, as they are', () => {
		const values = { title_s: 'a' };
		assert.equal(withPathFileName(values, { fileName: atom('') }, aboutPath), values);
		const withName = { 'file-name': 'x' };
		assert.equal(withPathFileName(withName, {} as never, aboutPath), withName);
	});
});
