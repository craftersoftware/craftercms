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
 * The help button's tooltip holds the whole date expression syntax reference, so it is a description, not a name.
 * Without `describeChild` MUI points aria-labelledby at the tooltip while it is open, and the syntax reference
 * replaces the button's own name. With it the button keeps its short name and gets aria-describedby instead.
 */

import '../../../../test/stringListDomSetup.mjs';
import '../../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { ContentTypeField } from '../../../models/ContentType';

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { RawIntlProvider } = await import('react-intl');
const { createTestIntl } = await import('../../../../test/createTestIntl.mjs');
const { Provider } = await import('react-redux');
const { configureStore } = await import('@reduxjs/toolkit');
const { atom, createStore, Provider: JotaiProvider } = await import('jotai');
const { createChangedFieldIdsAtom } = await import('../../FormsEngine/lib/formUtils.tsx');
const { createFormVisibilityAtoms } = await import('../../FormsEngine/lib/formVisibility.ts');
const { FormsEngineFormContextApi, ItemMetaContext, StableFormContext, StableGlobalContext } =
	await import('../../FormsEngine/lib/formsEngineContext.ts');
const { DateTimeExpressionInput } = await import('./DateTimeExpressionInput.tsx');

const intl = createTestIntl();
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
	id: 'expire_dt',
	name: 'Expire',
	type: 'date-time',
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

async function render() {
	const validationAtom = atom({ isValid: true, messages: [] });
	const stable = {
		atoms: {
			valueByFieldId: { [field.id]: atom('') },
			validationByFieldId: { [field.id]: validationAtom },
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
										React.createElement(DateTimeExpressionInput, {
											field,
											value: '',
											setValue() {},
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

/** Hovering opens the tooltip, which is what puts aria-describedby on the button. */
async function openTooltip(button: HTMLButtonElement) {
	await act(async () => {
		button.dispatchEvent(new window.MouseEvent('mouseover', { bubbles: true }));
	});
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 200));
	});
}

function helpButton(host: HTMLElement): HTMLButtonElement {
	return Array.from(host.querySelectorAll<HTMLButtonElement>('button[aria-label]')).find(
		(button) => button.getAttribute('aria-label') === 'Date/time expression help'
	);
}

describe('date/time expression help button', () => {
	it('keeps its short name while the tooltip is open', async () => {
		const host = await render();
		const button = helpButton(host);
		assert.ok(button, 'no help button named "Date/time expression help"');
		await openTooltip(button);
		assert.equal(document.querySelectorAll('[role="tooltip"]').length, 1, 'the tooltip did not open');
		assert.equal(button.getAttribute('aria-label'), 'Date/time expression help');
		assert.equal(button.getAttribute('aria-labelledby'), null, 'the help text replaced the button name');
	});

	it('describes the button with the help text', async () => {
		const host = await render();
		const button = helpButton(host);
		await openTooltip(button);
		const describedBy = button.getAttribute('aria-describedby');
		assert.ok(describedBy, 'no aria-describedby once the tooltip is open');
		const description = document.getElementById(describedBy);
		assert.ok(description, `missing described element #${describedBy}`);
		assert.match(description.textContent, /Date expression to process:/);
	});
});
