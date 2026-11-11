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
 * What the user sees under a field for the messages a plugin validator returns. Each case runs a real plugin
 * validator through `validateFieldValue` and renders the real `FormsEngineField` with react-intl's formatter,
 * which throws on a descriptor with no `id`.
 */

import '../../../../test/stringListDomSetup.mjs';
import '../../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import type { ComponentType } from 'react';
import type { AnyValue } from '../types';
import type { ContentTypeField } from '../../../models/ContentType';
import type PluginDescriptor from '../../../models/PluginDescriptor';
import type { FieldValidityState, Validator } from './validators.ts';

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { RawIntlProvider, createIntl } = await import('react-intl');
const { createTestIntl } = await import('../../../../test/createTestIntl.mjs');
const { Provider } = await import('react-redux');
const { configureStore } = await import('@reduxjs/toolkit');
const { atom } = await import('jotai');
const { createChangedFieldIdsAtom } = await import('./formUtils.tsx');
const { registerPlugin } = await import('../../../services/plugin.ts');
const { validateFieldValue } = await import('./validators.ts');
const { FormsEngineField } = await import('../components/FormsEngineField.tsx');
const { FormsEngineFormContextApi, ItemMetaContext, StableFormContext, StableGlobalContext } =
	await import('./formsEngineContext.ts');
const { createFormVisibilityAtoms } = await import('./formVisibility.ts');

const source = { site: 'editorial', type: 'control', name: 'example', file: 'index.js' };
const Component = (() => null) as ComponentType<AnyValue>;
const meta = { siteId: 'editorial', itemMeta: { path: '/site/website/index.xml' } };
const fallbackText = "This value couldn't be validated. Try again or contact your administrator.";
const store = configureStore({ reducer: { content: (state = { itemsByPath: {} }) => state } });

let counter = 0;
function plugin(validator: Validator<AnyValue>) {
	const typeKey = `validity-message-${counter++}`;
	registerPlugin(
		{ id: `org.example.${typeKey}`, controls: { [typeKey]: { Component, validator } } } as PluginDescriptor,
		source
	);
	return { id: 'thing_s', name: 'Thing', type: typeKey, validations: {} } as ContentTypeField;
}

function Harness(props: { validity: FieldValidityState; messages: Record<string, string>; children: React.ReactNode }) {
	const valueAtom = atom('x');
	const validationAtom = atom(props.validity);
	const stable = {
		atoms: {
			valueByFieldId: { thing_s: valueAtom },
			validationByFieldId: { thing_s: validationAtom },
			...createFormVisibilityAtoms()
		},
		changedFieldIds: createChangedFieldIdsAtom(),
		fieldUpdates$: null,
		itemMeta: { sourceMap: null },
		originalValues: {},
		props: null,
		state: null,
		affectedPluginControlFields: [],
		formControllerState: null
	};
	return React.createElement(
		Provider,
		{ store },
		React.createElement(
			RawIntlProvider,
			{ value: createTestIntl({ messages: props.messages }) },
			React.createElement(
				StableGlobalContext.Provider,
				{ value: { formsStackData: [], api: {} } },
				React.createElement(
					StableFormContext.Provider,
					{ value: stable },
					React.createElement(
						ItemMetaContext.Provider,
						{ value: { sourceMap: null } },
						React.createElement(FormsEngineFormContextApi.Provider, { value: { rollbackField() {} } }, props.children)
					)
				)
			)
		)
	);
}

/** Validates with the plugin validator, then renders the field the way the form does. Returns the helper texts. */
async function helperTexts(
	validator: Validator<AnyValue>,
	options: { messages?: Record<string, string>; signal?: AbortSignal } = {}
): Promise<string[]> {
	const field = plugin(validator);
	const validity = await validateFieldValue(field, 'x', { ...meta, signal: options.signal });
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	await act(async () => {
		root.render(
			React.createElement(
				Harness,
				{ validity, messages: options.messages ?? {} },
				React.createElement(FormsEngineField, { field })
			)
		);
	});
	const texts = Array.from(host.querySelectorAll('.MuiFormHelperText-root')).map((node) => node.textContent);
	await act(async () => root.unmount());
	host.remove();
	return texts;
}

async function quietly<T>(fn: (error: ReturnType<typeof mock.method>) => Promise<T>): Promise<T> {
	const error = mock.method(console, 'error', () => undefined);
	try {
		return await fn(error);
	} finally {
		error.mock.restore();
	}
}

describe('plugin validator messages in the field', () => {
	it('react-intl throws on a descriptor without an id, which is why the host normalizes them', () => {
		const intl = createIntl({ locale: 'en', onError: () => undefined });
		assert.throws(() => intl.formatMessage({ defaultMessage: 'No id' } as never));
		assert.throws(() => intl.formatMessage({ id: '', defaultMessage: 'Empty id' }));
	});

	it('shows a descriptor with no id by its default message', async () => {
		assert.deepEqual(await helperTexts(() => ({ valid: false, messages: [{ defaultMessage: 'No id here' }] })), [
			'No id here'
		]);
	});

	it('shows a descriptor with an empty id by its default message', async () => {
		assert.deepEqual(
			await helperTexts(() => ({ valid: false, messages: [{ id: '', defaultMessage: 'Empty id here' }] })),
			['Empty id here']
		);
	});

	it('formats the values of a tuple whose descriptor has no id or an empty id', async () => {
		const texts = await helperTexts(() => ({
			valid: false,
			messages: [
				[{ defaultMessage: 'At most {max} items' }, { max: 3 }],
				[{ id: '', defaultMessage: 'At least {min, plural, one {# item} other {# items}}' }, { min: 2 }],
				[{ defaultMessage: 'No values' }]
			]
		}));
		assert.deepEqual(texts, ['At most 3 items', 'At least 2 items', 'No values']);
	});

	it('uses the translation of a descriptor that has an id, and its default message otherwise', async () => {
		const withId = () => ({
			valid: false,
			messages: [{ id: 'org.example.limit', defaultMessage: 'Default limit' }]
		});
		assert.deepEqual(await helperTexts(withId), ['Default limit']);
		assert.deepEqual(await helperTexts(withId, { messages: { 'org.example.limit': 'Translated limit' } }), [
			'Translated limit'
		]);
	});

	it('shows a plain string as is, and keeps the order of the messages', async () => {
		const texts = await helperTexts(() => ({
			valid: false,
			messages: ['Plain {not} formatted', { defaultMessage: 'second' }, 'third']
		}));
		assert.deepEqual(texts, ['Plain {not} formatted', 'second', 'third']);
	});

	it('shows no message for an intentional invalid result without messages', async () => {
		assert.deepEqual(await helperTexts(() => ({ valid: false })), []);
	});

	it('shows the fallback message when the validator throws, rejects or returns a malformed result', async () => {
		await quietly(async (error) => {
			const cases: Array<[string, Validator<AnyValue>]> = [
				[
					'throws',
					() => {
						throw new Error('boom');
					}
				],
				['rejects', () => Promise.reject(new Error('network down'))],
				['malformed result', (() => 'nope') as unknown as Validator<AnyValue>],
				['malformed messages', (() => ({ valid: false, messages: [{}] })) as unknown as Validator<AnyValue>]
			];
			for (const [label, validator] of cases) {
				assert.deepEqual(await helperTexts(validator), [fallbackText], label);
			}
			assert.equal(error.mock.callCount(), cases.length);
			const logged = error.mock.calls.map((call) => String(call.arguments[0]));
			assert.ok(logged.every((text) => !text.includes(fallbackText)));
		});
	});

	it('shows nothing, and logs nothing, when the host aborted the run the validator is failing', async () => {
		await quietly(async (error) => {
			const controller = new AbortController();
			const texts = await helperTexts(
				async () => {
					controller.abort();
					throw new DOMException('aborted', 'AbortError');
				},
				{ signal: controller.signal }
			);
			assert.deepEqual(texts, []);
			assert.equal(error.mock.callCount(), 0);
		});
	});
});
