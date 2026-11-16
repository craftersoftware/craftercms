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
 * Blur announces an invalid field only after its value atom changes.
 * Select and the rich text editor commit through that atom, not a bubbling input event.
 * An untouched field stays quiet.
 */

import '../../../../test/stringListDomSetup.mjs';
import '../../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { ComponentType } from 'react';
import type { ContentTypeField } from '../../../models/ContentType';

// The emptiness check for an RTE reads text through DOMParser. The test DOM is jsdom's.
globalThis.DOMParser = window.DOMParser;

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { RawIntlProvider } = await import('react-intl');
const { createTestIntl } = await import('../../../../test/createTestIntl.mjs');

const intl = createTestIntl();

const { Provider } = await import('react-redux');
const { configureStore } = await import('@reduxjs/toolkit');
const { atom, createStore, Provider: JotaiProvider } = await import('jotai');
const { createChangedFieldIdsAtom, createFieldAtoms } = await import('../lib/formUtils.tsx');
const { Subject } = await import('rxjs');
const { createFormVisibilityAtoms } = await import('../lib/formVisibility.ts');
const { FormsEngineFormContextApi, ItemMetaContext, StableFormContext, StableGlobalContext } =
	await import('../lib/formsEngineContext.ts');
const { FormValidationAnnouncerContext } = await import('../lib/fieldA11y.ts');
const { Text } = await import('../controls/Text.tsx');
const { Dropdown } = await import('../controls/Dropdown.tsx');
const { RichTextEditor } = await import('../controls/RichTextEditor.tsx');

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

function fieldFor(id: string, name: string, type: string): ContentTypeField {
	return {
		id,
		name,
		type,
		description: `Describe ${name}`,
		helpText: '',
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

async function renderInvalidField(
	Control: ComponentType<any>,
	field: ContentTypeField,
	announcements: string[],
	initial: unknown
) {
	const store = createStore();
	const valueAtom = atom(initial);
	const validationAtom = atom({ isValid: false, messages: [`${field.name} is required`] });
	const stable = {
		atoms: {
			valueByFieldId: {
				[field.id]: valueAtom,
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
						{ store },
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
											React.createElement(Control, {
												field,
												value: initial,
												setValue(next: unknown) {
													store.set(valueAtom, next);
												},
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
		);
	});
	mounted.push({ unmount: () => root.unmount(), host });
	return { host, store, valueAtom };
}

/** Focus leaves the field. The value atom, not a DOM input event, is what marks it edited. */
async function leaveField(host: HTMLElement) {
	const fieldRoot = host.querySelector<HTMLElement>('[data-field-id]');
	assert.ok(fieldRoot);
	const outside = document.createElement('button');
	document.body.appendChild(outside);
	await act(async () => {
		fieldRoot.dispatchEvent(new window.FocusEvent('focusout', { bubbles: true, relatedTarget: outside }));
	});
	outside.remove();
}

describe('field blur announcement', () => {
	it('does not announce when an untouched invalid field blurs', async () => {
		const announcements: string[] = [];
		const field = fieldFor('title_s', 'Title', 'input');
		const { host } = await renderInvalidField(Text, field, announcements, '');
		assert.match(host.textContent ?? '', /Title is required/);
		await leaveField(host);
		assert.deepEqual(announcements, []);
	});

	it('announces when an edited invalid text field blurs', async () => {
		const announcements: string[] = [];
		const field = fieldFor('title_s', 'Title', 'input');
		const { host, store, valueAtom } = await renderInvalidField(Text, field, announcements, '');
		await act(async () => {
			store.set(valueAtom, 'Hello');
		});
		await leaveField(host);
		assert.deepEqual(announcements, ['Title: Title is required']);
	});

	it('announces when an edited invalid dropdown blurs', async () => {
		const announcements: string[] = [];
		const field = fieldFor('section_s', 'Section', 'dropdown');
		const { host, store, valueAtom } = await renderInvalidField(Dropdown, field, announcements, '');
		await act(async () => {
			store.set(valueAtom, 'news');
		});
		await leaveField(host);
		assert.deepEqual(announcements, ['Section: Section is required']);
	});

	describe('Options menu', () => {
		const optionsButton = (host: HTMLElement) =>
			host.querySelector<HTMLButtonElement>('[data-field-id] button[aria-haspopup="menu"]')!;
		const press = (element: Element, key: string) =>
			act(async () => {
				element.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
			});

		async function openMenuOnEditedField(announcements: string[]) {
			const field = fieldFor('title_s', 'Title', 'input');
			const rendered = await renderInvalidField(Text, field, announcements, '');
			await act(async () => {
				rendered.store.set(rendered.valueAtom, 'Hello');
			});
			const button = optionsButton(rendered.host);
			await act(async () => {
				button.focus();
			});
			await act(async () => {
				button.click();
			});
			const menu = document.querySelector<HTMLElement>('[role="menu"]');
			assert.ok(menu);
			assert.ok(menu.contains(document.activeElement), 'focus moves into the menu');
			return { ...rendered, button, menu };
		}

		it('does not announce when focus moves into the menu or between its items', async () => {
			const announcements: string[] = [];
			await openMenuOnEditedField(announcements);
			assert.deepEqual(announcements, []);
			await press(document.activeElement!, 'ArrowDown');
			await press(document.activeElement!, 'ArrowDown');
			await press(document.activeElement!, 'ArrowUp');
			assert.deepEqual(announcements, []);
		});

		it('still announces once when focus leaves the field after the menu closed', async () => {
			const announcements: string[] = [];
			const { host, button } = await openMenuOnEditedField(announcements);
			await press(document.activeElement!, 'Escape');
			await act(async () => {
				await new Promise((resolve) => setTimeout(resolve, 400));
			});
			assert.equal(document.activeElement, button);
			assert.deepEqual(announcements, []);
			await leaveField(host);
			assert.deepEqual(announcements, ['Title: Title is required']);
		});
	});

	async function renderTrackedTitle(announcements: string[]) {
		const field = fieldFor('title_s', 'Title', 'input');
		const fieldUpdates$ = new Subject<{ fieldId: string; origin?: 'controller' | 'rollback' }>();
		const tracking = {
			fieldUpdates$,
			changedFieldIds: createChangedFieldIdsAtom(),
			originalValues: { title_s: '' },
			atoms: null as never,
			itemMeta,
			formControllerState: null,
			valueWriteOrigin: undefined as 'controller' | 'rollback' | undefined
		};
		const [valueAtom] = createFieldAtoms(field, '', { current: tracking });
		const validationAtom = atom({ isValid: false, messages: ['Title is required'] });
		const store = createStore();
		const stable = {
			atoms: {
				valueByFieldId: {
					[field.id]: valueAtom,
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
			changedFieldIds: tracking.changedFieldIds,
			fieldUpdates$,
			itemMeta,
			originalValues: tracking.originalValues,
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
							{ store },
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
												React.createElement(Text, {
													field,
													value: '',
													setValue(next: unknown) {
														store.set(valueAtom, next);
													},
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
			);
		});
		mounted.push({ unmount: () => root.unmount(), host });
		return { host, store, valueAtom, tracking };
	}

	it('does not announce when a controller or a rollback writes the value', async () => {
		const announcements: string[] = [];
		const { host, store, valueAtom, tracking } = await renderTrackedTitle(announcements);
		tracking.valueWriteOrigin = 'controller';
		await act(async () => {
			store.set(valueAtom, 'from-controller');
		});
		tracking.valueWriteOrigin = undefined;
		await leaveField(host);
		assert.deepEqual(announcements, []);
		tracking.valueWriteOrigin = 'rollback';
		await act(async () => {
			store.set(valueAtom, '');
		});
		tracking.valueWriteOrigin = undefined;
		await leaveField(host);
		assert.deepEqual(announcements, []);
		await act(async () => {
			store.set(valueAtom, 'typed');
		});
		await leaveField(host);
		assert.deepEqual(announcements, ['Title: Title is required']);
	});

	it('announces an author edit that follows a same-value controller write', async () => {
		const announcements: string[] = [];
		const { host, store, valueAtom, tracking } = await renderTrackedTitle(announcements);
		tracking.valueWriteOrigin = 'controller';
		await act(async () => {
			store.set(valueAtom, '');
		});
		tracking.valueWriteOrigin = undefined;
		await act(async () => {
			store.set(valueAtom, 'typed');
		});
		await leaveField(host);
		assert.deepEqual(announcements, ['Title: Title is required']);
	});

	it('announces an author edit that follows a rollback of an unchanged field', async () => {
		const announcements: string[] = [];
		const { host, store, valueAtom, tracking } = await renderTrackedTitle(announcements);
		tracking.valueWriteOrigin = 'rollback';
		await act(async () => {
			store.set(valueAtom, '');
		});
		tracking.valueWriteOrigin = undefined;
		await act(async () => {
			store.set(valueAtom, 'typed');
		});
		await leaveField(host);
		assert.deepEqual(announcements, ['Title: Title is required']);
	});

	it('announces when an edited invalid rich text field blurs', async () => {
		const announcements: string[] = [];
		const field = fieldFor('body_html', 'Body', 'rte');
		const { host, store, valueAtom } = await renderInvalidField(RichTextEditor, field, announcements, '');
		await act(async () => {
			store.set(valueAtom, '<p>Hello</p>');
		});
		await leaveField(host);
		assert.deepEqual(announcements, ['Body: Body is required']);
	});
});
