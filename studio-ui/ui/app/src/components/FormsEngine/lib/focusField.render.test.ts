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
 * scrollToFieldWhenSettled({ focus: true }) must land on the control, not the field header's
 * Help/Options IconButtons (those match [tabindex="0"] and sit earlier in the DOM).
 */

import '../../../../test/stringListDomSetup.mjs';
import '../../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { ComponentType } from 'react';
import type { ContentTypeField } from '../../../models/ContentType';

// fieldIdSelector calls CSS.escape; Node/jsdom may not define CSS.
globalThis.CSS ??= {
	escape(value: string) {
		return value.replace(/[^a-zA-Z0-9_-]/g, (character) => `\\${character}`);
	}
} as typeof CSS;

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { RawIntlProvider } = await import('react-intl');
const { createTestIntl } = await import('../../../../test/createTestIntl.mjs');

const intl = createTestIntl();
const { Provider } = await import('react-redux');
const { configureStore } = await import('@reduxjs/toolkit');
const { atom, createStore, Provider: JotaiProvider } = await import('jotai');
const { createChangedFieldIdsAtom, scrollToFieldWhenSettled } = await import('./formUtils.tsx');
const { createFormVisibilityAtoms } = await import('./formVisibility.ts');
const { FormsEngineFormContextApi, ItemMetaContext, StableFormContext, StableGlobalContext } =
	await import('./formsEngineContext.ts');
const { Text } = await import('../controls/Text.tsx');
const { Textarea } = await import('../controls/Textarea.tsx');
const { Checkbox } = await import('../controls/Checkbox.tsx');
const { Numeric } = await import('../controls/Numeric.tsx');
const { Dropdown } = await import('../controls/Dropdown.tsx');

const cssEscape = (value: string) => CSS.escape(value);

const redux = configureStore({
	reducer: {
		sites: (state = { active: 'editorial', byId: {} }) => state,
		content: (state = { itemsByPath: {} }) => state,
		contentTypes: (state = { byId: {}, isFetching: false }) => state,
		preview: (state = { richTextEditor: { generic: { id: 'generic', tinymceOptions: {} } } }) => state,
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

function fieldFor(id: string, helpText = ''): ContentTypeField {
	return {
		id,
		name: `Name of ${id}`,
		type: 'input',
		description: `Describe ${id}`,
		helpText,
		validations: {},
		properties: {},
		defaultValue: ''
	} as ContentTypeField;
}

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
});

async function renderControl(Control: ComponentType<any>, field: ContentTypeField, value: unknown) {
	const validationAtom = atom({ isValid: true, messages: [] });
	const stable = {
		atoms: {
			valueByFieldId: {
				[field.id]: atom(value)
			},
			validationByFieldId: {
				[field.id]: validationAtom
			},
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
					{ value: intl as never },
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
										React.createElement(Control, {
											field,
											value,
											setValue() {},
											contentType,
											readonly: false,
											autoFocus: false
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

function assertFocusOnControl(host: HTMLElement, fieldId: string) {
	const field = host.querySelector(`[data-field-id="${cssEscape(fieldId)}"]`);
	assert.ok(field instanceof HTMLElement);
	const options = field.querySelector('[aria-label^="Options for "]');
	assert.ok(options instanceof HTMLElement, 'Options menu button is present');
	assert.notEqual(document.activeElement, options, 'focus must not land on Options');
	assert.equal(document.activeElement?.closest('[data-field-header]'), null, 'focus must not land in the field header');
	assert.ok(field.contains(document.activeElement), 'focus stays inside the field');
}

const controls: Array<{ name: string; Control: ComponentType<any>; id: string; value: unknown }> = [
	{ name: 'Text', Control: Text, id: 'title_s', value: 'Hello' },
	{ name: 'Textarea', Control: Textarea, id: 'body_t', value: 'Hello' },
	{ name: 'Checkbox', Control: Checkbox, id: 'featured_b', value: false },
	{ name: 'Numeric', Control: Numeric, id: 'count_i', value: 1 },
	{ name: 'Dropdown', Control: Dropdown, id: 'section_s', value: '' }
];

describe('focusField skips field header chrome', () => {
	for (const { name, Control, id, value } of controls) {
		it(`${name}: scrollToFieldWhenSettled({ focus: true }) focuses the control, not Options`, async () => {
			const host = await renderControl(Control, fieldFor(id), value);
			await act(async () => {
				scrollToFieldWhenSettled(host, id, { focus: true });
			});
			assertFocusOnControl(host, id);
		});
	}

	it('Text with help: focus skips Help and Options', async () => {
		const id = 'title_s';
		const host = await renderControl(Text, fieldFor(id, 'Helpful tip'), 'Hello');
		const field = host.querySelector(`[data-field-id="${cssEscape(id)}"]`);
		assert.ok(field instanceof HTMLElement);
		const help = field.querySelector('[aria-label^="Help for "]');
		assert.ok(help instanceof HTMLElement, 'Help button is present');
		await act(async () => {
			scrollToFieldWhenSettled(host, id, { focus: true });
		});
		assert.notEqual(document.activeElement, help, 'focus must not land on Help');
		assertFocusOnControl(host, id);
	});
});
