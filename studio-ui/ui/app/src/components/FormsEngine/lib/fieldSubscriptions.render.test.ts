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
 * Fields subscribe to what they read. An item update (lock, workflow refetch, socket event) that doesn't change a
 * field's own inputs must not re-render the field or give it new data-source inputs, while the source-item label shown
 * in the field chrome still follows that one item, and `expandPath` still reads the current item path.
 */

import '../../../../test/stringListDomSetup.mjs';
import '../../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ComponentType } from 'react';
import type { AnyValue, ControlProps } from '../types';
import type { ContentTypeField } from '../../../models/ContentType';

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { RawIntlProvider, createIntl } = await import('react-intl');
const { Provider, useSelector } = await import('react-redux');
const { configureStore } = await import('@reduxjs/toolkit');
const { atom } = await import('jotai');
const { ResolvedControlRenderer } = await import('./controlHelpers.tsx');
const { FormsEngineField } = await import('../components/FormsEngineField.tsx');
const { FormsEngineFormContextApi, ItemContext, ItemMetaContext, StableFormContext, StableGlobalContext } =
	await import('./formsEngineContext.ts');
const { createFormVisibilityAtoms } = await import('./formVisibility.ts');

type Item = { path: string; label: string; lockOwner?: string };
type ItemsByPath = Record<string, Item>;

const formPath = '/site/website/about/index.xml';
const sourcePath = '/site/website/source/index.xml';

function createItemsStore(initial: ItemsByPath) {
	return configureStore({
		reducer: {
			sites: (state = { active: 'editorial' }) => state,
			content: (
				state: { itemsByPath: ItemsByPath } = { itemsByPath: initial },
				action: { type: string; payload?: { items: ItemsByPath } }
			) => (action.type === 'test/updateItems' ? { itemsByPath: action.payload.items } : state),
			contentTypes: (state = { byId: {}, isFetching: false }) => state
		},
		middleware: (getDefault) => getDefault({ serializableCheck: false, immutableCheck: false })
	});
}

type ItemsStore = ReturnType<typeof createItemsStore>;

function updateItems(store: ItemsStore, change: (items: ItemsByPath) => ItemsByPath) {
	return act(async () => {
		store.dispatch({
			type: 'test/updateItems',
			payload: { items: change(store.getState().content.itemsByPath as ItemsByPath) }
		});
	});
}

let probeSeen: ControlProps<string>[] = [];
function Probe(props: ControlProps<string>) {
	probeSeen.push(props);
	return React.createElement('input', { id: props.inputId, 'data-probe': props.field.id });
}

function fieldFor(id: string): ContentTypeField {
	return { id, name: `Label of ${id}`, type: 'input', validations: {}, helpText: '' } as ContentTypeField;
}

// The test build doesn't add message ids, so derive them from the default message.
const baseIntl = createIntl({ locale: 'en', messages: {}, onError: () => undefined });
const intl = {
	...baseIntl,
	formatMessage: ((descriptor: { id?: string; defaultMessage?: string }, values?: Record<string, unknown>) =>
		baseIntl.formatMessage(
			{ ...descriptor, id: descriptor.id ?? String(descriptor.defaultMessage) } as never,
			values as never
		)) as never
};

const itemBindings = [{ propertyName: 'datasource', interfaces: ['item'], selection: 'single' }] as never;

function createStable(fieldIds: string[], store: ItemsStore, extras: Record<string, unknown> = {}) {
	const valueAtom = atom('x');
	const validationAtom = atom({ isValid: true });
	return {
		atoms: {
			valueByFieldId: Object.fromEntries(fieldIds.map((id) => [id, valueAtom])),
			validationByFieldId: Object.fromEntries(fieldIds.map((id) => [id, validationAtom])),
			...createFormVisibilityAtoms()
		},
		changedFieldIds: new Set<string>(),
		fieldUpdates$: null,
		itemMeta: { id: 'item-id', path: formPath, pathInSite: formPath, sourceMap: null },
		originalValues: {},
		props: null,
		state: null,
		affectedPluginControlFields: [],
		formControllerState: null,
		getItem: () => store.getState().content.itemsByPath[formPath],
		...extras
	};
}

/**
 * Stands in for FormsEngine: provides the live item through `ItemContext` (which changes on every item update) and the
 * stable form context. The children element is created once, so only context and store subscriptions can re-render them.
 */
const stableGlobal = { formsStackData: [], api: { pushForm() {} } } as never;
const formApi = { rollbackField() {} } as never;

function FormHost(props: {
	store: ItemsStore;
	stable: ReturnType<typeof createStable>;
	sourceMap?: Record<string, string>;
	children: React.ReactNode;
}) {
	const { store, stable, sourceMap = null } = props;
	const item = useSelector((state: ReturnType<ItemsStore['getState']>) => state.content.itemsByPath[formPath]);
	const itemMeta = React.useMemo(() => ({ ...stable.itemMeta, sourceMap }), [stable, sourceMap]);
	return React.createElement(
		StableGlobalContext.Provider,
		{ value: stableGlobal },
		React.createElement(
			StableFormContext.Provider,
			{ value: stable as never },
			React.createElement(
				ItemContext.Provider,
				{ value: item as never },
				React.createElement(
					ItemMetaContext.Provider,
					{ value: itemMeta as never },
					React.createElement(FormsEngineFormContextApi.Provider, { value: formApi }, props.children)
				)
			)
		)
	);
}

async function renderTree(store: ItemsStore, tree: React.ReactElement) {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	await act(async () => {
		root.render(React.createElement(Provider, { store }, React.createElement(RawIntlProvider, { value: intl }, tree)));
	});
	// Data sources resolve asynchronously and set state after the first commit.
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 50));
	});
	return host;
}

function profiled(counts: Record<string, number>, id: string, child: React.ReactElement) {
	return React.createElement(
		React.Profiler,
		{
			key: id,
			id,
			onRender: () => {
				counts[id] = (counts[id] ?? 0) + 1;
			}
		},
		child
	);
}

const baseItems = (): ItemsByPath => ({
	[formPath]: { path: formPath, label: 'About' },
	[sourcePath]: { path: sourcePath, label: 'Source' },
	'/site/website/unrelated/index.xml': { path: '/site/website/unrelated/index.xml', label: 'Unrelated' }
});

function renderField(props: { field: ContentTypeField; stable: ReturnType<typeof createStable> }) {
	return React.createElement(ResolvedControlRenderer, {
		key: props.field.id,
		field: props.field,
		autoFocus: false,
		readonly: false,
		contentType: { id: '/component/thing', fields: {} } as never,
		value: 'x',
		setValue: () => undefined,
		Control: Probe as ComponentType<AnyValue>,
		bindings: itemBindings,
		fieldChrome: true
	});
}

describe('field subscriptions', () => {
	it('does not re-render fields or change their data-source inputs on an unrelated item update or a lock change', async () => {
		const store = createItemsStore(baseItems());
		const fieldIds = ['a_s', 'b_s', 'c_s', 'd_s'];
		const stable = createStable(fieldIds, store);
		const counts: Record<string, number> = {};
		probeSeen = [];
		await renderTree(
			store,
			React.createElement(
				FormHost,
				{ store, stable },
				fieldIds.map((id) => profiled(counts, id, renderField({ field: fieldFor(id), stable })))
			)
		);
		const rendersBefore = { ...counts };
		const lastBefore = new Map(fieldIds.map((id) => [id, probeSeen.filter((p) => p.field.id === id).at(-1)]));
		assert.ok(fieldIds.every((id) => rendersBefore[id] > 0));

		await updateItems(store, (items) => ({
			...items,
			'/site/website/unrelated/index.xml': { ...items['/site/website/unrelated/index.xml'], label: 'Changed' }
		}));
		await updateItems(store, (items) => ({ ...items, [formPath]: { ...items[formPath], lockOwner: 'admin' } }));
		await updateItems(store, (items) => ({ ...items, [formPath]: { ...items[formPath], lockOwner: undefined } }));

		assert.deepEqual(counts, rendersBefore, 'No field commits after unrelated item updates');
		for (const id of fieldIds) {
			const last = probeSeen.filter((p) => p.field.id === id).at(-1);
			assert.equal(last.dataSources, lastBefore.get(id).dataSources, `${id} keeps its data-source result`);
			assert.equal(last.dataSources.context.expandPath, lastBefore.get(id).dataSources.context.expandPath);
		}
	});

	it('shows the source item label in the field chrome and follows only that item', async () => {
		const store = createItemsStore(baseItems());
		const stable = createStable(['a_s', 'b_s'], store);
		const counts: Record<string, number> = {};
		probeSeen = [];
		const host = await renderTree(
			store,
			React.createElement(
				FormHost,
				{ store, stable, sourceMap: { a_s: sourcePath } },
				profiled(counts, 'inherited', React.createElement(FormsEngineField, { field: fieldFor('a_s'), menu: false })),
				profiled(counts, 'plain', React.createElement(FormsEngineField, { field: fieldFor('b_s'), menu: false }))
			)
		);
		const inherited = () => host.querySelector('[data-field-id="a_s"]').textContent;
		assert.match(inherited(), /Inherited value from Source is overridden/);

		const rendersBefore = { ...counts };
		await updateItems(store, (items) => ({
			...items,
			'/site/website/unrelated/index.xml': { ...items['/site/website/unrelated/index.xml'], label: 'Changed' }
		}));
		assert.deepEqual(counts, rendersBefore, 'An unrelated item update does not re-render the fields');

		await updateItems(store, (items) => ({
			...items,
			[sourcePath]: { ...items[sourcePath], label: 'Renamed source' }
		}));
		assert.match(inherited(), /Inherited value from Renamed source is overridden/);
		assert.equal(counts.inherited, rendersBefore.inherited + 1);
		assert.equal(counts.plain, rendersBefore.plain, 'Fields without a source item are left alone');
	});

	it('falls back to the source path while the source item is not in the store', async () => {
		const store = createItemsStore({ [formPath]: { path: formPath, label: 'About' } });
		const stable = createStable(['a_s'], store);
		const host = await renderTree(
			store,
			React.createElement(
				FormHost,
				{ store, stable, sourceMap: { a_s: sourcePath } },
				React.createElement(FormsEngineField, { field: fieldFor('a_s'), menu: false })
			)
		);
		assert.match(
			host.querySelector('[data-field-id="a_s"]').textContent,
			new RegExp(`Inherited value from ${sourcePath} is overridden`)
		);
	});

	it('expands path macros with the current item path after the item is renamed or moved', async () => {
		const store = createItemsStore(baseItems());
		const stable = createStable(['a_s'], store);
		probeSeen = [];
		await renderTree(
			store,
			React.createElement(FormHost, { store, stable }, renderField({ field: fieldFor('a_s'), stable }))
		);
		const expandPath = probeSeen.at(-1).dataSources.context.expandPath;
		assert.equal(expandPath('{parentPath}'), 'about');

		const movedPath = '/site/website/company/team/index.xml';
		stable.getItem = () => ({ path: movedPath, label: 'About' }) as never;
		assert.equal(expandPath('{parentPath}'), 'company/team');
		assert.equal(probeSeen.at(-1).dataSources.context.expandPath, expandPath, 'expandPath keeps its identity');
	});

	it('uses the data-source services the form created, instead of building them per field', async () => {
		const store = createItemsStore(baseItems());
		const fieldIds = ['a_s', 'b_s', 'c_s'];
		const services = { createdOnce: true };
		const stable = createStable(fieldIds, store, { dataSourceServices: services });
		probeSeen = [];
		await renderTree(
			store,
			React.createElement(
				FormHost,
				{ store, stable },
				fieldIds.map((id) => renderField({ field: fieldFor(id), stable }))
			)
		);
		const seenServices = fieldIds.map(
			(id) => probeSeen.findLast((p) => p.field.id === id).dataSources.context.services
		);
		assert.equal(seenServices.length, 3);
		for (const seenService of seenServices) assert.equal(seenService, services);
	});
});
