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
 * A plugin control as the form renders it: inside one FormsEngineField by default, bare when the contribution opts
 * out, with ids that are unique per instance and wired to the label, and the load-error placeholder wrapped once.
 * The control is mapped by the loader (toLoadedControlPlugin) and rendered by the real ResolvedControlRenderer.
 * The load-error placeholder is a stand-in that wraps itself the way the real one does.
 */

import '../../../../test/stringListDomSetup.mjs';
import '../../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ComponentType } from 'react';
import type { AnyValue, ControlProps } from '../types';
import type { ContentTypeField } from '../../../models/ContentType';
import type PluginDescriptor from '../../../models/PluginDescriptor';

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { RawIntlProvider } = await import('react-intl');
const { createTestIntl } = await import('../../../../test/createTestIntl.mjs');
const { Provider } = await import('react-redux');
const { configureStore } = await import('@reduxjs/toolkit');
const { atom } = await import('jotai');
const { createChangedFieldIdsAtom } = await import('./formUtils.tsx');
const { registerPlugin } = await import('../../../services/plugin.ts');
const { getRegisteredControlContribution } = await import('../controls/registry.ts');
const { toLoadedControlPlugin } = await import('./controlPluginLoader.ts');
const { ResolvedControlRenderer } = await import('./renderControl.tsx');
const { FormsEngineField } = await import('../components/FormsEngineField.tsx');
const { FormsEngineFormContextApi, ItemMetaContext, StableFormContext, StableGlobalContext } =
	await import('./formsEngineContext.ts');
const { createFormVisibilityAtoms } = await import('./formVisibility.ts');

const source = { site: 'editorial', type: 'control', name: 'example', file: 'index.js' };
const url = '/studio/api/2/plugin/file?type=control&name=example&filename=index.js';
const store = configureStore({
	reducer: {
		sites: (state = { active: 'editorial' }) => state,
		content: (state = { itemsByPath: {} }) => state,
		contentTypes: (state = { byId: {}, isFetching: false }) => state
	}
});

const seen: ControlProps<string>[] = [];
function Probe(props: ControlProps<string>) {
	seen.push(props);
	return React.createElement('input', {
		id: props.inputId,
		'aria-labelledby': props.labelId,
		'data-probe': props.field.id
	});
}

// Stands for ControlPluginError, which wraps itself in FormsEngineField. The real one formats a message with no id
// here, because the test build doesn't add ids.
function ErrorPlaceholder({ field }: ControlProps) {
	return React.createElement(
		FormsEngineField,
		{ field, menu: false },
		React.createElement('p', null, 'Unable to load')
	);
}

let counter = 0;
function loadedControl(entry: Record<string, unknown> = {}) {
	const typeKey = `chrome-render-${counter++}`;
	registerPlugin(
		{
			id: `org.example.${typeKey}`,
			controls: { [typeKey]: { Component: Probe as ComponentType<AnyValue>, ...entry } }
		} as PluginDescriptor,
		source
	);
	const loaded = toLoadedControlPlugin(
		{ id: `org.example.${typeKey}` },
		getRegisteredControlContribution(typeKey),
		typeKey,
		url,
		ErrorPlaceholder as ComponentType<AnyValue>
	);
	return { typeKey, loaded };
}

function fieldFor(id: string, type: string): ContentTypeField {
	return { id, name: `Label of ${id}`, type, validations: {}, helpText: '' } as ContentTypeField;
}

const intl = createTestIntl();

function Harness(props: { fieldIds: string[]; children: React.ReactNode }) {
	const valueAtom = atom('x');
	const validationAtom = atom({ isValid: true });
	const stable = {
		atoms: {
			valueByFieldId: Object.fromEntries(props.fieldIds.map((id) => [id, valueAtom])),
			validationByFieldId: Object.fromEntries(props.fieldIds.map((id) => [id, validationAtom])),
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
			{ value: intl },
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

type Loaded = ReturnType<typeof loadedControl>['loaded'];

/** Renders one ResolvedControlRenderer per field, the way PluginControlRenderer does for a loaded plugin. */
async function render(entries: Array<{ field: ContentTypeField; loaded: Loaded }>): Promise<HTMLElement> {
	seen.length = 0;
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	await act(async () => {
		root.render(
			React.createElement(
				Harness,
				{ fieldIds: entries.map(({ field }) => field.id) },
				entries.map(({ field, loaded }) =>
					React.createElement(ResolvedControlRenderer, {
						key: field.id,
						field,
						autoFocus: false,
						readonly: false,
						contentType: { id: '/component/thing', fields: {} } as never,
						value: 'x',
						setValue: () => undefined,
						Control: loaded.Component as ComponentType<AnyValue>,
						bindings: loaded.bindings,
						fieldChrome: loaded.fieldChrome,
						fieldSx: loaded.fieldSx
					})
				)
			)
		);
	});
	return host;
}

describe('plugin control field chrome', () => {
	it('wraps a control in one FormsEngineField by default, labelled by the generated ids', async () => {
		const { typeKey, loaded } = loadedControl();
		const field = fieldFor('thing_s', typeKey);
		const host = await render([{ field, loaded }]);
		const wrappers = host.querySelectorAll('[data-field-id="thing_s"]');
		assert.equal(wrappers.length, 1);
		const label = wrappers[0].querySelector('label') as HTMLLabelElement;
		assert.equal(label.textContent?.trim(), 'Label of thing_s');
		const input = host.querySelector('[data-probe="thing_s"]') as HTMLInputElement;
		assert.ok(wrappers[0].contains(input));
		assert.equal(label.htmlFor, input.id);
		assert.equal(input.getAttribute('aria-labelledby'), label.id);
		assert.ok(input.id && label.id && input.id !== label.id);
	});

	it('gives each instance of the same control its own ids', async () => {
		const { typeKey, loaded } = loadedControl();
		const host = await render([
			{ field: fieldFor('first_s', typeKey), loaded },
			{ field: fieldFor('second_s', typeKey), loaded }
		]);
		assert.equal(host.querySelectorAll('[data-field-id]').length, 2);
		const ids = seen.flatMap((props) => [props.inputId, props.labelId]);
		assert.equal(ids.length, 4);
		assert.equal(new Set(ids).size, 4);
		for (const id of ids) assert.equal(host.querySelectorAll(`[id="${id}"]`).length <= 1, true);
	});

	it('renders a control that opted out bare, with the ids still passed', async () => {
		const { typeKey, loaded } = loadedControl({ fieldChrome: false });
		const host = await render([{ field: fieldFor('thing_s', typeKey), loaded }]);
		assert.equal(host.querySelectorAll('[data-field-id]').length, 0);
		assert.equal(host.querySelectorAll('label').length, 0);
		assert.ok(host.querySelector('[data-probe="thing_s"]'));
		assert.ok(seen[0].inputId && seen[0].labelId);
	});

	it('applies fieldSx to the wrapper, and ignores it when the control opted out', async () => {
		const wrapped = loadedControl({ fieldSx: { mt: 3 } });
		const host = await render([{ field: fieldFor('thing_s', wrapped.typeKey), loaded: wrapped.loaded }]);
		const wrapper = host.querySelector('[data-field-id="thing_s"]') as HTMLElement;
		assert.equal(getComputedStyle(wrapper).marginTop, '24px');
		const bare = loadedControl({ fieldChrome: false, fieldSx: { mt: 3 } });
		const bareHost = await render([{ field: fieldFor('thing_s', bare.typeKey), loaded: bare.loaded }]);
		assert.equal(bareHost.querySelectorAll('[data-field-id]').length, 0);
	});

	it('wraps the load-error placeholder once, because it wraps itself', async () => {
		const field = fieldFor('thing_s', 'chrome-render-missing');
		const loaded = toLoadedControlPlugin(
			{ id: 'org.example.missing' },
			undefined,
			field.type,
			url,
			ErrorPlaceholder as ComponentType<AnyValue>
		);
		const originalError = console.error;
		console.error = () => undefined;
		try {
			assert.equal(loaded.fieldChrome, false);
			const host = await render([{ field, loaded }]);
			assert.equal(host.querySelectorAll('[data-field-id="thing_s"]').length, 1);
			assert.match(host.textContent ?? '', /Unable to load/);
		} finally {
			console.error = originalError;
		}
	});
});
