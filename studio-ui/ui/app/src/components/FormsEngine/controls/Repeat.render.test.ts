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
 * The real Repeat in a form context. Rows are tied to their items by key, so a delete, a reorder or an edit moves the
 * DOM row with the item. Remove reads the stored array, so an item form save that landed after the render is kept.
 */

import '../../../../test/stringListDomSetup.mjs';
import '../../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { ContentTypeField } from '../../../models/ContentType';
import type ContentType from '../../../models/ContentType';

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { RawIntlProvider, createIntl } = await import('react-intl');
const { Provider: ReduxProvider } = await import('react-redux');
const { configureStore } = await import('@reduxjs/toolkit');
const { atom, createStore, Provider: JotaiProvider } = await import('jotai');
const { Repeat } = await import('./Repeat.tsx');
const { FormsEngineFormContextApi, ItemMetaContext, StableFormContext, StableGlobalContext } =
	await import('../lib/formsEngineContext.ts');
const { createFormVisibilityAtoms } = await import('../lib/formVisibility.ts');
const { valueSerializersLookup } = await import('../lib/valueSerializers.ts');

type Item = Record<string, unknown>;

const reduxStore = configureStore({
	reducer: {
		sites: (state = { active: 'editorial' }) => state,
		content: (state = { itemsByPath: {} }) => state,
		contentTypes: (state = { byId: {}, isFetching: false }) => state
	}
});

// The test build adds no message ids, and react-intl throws on a descriptor without one. Use the default message.
const baseIntl = createIntl({ locale: 'en', onError: () => undefined });
const intl = { ...baseIntl, formatMessage: (descriptor: { defaultMessage?: string }) => descriptor.defaultMessage };

const field = {
	id: 'rows_o',
	name: 'Rows',
	type: 'repeat',
	validations: {},
	helpText: '',
	fields: { name_s: { id: 'name_s', name: 'Name', type: 'input', validations: {} } }
} as unknown as ContentTypeField;

const titles = (host: HTMLElement) =>
	Array.from(host.querySelectorAll('.MuiListItemButton-root')).map((row) => row.querySelector('p, span')?.textContent);
const rowFor = (host: HTMLElement, title: string) =>
	Array.from(host.querySelectorAll('.MuiListItemButton-root')).find(
		(row) => row.querySelector('.MuiListItemText-primary')?.textContent === title
	) as HTMLElement;
const deleteButton = (row: HTMLElement) =>
	row.querySelector('[data-testid="DeleteOutlinedIcon"]').closest('button') as HTMLButtonElement;

interface Mounted {
	host: HTMLElement;
	jotai: ReturnType<typeof createStore>;
	pushed: Array<{ onSave(result: { values: Item }): Promise<unknown> }>;
	setValueCalls: Item[][];
	/** What the parent form holds. The Repeat gets it as `value`. */
	setStored(next: Item[], options?: { render?: boolean }): Promise<void>;
	unmount(): Promise<void>;
}

const mountedRoots: Mounted[] = [];
// A failed assertion skips the test's own unmount. The open root would keep the process alive.
afterEach(async () => {
	for (const mounted of mountedRoots.splice(0)) await mounted.unmount();
});

/** Mounts Repeat the way the form does: `value` comes from the field atom, and `setValue` writes to it. */
async function mount(initial: Item[]): Promise<Mounted> {
	const jotai = createStore();
	const valueAtom = atom<unknown>(initial);
	const pushed: Mounted['pushed'] = [];
	const setValueCalls: Item[][] = [];
	let rerender: (value: Item[]) => void = () => undefined;
	const stable = {
		atoms: {
			valueByFieldId: { rows_o: valueAtom },
			validationByFieldId: { rows_o: atom({ isValid: true }) },
			...createFormVisibilityAtoms()
		},
		changedFieldIds: new Set<string>(),
		fieldUpdates$: null,
		itemMeta: { sourceMap: null },
		originalValues: {},
		props: null,
		state: null,
		affectedPluginControlFields: [],
		formControllerState: null
	};
	const globalApi = { pushForm: (props: Mounted['pushed'][number]) => pushed.push(props) };
	function Host() {
		const [value, setRendered] = React.useState<Item[]>(initial);
		rerender = setRendered;
		return React.createElement(Repeat, {
			field,
			value,
			readonly: false,
			autoFocus: false,
			contentType: { id: '/component/thing', fields: {} } as unknown as ContentType,
			setValue: (next: Item[]) => {
				setValueCalls.push(next);
				jotai.set(valueAtom, next);
				setRendered(next);
			}
		} as never);
	}
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	await act(async () => {
		root.render(
			React.createElement(
				ReduxProvider,
				{ store: reduxStore },
				React.createElement(
					JotaiProvider,
					{ store: jotai },
					React.createElement(
						RawIntlProvider,
						{ value: intl as never },
						React.createElement(
							StableGlobalContext.Provider,
							{ value: { formsStackData: [], api: globalApi } as never },
							React.createElement(
								StableFormContext.Provider,
								{ value: stable as never },
								React.createElement(
									ItemMetaContext.Provider,
									{ value: { sourceMap: null } as never },
									React.createElement(
										FormsEngineFormContextApi.Provider,
										{ value: { rollbackField() {} } as never },
										React.createElement(Host)
									)
								)
							)
						)
					)
				)
			)
		);
	});
	const mounted: Mounted = {
		host,
		jotai,
		pushed,
		setValueCalls,
		async setStored(next, options = {}) {
			// A store write the Repeat has not rendered yet, like an item form save in flight.
			await act(async () => {
				jotai.set(valueAtom, next);
				if (options.render) rerender(next);
			});
		},
		async unmount() {
			if (!host.isConnected) return;
			await act(async () => root.unmount());
			host.remove();
		}
	};
	mountedRoots.push(mounted);
	return mounted;
}

// `assert.equal` on two DOM nodes prints both fiber trees on failure.
const sameRow = (actual: HTMLElement, expected: HTMLElement, title: string) =>
	assert.ok(actual === expected, `the row of "${title}" is not the row it had before`);

const a = (): Item => ({ name_s: 'a' });
const names = (items: Item[]) => items.map((item) => item.name_s);

describe('Repeat row keys', () => {
	it('keeps each DOM row with its item when an earlier item is deleted', async () => {
		const mounted = await mount([a(), { name_s: 'b' }, { name_s: 'c' }]);
		const { host } = mounted;
		const [rowB, rowC] = [rowFor(host, 'b'), rowFor(host, 'c')];
		const rowA = rowFor(host, 'a');
		await act(async () => deleteButton(rowA).click());
		assert.deepEqual(titles(host), ['b', 'c']);
		sameRow(rowFor(host, 'b'), rowB, 'b');
		sameRow(rowFor(host, 'c'), rowC, 'c');
		assert.equal(rowA.isConnected, false);
		await mounted.unmount();
	});

	it('moves the DOM rows with their items on a reorder', async () => {
		const [ia, ib, ic] = [a(), { name_s: 'b' }, { name_s: 'c' }];
		const mounted = await mount([ia, ib, ic]);
		const { host } = mounted;
		const rows = { a: rowFor(host, 'a'), b: rowFor(host, 'b'), c: rowFor(host, 'c') };
		await mounted.setStored([ic, ia, ib], { render: true });
		assert.deepEqual(titles(host), ['c', 'a', 'b']);
		sameRow(rowFor(host, 'a'), rows.a, 'a');
		sameRow(rowFor(host, 'b'), rows.b, 'b');
		sameRow(rowFor(host, 'c'), rows.c, 'c');
		await mounted.unmount();
	});

	it('keeps the row of an item that was edited, and writes no id into the serialized item', async () => {
		const items = [a(), { name_s: 'b' }, { name_s: 'c' }];
		const mounted = await mount(items);
		const { host } = mounted;
		const rowB = rowFor(host, 'b');
		await act(async () => rowB.click());
		assert.equal(mounted.pushed.length, 1);
		await act(async () => {
			await mounted.pushed[0].onSave({ values: { name_s: 'b2' } });
		});
		assert.deepEqual(titles(host), ['a', 'b2', 'c']);
		sameRow(rowFor(host, 'b2'), rowB, 'b2');
		const saved = mounted.setValueCalls.at(-1);
		assert.deepEqual(
			saved.map((item) => Object.keys(item)),
			[['name_s'], ['name_s'], ['name_s']]
		);
		const xml = valueSerializersLookup.repeat(saved, { field, contentTypesById: {} }) as Record<string, unknown>;
		assert.deepEqual(xml.item, [{ name_s: 'a' }, { name_s: 'b2' }, { name_s: 'c' }]);
		await mounted.unmount();
	});
});

describe('Repeat remove', () => {
	it('removes from the stored array, so an item form save after the render is not lost', async () => {
		const mounted = await mount([a(), { name_s: 'b' }, { name_s: 'c' }]);
		const { host } = mounted;
		// The save lands in the store. The Repeat still renders the three original items.
		const savedB = { name_s: 'b-saved' };
		await mounted.setStored([a(), savedB, { name_s: 'c' }]);
		assert.deepEqual(titles(host), ['a', 'b', 'c']);
		await act(async () => deleteButton(rowFor(host, 'a')).click());
		const next = mounted.setValueCalls.at(-1);
		assert.deepEqual(names(next), ['b-saved', 'c']);
		assert.equal(next[0], savedB);
		await mounted.unmount();
	});
});
