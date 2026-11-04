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
 * Editing the file name validates the file-name field only. The validator context carries no file name, so the
 * other fields' validation atoms are not subscribed to it. A validator that needs the name reads
 * `getValue('file-name')`, which subscribes only that validator.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import '../../../../test/registerTsLoader.mjs';
import type { ComponentType } from 'react';
import type { AnyValue } from '../types';
import type { ContentTypeField } from '../../../models/ContentType';
import type PluginDescriptor from '../../../models/PluginDescriptor';
import type { Validator } from './validators.ts';

const { registerPlugin } = await import('../../../services/plugin.ts');
const { createFileNameAtom, createFormsEngineAtoms, createFormStackData, setFieldAtoms } =
	await import('./formUtils.tsx');
const { atom, createStore } = await import('jotai');

const aboutPath = '/site/website/about/index.xml';
const source = { site: 'editorial', type: 'control', name: 'example', file: 'index.js' };
const Component = (() => null) as ComponentType<AnyValue>;

let counter = 0;
function pluginField(id: string, validator: Validator<AnyValue>): ContentTypeField {
	const typeKey = `file-name-validation-${counter++}`;
	registerPlugin(
		{ id: `org.example.${typeKey}`, controls: { [typeKey]: { Component, validator } } } as PluginDescriptor,
		source
	);
	return { id, name: id, type: typeKey, validations: {} } as ContentTypeField;
}

const fileNameField = { id: 'file-name', name: 'File Name', type: 'file-name', validations: {} } as ContentTypeField;

/** A form with a file-name field and the given plugin fields. No site id, so no path existence request is made. */
function createForm(path: string | undefined, fields: ContentTypeField[]) {
	const formContextRef = { current: createFormStackData() };
	const atoms = createFormsEngineAtoms('author', {
		lockResult: atom({ locked: true, lockError: null, affectedPackages: null }),
		readonly: atom(false),
		fileName: createFileNameAtom(path ?? '', formContextRef)
	});
	formContextRef.current.atoms = atoms;
	formContextRef.current.itemMeta = { path, pathInSite: path } as never;
	const all = [fileNameField, ...fields];
	const contentType = {
		id: '/page/article',
		name: 'Article',
		fields: Object.fromEntries(all.map((field) => [field.id, field]))
	} as never;
	all.forEach((field) =>
		setFieldAtoms(formContextRef, contentType, contentType.fields, field.id, atoms, 'xml value', undefined, false, path)
	);
	const store = createStore();
	const settle = async () => {
		for (const validation of Object.values(atoms.validationByFieldId)) await store.get(validation);
	};
	Object.values(atoms.validationByFieldId).forEach((validation) => store.sub(validation, () => undefined));
	return { atoms, store, settle };
}

describe('editing the file name', () => {
	it('re-runs the file-name validation only, not the other fields', async () => {
		const runs: Record<string, number> = { a_s: 0, b_s: 0 };
		const a = pluginField('a_s', () => (runs.a_s++, { valid: true }));
		const b = pluginField('b_s', () => (runs.b_s++, { valid: true }));
		const { atoms, store, settle } = createForm(aboutPath, [a, b]);
		await settle();
		assert.deepEqual(runs, { a_s: 1, b_s: 1 });

		store.set(atoms.fileName as never, 'contact');
		await settle();
		assert.deepEqual(runs, { a_s: 1, b_s: 1 });
		assert.equal((await store.get(atoms.validationByFieldId['file-name'])).isValid, true);

		store.set(atoms.fileName as never, '');
		await settle();
		assert.deepEqual(runs, { a_s: 1, b_s: 1 });
		assert.equal((await store.get(atoms.validationByFieldId['file-name'])).isValid, false);
	});

	it('does not abort the validation in flight of another field', async () => {
		let aborted = false;
		const slow = pluginField('slow_s', async (_value, ctx) => {
			ctx.signal.addEventListener('abort', () => (aborted = true));
			await new Promise((resolve) => setTimeout(resolve, 20));
			return { valid: true };
		});
		const { atoms, store } = createForm(aboutPath, [slow]);
		const pending = store.get(atoms.validationByFieldId['slow_s']);
		store.set(atoms.fileName as never, 'contact');
		assert.equal((await pending).isValid, true);
		assert.equal(aborted, false);
	});

	it('re-runs a validator that reads the file name through getValue, and only that one', async () => {
		const seen: unknown[] = [];
		const runs: Record<string, number> = { reader_s: 0, other_s: 0 };
		const reader = pluginField('reader_s', (_value, ctx) => {
			runs.reader_s++;
			seen.push(ctx.getValue('file-name'));
			return { valid: true };
		});
		const other = pluginField('other_s', () => (runs.other_s++, { valid: true }));
		const { atoms, store, settle } = createForm(aboutPath, [reader, other]);
		await settle();
		store.set(atoms.fileName as never, 'contact');
		await settle();
		assert.deepEqual(seen, ['about', 'contact']);
		assert.deepEqual(runs, { reader_s: 2, other_s: 1 });
	});
});

describe('file-name value and atom', () => {
	it('start in sync on edit, from the path, and in create mode, blank', async () => {
		const edit = createForm(aboutPath, []);
		assert.equal(edit.store.get(edit.atoms.fileName), 'about');
		assert.equal(edit.store.get(edit.atoms.valueByFieldId['file-name']), 'about');
		const create = createForm(undefined, []);
		assert.equal(create.store.get(create.atoms.fileName), '');
		assert.equal(create.store.get(create.atoms.valueByFieldId['file-name']), '');
	});

	it('stay in sync when either one is written, and the validation follows', async () => {
		const { atoms, store, settle } = createForm(undefined, []);
		await settle();
		assert.equal((await store.get(atoms.validationByFieldId['file-name'])).isValid, false);

		store.set(atoms.fileName as never, 'contact');
		assert.equal(store.get(atoms.valueByFieldId['file-name']), 'contact');
		assert.equal((await store.get(atoms.validationByFieldId['file-name'])).isValid, true);

		store.set(atoms.valueByFieldId['file-name'], '');
		assert.equal(store.get(atoms.fileName), '');
		assert.equal((await store.get(atoms.validationByFieldId['file-name'])).isValid, false);

		store.set(atoms.valueByFieldId['file-name'], 'pricing');
		assert.equal(store.get(atoms.fileName), 'pricing');
		assert.equal((await store.get(atoms.validationByFieldId['file-name'])).isValid, true);
	});
});
