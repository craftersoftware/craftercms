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
 * A custom control's group is named by the field label. Required is in the description, not aria-required,
 * which axe rejects on role="group".
 */

import '../../../../test/stringListDomSetup.mjs';
import '../../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { ContentTypeField } from '../../../models/ContentType';

const React = await import('react');
const { act, createElement } = await import('react');
const { createRoot } = await import('react-dom/client');
const { RawIntlProvider } = await import('react-intl');
const { createTestIntl } = await import('../../../../test/createTestIntl.mjs');
const { Provider: ReduxProvider } = await import('react-redux');
const { configureStore } = await import('@reduxjs/toolkit');
const { atom, createStore, Provider: JotaiProvider } = await import('jotai');
const { Subject } = await import('rxjs');
const { FormsEngineField } = await import('./FormsEngineField.tsx');
const { FieldAriaGroup } = await import('./useControlAria.tsx');
const { FieldBox } = await import('./FieldBox.tsx');
const { FormsEngineFormContextApi, ItemMetaContext, StableFormContext, StableGlobalContext } =
	await import('../lib/formsEngineContext.ts');
const { createFormVisibilityAtoms } = await import('../lib/formVisibility.ts');

const intl = createTestIntl();

const reduxStore = configureStore({
	reducer: {
		sites: (state = { active: 'editorial' }) => state,
		content: (state = { itemsByPath: {} }) => state,
		contentTypes: (state = { byId: {}, isFetching: false }) => state
	}
});

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
});

async function render(node: React.ReactNode) {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	await act(async () => {
		root.render(createElement(RawIntlProvider, { value: intl as never }, node));
	});
	mounted.push({ unmount: () => root.unmount(), host });
	return host;
}

function fieldOf(required: boolean): ContentTypeField {
	return {
		id: 'features_s',
		name: 'Features',
		type: 'node-selector',
		helpText: '',
		description: 'Pick at least one.',
		validations: required ? { required: { id: 'required', value: true, level: 'required' } } : {}
	} as ContentTypeField;
}

function tree(field: ContentTypeField, valid: boolean, group: React.ReactNode) {
	const valueAtom = atom(valid ? ['one'] : []);
	const validationAtom = atom({
		isValid: valid,
		messages: valid ? [] : ['Pick at least one.']
	});
	const atoms = {
		valueByFieldId: { [field.id]: valueAtom },
		validationByFieldId: { [field.id]: validationAtom },
		expandedStateBySectionId: {},
		tableOfContentsDrawerOpen: atom(false),
		...createFormVisibilityAtoms()
	};
	const stable = {
		atoms,
		changedFieldIds: atom(new Set<string>()),
		fieldUpdates$: new Subject(),
		itemMeta: { sourceMap: null },
		originalValues: {},
		props: null,
		state: null,
		itemFormMode: null,
		affectedPluginControlFields: [],
		formControllerState: null,
		getItem: () => null
	};
	return createElement(
		ReduxProvider,
		{ store: reduxStore },
		createElement(
			JotaiProvider,
			{ store: createStore() },
			createElement(
				StableGlobalContext.Provider,
				{ value: { formsStackData: [], api: {} } as never },
				createElement(
					StableFormContext.Provider,
					{ value: stable as never },
					createElement(
						ItemMetaContext.Provider,
						{ value: { sourceMap: null, contentType: { fields: {}, sections: [] } } as never },
						createElement(
							FormsEngineFormContextApi.Provider,
							{ value: { rollbackField() {} } as never },
							createElement(FormsEngineField, { field, labelId: 'features_s-label', menu: false }, group)
						)
					)
				)
			)
		)
	);
}

describe('custom control group', () => {
	it('names a required group with the label and describes it as required, without aria-required', async () => {
		const host = await render(
			tree(
				fieldOf(true),
				false,
				createElement(FieldAriaGroup, { 'aria-describedby': 'caller-note' }, createElement('span', null, 'items'))
			)
		);
		const group = host.querySelector('[role="group"]') as HTMLElement;
		const label = host.querySelector('label') as HTMLLabelElement;
		const required = Array.from(host.querySelectorAll('span')).find((span) => span.textContent === 'Required');
		assert.ok(group);
		assert.equal(group.hasAttribute('aria-required'), false);
		assert.equal(group.getAttribute('aria-invalid'), 'true');
		assert.equal(label.id, 'features_s-label');
		assert.equal(group.getAttribute('aria-labelledby'), label.id);
		assert.ok(required?.id);
		assert.equal(required?.getAttribute('aria-hidden'), 'true');
		const described = group.getAttribute('aria-describedby')?.split(/\s+/) ?? [];
		assert.ok(described.includes('caller-note'));
		assert.ok(described.includes('features_s-label-description'));
		assert.ok(described.includes('features_s-label-error'));
		assert.ok(described.includes(required.id));
		assert.equal(host.querySelector('#features_s-label-description')?.textContent, 'Pick at least one.');
		assert.equal(host.querySelector('#features_s-label-error')?.textContent, 'Pick at least one.');
	});

	it('leaves the required cue off a group that is not required', async () => {
		const host = await render(tree(fieldOf(false), true, createElement(FieldBox, null, 'items')));
		const group = host.querySelector('[role="group"]') as HTMLElement;
		assert.equal(group.hasAttribute('aria-required'), false);
		assert.equal(group.getAttribute('aria-labelledby'), 'features_s-label');
		assert.equal(
			Array.from(host.querySelectorAll('span')).some((span) => span.textContent === 'Required'),
			false
		);
		assert.equal(group.getAttribute('aria-describedby'), 'features_s-label-description');
	});

	it('renders FieldBox outside a FormControl without throwing', async () => {
		const host = await render(createElement(FieldBox, null, 'loose'));
		const group = host.querySelector('[role="group"]') as HTMLElement;
		assert.equal(group.textContent, 'loose');
		assert.equal(group.hasAttribute('aria-required'), false);
		assert.equal(group.hasAttribute('aria-labelledby'), false);
		assert.equal(group.hasAttribute('aria-invalid'), false);
	});
});
