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
 * FormsEngineField renders the field label with the host's labelId. The locale Select has to receive that same
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
const { LocaleSelector } = await import('./LocaleSelector.tsx');
const { accessibleName } = await import('../../../../test/accessibleName.ts');

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
	id: 'locale_s',
	name: 'Locale',
	type: 'locale-selector',
	description: '',
	helpText: '',
	validations: {},
	properties: {},
	defaultValue: ''
} as ContentTypeField;

const OriginalXHR = window.XMLHttpRequest;

function installLocaleResponse() {
	function FakeXHR(this: {
		status: number;
		readyState: number;
		response: unknown;
		responseType: string;
		listeners: Record<string, Array<(event: { type: string }) => void>>;
	}) {
		this.status = 0;
		this.readyState = 0;
		this.response = null;
		this.responseType = '';
		this.listeners = {};
	}
	FakeXHR.prototype.open = function () {};
	FakeXHR.prototype.setRequestHeader = function () {};
	FakeXHR.prototype.getAllResponseHeaders = function () {
		return null;
	};
	FakeXHR.prototype.abort = function () {
		this.readyState = 4;
	};
	FakeXHR.prototype.addEventListener = function (type: string, fn: (event: { type: string }) => void) {
		(this.listeners[type] ??= []).push(fn);
	};
	FakeXHR.prototype.removeEventListener = function () {};
	FakeXHR.prototype.send = function () {
		const body = { config: { localeCodes: ['en', 'es'], defaultLocaleCode: 'en' } };
		this.status = 200;
		this.readyState = 4;
		this.response = this.responseType === 'json' ? body : JSON.stringify(body);
		const listeners = this.listeners.load ?? [];
		queueMicrotask(() => {
			for (const fn of listeners) fn({ type: 'load' });
		});
	};
	const xhr = FakeXHR as unknown as typeof XMLHttpRequest;
	globalThis.XMLHttpRequest = xhr;
	window.XMLHttpRequest = xhr;
}

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	globalThis.XMLHttpRequest = OriginalXHR;
	window.XMLHttpRequest = OriginalXHR;
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
});

async function render() {
	installLocaleResponse();
	const validationAtom = atom({ isValid: true, messages: [] });
	const stable = {
		atoms: {
			valueByFieldId: { locale_s: atom('en') },
			validationByFieldId: { locale_s: validationAtom },
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
										React.createElement(LocaleSelector, {
											field,
											value: 'en',
											setValue() {},
											contentType,
											readonly: false,
											autoFocus: false,
											inputId: 'locale_s-input',
											labelId: 'locale_s-label'
										})
									)
								)
							)
						)
					)
				)
			)
		);
		await new Promise((resolve) => setTimeout(resolve, 30));
	});
	mounted.push({ unmount: () => root.unmount(), host });
	return host;
}

describe('forms engine locale selector names', () => {
	it('names the combobox and the open listbox from the field label', async () => {
		const host = await render();
		const combobox = host.querySelector<HTMLElement>('[role="combobox"]');
		assert.ok(combobox, 'the locale combobox is missing');
		assert.equal(combobox.getAttribute('aria-labelledby'), 'locale_s-label');
		assert.equal(accessibleName(combobox), 'Locale');
		await act(async () => {
			combobox.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, button: 0 }));
		});
		const listbox = document.querySelector<HTMLElement>('[role="listbox"]');
		assert.ok(listbox, 'the locale listbox did not open');
		assert.equal(listbox.getAttribute('aria-labelledby'), 'locale_s-label');
		assert.equal(accessibleName(listbox), 'Locale');
	});
});
