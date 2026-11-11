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
 * Each wired control's aria-describedby points at elements FormsEngineField actually renders,
 * both while the field is invalid and once it is valid again. The page-nav radio group is named
 * by the field label.
 */

import '../../../../test/stringListDomSetup.mjs';
import '../../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { ComponentType } from 'react';
import type { ContentTypeField } from '../../../models/ContentType';

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { RawIntlProvider } = await import('react-intl');
const { createTestIntl } = await import('../../../../test/createTestIntl.mjs');

const intl = createTestIntl();
const { Provider } = await import('react-redux');
const { configureStore } = await import('@reduxjs/toolkit');
const { atom, createStore, Provider: JotaiProvider } = await import('jotai');
const { createChangedFieldIdsAtom } = await import('./formUtils.tsx');
const { createFormVisibilityAtoms } = await import('./formVisibility.ts');
const { FormsEngineFormContextApi, ItemMetaContext, StableFormContext, StableGlobalContext } =
	await import('./formsEngineContext.ts');
const { Text } = await import('../controls/Text.tsx');
const { Textarea } = await import('../controls/Textarea.tsx');
const { Checkbox } = await import('../controls/Checkbox.tsx');
const { Numeric } = await import('../controls/Numeric.tsx');
const { Dropdown } = await import('../controls/Dropdown.tsx');
const { FileName } = await import('../controls/FileName.tsx');
const { LocaleSelector } = await import('../controls/LocaleSelector.tsx');
const { PageNavOrder } = await import('../controls/PageNavOrder.tsx');
const { RichTextEditor } = await import('../controls/RichTextEditor.tsx');

// LocaleSelector loads through XHR. A successful translation config lets the select render.
function LocaleXHR(this: { status: number; response: unknown; readyState: number; onload: (() => void) | null }) {
	const listeners: Record<string, Array<() => void>> = {};
	this.status = 0;
	this.response = null;
	this.readyState = 0;
	this.onload = null;
	this.open = () => undefined;
	this.abort = () => undefined;
	this.getAllResponseHeaders = () => '';
	this.setRequestHeader = () => undefined;
	this.upload = { addEventListener() {} };
	this.addEventListener = (type: string, listener: (event?: unknown) => void) => {
		(listeners[type] ??= []).push(listener);
	};
	this.removeEventListener = () => undefined;
	this.send = () => {
		queueMicrotask(() => {
			this.status = 200;
			this.response = { config: { localeCodes: ['en'], defaultLocaleCode: 'en' } };
			this.readyState = 4;
			const event = { type: 'load', loaded: 1, total: 1 };
			this.onload?.();
			for (const listener of listeners.load ?? []) listener(event);
			for (const listener of listeners.readystatechange ?? []) listener(event);
		});
	};
}
// rxjs looks up XMLHttpRequest as a free global, which jsdom does not install on Node's global.
globalThis.XMLHttpRequest = LocaleXHR as unknown as typeof XMLHttpRequest;
window.XMLHttpRequest = globalThis.XMLHttpRequest;
globalThis.InputEvent ??= window.InputEvent ?? (class InputEvent extends Event {} as unknown as typeof InputEvent);
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
const cssEscape = (value: string) =>
	window.CSS?.escape?.(value) ?? value.replace(/[^a-zA-Z0-9_-]/g, (character) => `\\${character}`);

// The rich text editor links its iframe from TinyMCE's init. A stub editor is enough to reach that path.
(window as unknown as { tinymce: unknown }).tinymce = {
	util: { Tools: { resolve: () => ({ waitFor() {}, get: () => null }) } },
	init(options: { target: HTMLElement; setup(editor: unknown): void; init_instance_callback?(editor: unknown): void }) {
		const iframe = document.createElement('iframe');
		iframe.className = 'tox-edit-area__iframe';
		options.target.parentElement?.appendChild(iframe);
		const listeners: Record<string, Array<(event: unknown, editor: unknown) => void>> = {};
		const editor = {
			iframeElement: iframe,
			getContainer: () => iframe.parentElement ?? iframe,
			initialized: true,
			getContent: () => '',
			setContent() {},
			once() {},
			on(event: string, handler: (event: unknown, editor: unknown) => void) {
				(listeners[event] ??= []).push(handler);
				// tinymce-react registers the React onInit prop as the 'Init' event.
				if (event.toLowerCase() === 'init') handler({}, editor);
			},
			off() {},
			remove() {},
			undoManager: {
				clear() {},
				add() {},
				transact(fn: () => void) {
					fn();
				}
			},
			setDirty() {},
			mode: { set() {} },
			options: { set() {}, register() {} },
			hasFocus: () => false
		};
		options.setup(editor);
		options.init_instance_callback?.(editor);
	}
};

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

function fieldFor(id: string): ContentTypeField {
	return {
		id,
		name: `Name of ${id}`,
		type: 'input',
		description: `Describe ${id}`,
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

function describedByTargets(host: HTMLElement): Element[] {
	return [...host.querySelectorAll<HTMLElement>('[aria-describedby]')];
}

function assertTargetsExist(host: HTMLElement, invalid: boolean) {
	const nodes = describedByTargets(host);
	assert.ok(nodes.length > 0, 'the control exposes aria-describedby');
	for (const node of nodes) {
		const ids = node.getAttribute('aria-describedby')!.split(/\s+/).filter(Boolean);
		assert.ok(ids.length > 0);
		for (const id of ids) {
			assert.ok(host.querySelector(`#${cssEscape(id)}`), `missing described element #${id}`);
		}
		const described = ids.join(' ');
		if (invalid) {
			assert.match(described, /-error(?:\s|$)/);
			assert.match(described, /-description(?:\s|$)/);
		} else {
			assert.match(described, /-description(?:\s|$)/);
			assert.doesNotMatch(described, /-error(?:\s|$)/);
			assert.equal(host.querySelector('[id$="-error"]'), null);
		}
	}
}

async function renderControl(Control: ComponentType<any>, field: ContentTypeField, valid: boolean, value: unknown) {
	const validationAtom = atom({ isValid: valid, messages: [] });
	const stable = {
		atoms: {
			valueByFieldId: {
				[field.id]: atom(value),
				'internal-name': atom('Home'),
				orderDefault_f: atom(1)
			},
			validationByFieldId: {
				[field.id]: validationAtom,
				'file-name': validationAtom
			},
			fileName: atom(field.id === 'file-name' ? 'index' : ''),
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
	// Locale fetch and the dropdown's option effect settle on a later turn.
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 30));
	});
	mounted.push({ unmount: () => root.unmount(), host });
	return host;
}

const controls: Array<{ name: string; Control: ComponentType<any>; id: string; value: unknown }> = [
	{ name: 'Text', Control: Text, id: 'title_s', value: 'Hello' },
	{ name: 'Textarea', Control: Textarea, id: 'body_t', value: 'Hello' },
	{ name: 'Checkbox', Control: Checkbox, id: 'featured_b', value: false },
	{ name: 'Numeric', Control: Numeric, id: 'count_i', value: 1 },
	{ name: 'Dropdown', Control: Dropdown, id: 'section_s', value: '' },
	{ name: 'FileName', Control: FileName, id: 'file-name', value: 'index' },
	{ name: 'LocaleSelector', Control: LocaleSelector, id: 'locale_s', value: 'en' },
	{ name: 'PageNavOrder', Control: PageNavOrder, id: 'placeInNav_b', value: false },
	{ name: 'RichTextEditor', Control: RichTextEditor, id: 'body_html', value: '<p>Hello</p>' }
];

describe('wired control descriptions', () => {
	for (const { name, Control, id, value } of controls) {
		it(`${name} points aria-describedby at the ids the field renders when invalid`, async () => {
			const host = await renderControl(Control, fieldFor(id), false, value);
			assertTargetsExist(host, true);
		});

		it(`${name} keeps the description id and drops the error id when valid`, async () => {
			const host = await renderControl(Control, fieldFor(id), true, value);
			assertTargetsExist(host, false);
		});
	}

	it('names the page navigation radio group with the field label', async () => {
		const field = fieldFor('placeInNav_b');
		const host = await renderControl(PageNavOrder, field, true, false);
		const group = host.querySelector('[role="radiogroup"]');
		assert.ok(group);
		const labelId = group.getAttribute('aria-labelledby');
		assert.ok(labelId);
		const label = host.querySelector(`#${cssEscape(labelId)}`);
		assert.ok(label);
		assert.equal(label.textContent?.trim(), field.name);
		assert.equal(label.getAttribute('for'), null);
		assert.equal(group.getAttribute('aria-invalid'), null);
	});

	it('keeps the page navigation Required description target exposed to assistive technology', async () => {
		const field = {
			...fieldFor('placeInNav_b'),
			validations: { required: { id: 'required', value: true, level: 'required' } }
		} as ContentTypeField;
		const host = await renderControl(PageNavOrder, field, true, false);
		const group = host.querySelector('[role="radiogroup"]');
		assert.ok(group);
		const required = Array.from(group.querySelectorAll('span')).find((span) => span.textContent === 'Required');
		assert.ok(required?.id);
		assert.equal(required.hasAttribute('aria-hidden'), false);
		assert.ok(group.getAttribute('aria-describedby')?.split(/\s+/).includes(required.id));
	});
});
