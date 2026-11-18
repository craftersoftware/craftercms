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
 * FormsEngineField renders the field label with the host's labelId. The dropdown Select has to receive that same
 * labelId, or the combobox and the open listbox are unnamed.
 */

import '../../../../test/stringListDomSetup.mjs';
import '../../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { ContentTypeField } from '../../../models/ContentType';

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { RawIntlProvider, createIntl } = await import('react-intl');
const { Provider } = await import('react-redux');
const { configureStore } = await import('@reduxjs/toolkit');
const { atom, createStore, Provider: JotaiProvider } = await import('jotai');
const { createChangedFieldIdsAtom } = await import('../lib/formUtils.tsx');
const { createFormVisibilityAtoms } = await import('../lib/formVisibility.ts');
const { FormsEngineFormContextApi, ItemMetaContext, StableFormContext, StableGlobalContext } =
	await import('../lib/formsEngineContext.ts');
const { Dropdown } = await import('./Dropdown.tsx');

const intl = createIntl({ locale: 'en', messages: {}, onError: () => undefined });

const redux = configureStore({
	reducer: {
		sites: (state = { active: 'editorial', byId: {} }) => state,
		content: (state = { itemsByPath: {} }) => state,
		contentTypes: (state = { byId: {}, isFetching: false }) => state,
		uiConfig: (state = { currentSite: 'editorial', isFetching: false, xml: null }) => state
	}
});

const contentType = { id: '/component/thing', type: 'component', fields: {}, sections: [] };
const itemMeta = {
	sourceMap: null,
	path: '/site/components/thing.xml',
	pathInSite: '/site/components',
	contentType
};

const field = {
	id: 'section_s',
	name: 'Section',
	type: 'dropdown',
	description: '',
	helpText: '',
	validations: {},
	properties: {},
	defaultValue: ''
} as ContentTypeField;

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
});

function accessibleName(node: HTMLElement) {
	const explicit = node.getAttribute('aria-label');
	if (explicit) return explicit;
	const ids = node.getAttribute('aria-labelledby')?.split(/\s+/).filter(Boolean) ?? [];
	return ids
		.map((id) => document.getElementById(id)?.textContent ?? '')
		.join(' ')
		.replace(/\s+/g, ' ')
		.trim();
}

async function render() {
	const validationAtom = atom({ isValid: true, messages: [] });
	const stable = {
		atoms: {
			valueByFieldId: { section_s: atom('') },
			validationByFieldId: { section_s: validationAtom },
			...createFormVisibilityAtoms()
		},
		changedFieldIds: createChangedFieldIdsAtom(),
		fieldUpdates$: null,
		itemMeta,
		originalValues: {},
		props: null,
		state: null,
		affectedPluginControlFields: [],
		formControllerState: null,
		getItem: () => null
	};
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	await act(async () => {
		root.render(
			React.createElement(
				Provider,
				{ store: redux },
				React.createElement(
					RawIntlProvider,
					{ value: intl },
					React.createElement(
						JotaiProvider,
						{ store: createStore() },
						React.createElement(
							StableGlobalContext.Provider,
							{ value: { formsStackData: [], api: {} } },
							React.createElement(
								StableFormContext.Provider,
								{ value: stable },
								React.createElement(
									ItemMetaContext.Provider,
									{ value: itemMeta },
									React.createElement(
										FormsEngineFormContextApi.Provider,
										{ value: { rollbackField() {} } },
										React.createElement(Dropdown, {
											field,
											value: '',
											setValue() {},
											contentType,
											readonly: false,
											autoFocus: false,
											inputId: 'section_s-input',
											labelId: 'section_s-label'
										})
									)
								)
							)
						)
					)
				)
			)
		);
	});
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 30));
	});
	mounted.push({ unmount: () => root.unmount(), host });
	return host;
}

describe('forms engine dropdown names', () => {
	it('names the combobox from the field label', async () => {
		const host = await render();
		const combobox = host.querySelector<HTMLElement>('[role="combobox"]');
		assert.ok(combobox, 'the dropdown combobox is missing');
		assert.equal(combobox.getAttribute('aria-labelledby'), 'section_s-label');
		assert.equal(accessibleName(combobox), 'Section');
	});

	it('names the open listbox from the same field label', async () => {
		const host = await render();
		const combobox = host.querySelector<HTMLElement>('[role="combobox"]');
		assert.ok(combobox, 'the dropdown combobox is missing');
		await act(async () => {
			combobox.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, button: 0 }));
		});
		const listbox = document.querySelector<HTMLElement>('[role="listbox"]');
		assert.ok(listbox, 'the dropdown listbox did not open');
		assert.equal(listbox.getAttribute('aria-labelledby'), 'section_s-label');
		assert.equal(accessibleName(listbox), 'Section');
	});
});
