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
 * Blur announces an invalid field only after the user has edited it.
 * An untouched field stays quiet, including after Save.
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

// The app build gives every message an id. Without that transform, use the default message as its own id.
const baseIntl = createIntl({ locale: 'en', messages: {}, onError() {} });
const intl = {
	...baseIntl,
	formatMessage: (descriptor: { id?: string; defaultMessage?: string }, values?: Record<string, unknown>) =>
		baseIntl.formatMessage(
			{ ...descriptor, id: descriptor.id ?? String(descriptor.defaultMessage) } as never,
			values as never
		)
};

const { Provider } = await import('react-redux');
const { configureStore } = await import('@reduxjs/toolkit');
const { atom, createStore, Provider: JotaiProvider } = await import('jotai');
const { createChangedFieldIdsAtom } = await import('../lib/formUtils.tsx');
const { createFormVisibilityAtoms } = await import('../lib/formVisibility.ts');
const { FormsEngineFormContextApi, ItemMetaContext, StableFormContext, StableGlobalContext } =
	await import('../lib/formsEngineContext.ts');
const { FormSaveAttemptedContext, FormValidationAnnouncerContext } = await import('../lib/fieldA11y.ts');
const { Text } = await import('../controls/Text.tsx');

window.matchMedia = (query: string) =>
	({
		matches: false,
		media: query,
		addEventListener() {},
		removeEventListener() {},
		addListener() {},
		removeListener() {},
		dispatchEvent: () => false
	}) as MediaQueryList;
globalThis.InputEvent ??= window.InputEvent ?? (class InputEvent extends Event {} as unknown as typeof InputEvent);

const redux = configureStore({
	reducer: {
		sites: (state = { active: 'editorial', byId: {} }) => state,
		content: (state = { itemsByPath: {} }) => state,
		contentTypes: (state = { byId: {}, isFetching: false }) => state,
		preview: (state = { richTextEditor: { generic: { id: 'generic', tinymceOptions: {} } } }) => state,
		uiConfig: (state = { currentSite: 'editorial', isFetching: false, xml: null }) => state
	}
});

const contentType = { id: '/page/home', type: 'page', fields: {}, sections: [] };
const itemMeta = {
	sourceMap: null,
	path: '/site/website/index.xml',
	pathInSite: '/site/website',
	contentType
};

const field = {
	id: 'title_s',
	name: 'Title',
	type: 'input',
	description: 'The page title',
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

async function renderInvalidField(announcements: string[]) {
	const validationAtom = atom({ isValid: false, messages: ['Title is required'] });
	const stable = {
		atoms: {
			valueByFieldId: {
				[field.id]: atom(''),
				'internal-name': atom('Home'),
				orderDefault_f: atom(1)
			},
			validationByFieldId: {
				[field.id]: validationAtom,
				'file-name': validationAtom
			},
			fileName: atom(''),
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
										React.createElement(
											FormValidationAnnouncerContext.Provider,
											{ value: (message: string) => announcements.push(message) },
											React.createElement(
												FormSaveAttemptedContext.Provider,
												{ value: true },
												React.createElement(Text, {
													field,
													value: '',
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
				)
			)
		);
	});
	mounted.push({ unmount: () => root.unmount(), host });
	return host;
}

/** Move focus out of the field. `edit` fires the input event the field treats as an edit. */
async function leaveField(host: HTMLElement, edit: boolean) {
	const input = host.querySelector('input');
	assert.ok(input);
	const outside = document.createElement('button');
	document.body.appendChild(outside);
	await act(async () => {
		input.focus();
		if (edit) input.dispatchEvent(new InputEvent('input', { bubbles: true }));
		outside.focus();
	});
	outside.remove();
}

describe('field blur announcement', () => {
	it('does not announce when an untouched invalid field blurs after Save', async () => {
		const announcements: string[] = [];
		const host = await renderInvalidField(announcements);
		assert.match(host.textContent ?? '', /Title is required/);
		await leaveField(host, false);
		assert.deepEqual(announcements, []);
	});

	it('announces when an edited invalid field blurs', async () => {
		const announcements: string[] = [];
		const host = await renderInvalidField(announcements);
		await leaveField(host, true);
		assert.deepEqual(announcements, ['Title: Title is required']);
	});
});
