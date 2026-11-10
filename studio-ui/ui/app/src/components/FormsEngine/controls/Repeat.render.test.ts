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
import { afterEach, beforeEach, describe, it } from 'node:test';
import type { ContentTypeField } from '../../../models/ContentType';
import type ContentType from '../../../models/ContentType';
import type { PrimitiveAtom } from 'jotai';

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { RawIntlProvider, createIntl } = await import('react-intl');
const { Provider: ReduxProvider } = await import('react-redux');
const { configureStore } = await import('@reduxjs/toolkit');
const { atom, createStore, useAtomValue, Provider: JotaiProvider } = await import('jotai');
const { createChangedFieldIdsAtom } = await import('../lib/formUtils.tsx');
const { Repeat } = await import('./Repeat.tsx');
const { FormsEngineFormContextApi, ItemMetaContext, StableFormContext, StableGlobalContext } =
	await import('../lib/formsEngineContext.ts');
const { createFormVisibilityAtoms } = await import('../lib/formVisibility.ts');
const { valueSerializersLookup } = await import('../lib/valueSerializers.ts');
const { carryReplacedItem, repeatItemKeysFor } = await import('../lib/repeatItemKeys.ts');
const { repeatItemFormProps, stackedRepeatItemAfterClose, writeItemToParent } =
	await import('../lib/repeatItemForm.ts');

// MUI's dialog focus trap checks `instanceof ShadowRoot`, which the shared DOM setup does not expose.
Object.defineProperty(globalThis, 'ShadowRoot', { value: window.ShadowRoot, configurable: true, writable: true });

type Item = Record<string, unknown>;

const reduxStore = configureStore({
	reducer: {
		sites: (state = { active: 'editorial' }) => state,
		content: (state = { itemsByPath: {} }) => state,
		contentTypes: (state = { byId: {}, isFetching: false }) => state
	}
});

// The test loader precompiles messages, so format them instead of returning the AST.
const baseIntl = createIntl({ locale: 'en', onError: () => undefined });
const intl = {
	...baseIntl,
	formatMessage: (descriptor: { id?: string; defaultMessage?: unknown }, values?: Record<string, unknown>) =>
		baseIntl.formatMessage(descriptor as never, values as never)
};

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
// The row's actions sit beside the row button, in the same list item.
const deleteButton = (row: HTMLElement) =>
	row.closest('li').querySelector('[data-testid="DeleteOutlinedIcon"]').closest('button') as HTMLButtonElement;

interface Mounted {
	host: HTMLElement;
	jotai: ReturnType<typeof createStore>;
	valueAtom: PrimitiveAtom<unknown>;
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
async function mount(
	initial: Item[],
	options: { live?: boolean; field?: ContentTypeField; repeatItemIndex?: number } = {}
): Promise<Mounted> {
	const jotai = createStore();
	const valueAtom = atom<unknown>(initial);
	const pushed: Mounted['pushed'] = [];
	const setValueCalls: Item[][] = [];
	let rerender: (value: Item[]) => void = () => undefined;
	const stable = {
		atoms: {
			valueByFieldId: { rows_o: valueAtom },
			validationByFieldId: { rows_o: atom({ isValid: true }) },
			...createFormVisibilityAtoms(
				options.repeatItemIndex === undefined
					? undefined
					: {
							active: {
								fieldIds: null,
								repeatItem: { fieldId: (options.field ?? field).id, index: options.repeatItemIndex }
							},
							launch: null
						}
			)
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
	const globalApi = { pushForm: (props: Mounted['pushed'][number]) => pushed.push(props) };
	function Host() {
		const [local, setRendered] = React.useState<Item[]>(initial);
		const stored = useAtomValue(valueAtom) as Item[];
		// Live is how the form renders: the control's value follows the field atom. Otherwise it only changes through
		// setValue, which stands for a render that has not happened yet when the store is written directly.
		const value = options.live ? stored : local;
		rerender = setRendered;
		return React.createElement(Repeat, {
			field: options.field ?? field,
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
		valueAtom,
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

describe('Repeat with one item object stored twice', () => {
	// A form controller can write the same object into the array twice: [a, a, b].
	const rowsOf = (host: HTMLElement) => Array.from(host.querySelectorAll<HTMLElement>('.MuiListItemButton-root'));
	const moveButton = (row: HTMLElement, control: 'up' | 'down') =>
		row.closest('li').querySelector<HTMLButtonElement>(`button[data-reorder-control="${control}"]`);
	async function mountTwice() {
		const ia = a();
		const ib = { name_s: 'b' };
		const mounted = await mount([ia, ia, ib]);
		return { mounted, ia, ib };
	}

	it('renders a row per occurrence, with no duplicate React key', async () => {
		const errors: unknown[] = [];
		const original = console.error;
		console.error = (...args: unknown[]) => errors.push(args);
		try {
			const { mounted } = await mountTwice();
			assert.deepEqual(titles(mounted.host), ['a', 'a', 'b']);
		} finally {
			console.error = original;
		}
		assert.ok(!errors.some((args) => String((args as unknown[])[0]).includes('same key')), 'duplicate key warning');
	});

	it('deletes the second occurrence when its row is used', async () => {
		const { mounted, ia, ib } = await mountTwice();
		await act(async () => deleteButton(rowsOf(mounted.host)[1]).click());
		const next = mounted.setValueCalls.at(-1);
		assert.equal(next.length, 2);
		assert.ok(next[0] === ia && next[1] === ib);
	});

	it('edits the second occurrence, and saves into its slot', async () => {
		const { mounted, ia, ib } = await mountTwice();
		await act(async () => rowsOf(mounted.host)[1].click());
		const props = mounted.pushed[0] as unknown as { repeat: { index: number } };
		assert.equal(props.repeat.index, 1);
		await act(async () => {
			await mounted.pushed[0].onSave({ values: { name_s: 'a2' } });
		});
		const next = mounted.setValueCalls.at(-1);
		assert.deepEqual(names(next), ['a', 'a2', 'b']);
		assert.ok(next[0] === ia && next[2] === ib);
	});

	it('moves each occurrence with the Move buttons and keeps both in the array', async () => {
		const { mounted, ia, ib } = await mountTwice();
		// Second "a" down: [a, b, a].
		await act(async () => moveButton(rowsOf(mounted.host)[1], 'down').click());
		let next = mounted.setValueCalls.at(-1);
		assert.ok(next[0] === ia && next[1] === ib && next[2] === ia);
		// That "a" (now last) up again: [a, a, b].
		await act(async () => moveButton(rowsOf(mounted.host)[2], 'up').click());
		next = mounted.setValueCalls.at(-1);
		assert.ok(next[0] === ia && next[1] === ia && next[2] === ib);
		// First "a" down swaps it with its twin. The array is unchanged in content and still has both.
		await act(async () => moveButton(rowsOf(mounted.host)[0], 'down').click());
		next = mounted.setValueCalls.at(-1);
		assert.ok(next.length === 3 && next[0] === ia && next[1] === ia && next[2] === ib);
		// Second "a" up does the same.
		await act(async () => moveButton(rowsOf(mounted.host)[1], 'up').click());
		next = mounted.setValueCalls.at(-1);
		assert.ok(next.length === 3 && next[0] === ia && next[1] === ia && next[2] === ib);
	});
});

/** What the Experience Builder launch in FormsEngine builds: its own props, writing to the store, with the shared keys. */
const launchProps = (mounted: Mounted, index: number) =>
	repeatItemFormProps<Item>({
		fieldId: 'rows_o',
		index,
		getItems: () => (mounted.jotai.get(mounted.valueAtom) as Item[]) ?? [],
		keys: repeatItemKeysFor<Item>(mounted.valueAtom),
		setItems: (next) => mounted.jotai.set(mounted.valueAtom, next)
	});

describe('Repeat row keys on the other item-replacing paths', () => {
	it('keeps the row of an item saved from the Experience Builder launch', async () => {
		const mounted = await mount([a(), { name_s: 'b' }, { name_s: 'c' }], { live: true });
		const { host } = mounted;
		const rowB = rowFor(host, 'b');
		await act(async () => {
			await launchProps(mounted, 1).onSave({ values: { name_s: 'b2' } });
		});
		assert.deepEqual(titles(host), ['a', 'b2', 'c']);
		sameRow(rowFor(host, 'b2'), rowB, 'b2');
	});

	it('keeps the row on each selected-fields write, which merges into a new object every time', async () => {
		const mounted = await mount([a(), { name_s: 'b' }, { name_s: 'c' }], { live: true });
		const { host } = mounted;
		const rowB = rowFor(host, 'b');
		// FormsEngine writes the open item into the parent on entry and on each edit.
		for (const name of ['b1', 'b2']) {
			await act(async () => {
				const current = mounted.jotai.get(mounted.valueAtom) as Item[];
				const next = writeItemToParent(current, 1, { name_s: name });
				carryReplacedItem(repeatItemKeysFor<Item>(mounted.valueAtom), current, next, 1);
				mounted.jotai.set(mounted.valueAtom, next);
			});
			sameRow(rowFor(host, name), rowB, name);
		}
	});

	it('keeps the row when closing the item form restores the opened values', async () => {
		const mounted = await mount([a(), { name_s: 'b' }, { name_s: 'c' }], { live: true });
		const { host } = mounted;
		const rowB = rowFor(host, 'b');
		await act(async () => {
			const current = mounted.jotai.get(mounted.valueAtom) as Item[];
			const edited = writeItemToParent(current, 1, { name_s: 'b-edited' });
			carryReplacedItem(repeatItemKeysFor<Item>(mounted.valueAtom), current, edited, 1);
			mounted.jotai.set(mounted.valueAtom, edited);
		});
		assert.deepEqual(titles(host), ['a', 'b-edited', 'c']);
		await act(async () => {
			const current = mounted.jotai.get(mounted.valueAtom) as Item[];
			const next = stackedRepeatItemAfterClose({
				wasSelectedItemForm: true,
				items: current,
				index: 1,
				checkpoint: { name_s: 'b' },
				parentCheckpoint: undefined
			});
			carryReplacedItem(repeatItemKeysFor<Item>(mounted.valueAtom), current, next as Item[], 1);
			mounted.jotai.set(mounted.valueAtom, next as Item[]);
		});
		assert.deepEqual(titles(host), ['a', 'b', 'c']);
		sameRow(rowFor(host, 'b'), rowB, 'b');
	});
});

describe('Repeat remove', () => {
	it('removes from the stored array, so an item form save after the render is not lost', async () => {
		const mounted = await mount([a(), { name_s: 'b' }, { name_s: 'c' }]);
		const { host } = mounted;
		// The save lands in the store. The Repeat still renders the three original items.
		await act(async () => {
			await launchProps(mounted, 1).onSave({ values: { name_s: 'b-saved' } });
		});
		assert.deepEqual(titles(host), ['a', 'b', 'c']);
		await act(async () => deleteButton(rowFor(host, 'a')).click());
		const next = mounted.setValueCalls.at(-1);
		assert.deepEqual(names(next), ['b-saved', 'c']);
		await mounted.unmount();
	});

	it('removes the item the row shows when the stored array shifted after the render', async () => {
		const [ia, ib, ic] = [a(), { name_s: 'b' }, { name_s: 'c' }];
		const mounted = await mount([ia, ib, ic]);
		const { host } = mounted;
		// Stored now has one more item in front. The row for "b" was index 1 when it rendered.
		await mounted.setStored([{ name_s: 'new' }, ia, ib, ic]);
		await act(async () => deleteButton(rowFor(host, 'b')).click());
		const next = mounted.setValueCalls.at(-1);
		assert.deepEqual(names(next), ['new', 'a', 'c']);
		assert.ok(next[1] === ia && next[2] === ic);
	});

	it('removes nothing when the item is no longer stored', async () => {
		const [ia, ib] = [a(), { name_s: 'b' }];
		const mounted = await mount([ia, ib]);
		await mounted.setStored([ia]);
		await act(async () => deleteButton(rowFor(mounted.host, 'b')).click());
		assert.equal(mounted.setValueCalls.length, 0);
	});
});

describe('Repeat reorder', () => {
	const touchListMoves = () =>
		Array.from(document.body.querySelectorAll('[data-testid="KeyboardArrowDownRoundedIcon"]')).map(
			(icon) => icon.closest('button') as HTMLButtonElement
		);

	/** Opens the reorder dialog with the touch list, which has buttons where the drag list has drag handles. */
	async function openReorder(mounted: Mounted) {
		await act(async () => {
			mounted.host.querySelector<HTMLElement>('[data-testid="MoreVertRoundedIcon"]').closest('button').click();
		});
		const entry = Array.from(document.body.querySelectorAll('li')).find((li) => li.textContent === 'Reorder Items');
		await act(async () => entry.click());
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 50));
		});
	}

	// The control decides on a touch list when it mounts.
	beforeEach(() => {
		(window as unknown as Record<string, unknown>).ontouchstart = null;
	});
	afterEach(() => {
		delete (window as unknown as Record<string, unknown>).ontouchstart;
	});

	it('reorders the latest stored array, not the one the list was built from', async () => {
		const [ia, ib, ic] = [a(), { name_s: 'b' }, { name_s: 'c' }];
		const mounted = await mount([ia, ib, ic]);
		await openReorder(mounted);
		assert.equal(touchListMoves().length, 3);
		// A save lands after the list was built: "b" is replaced by an edited object that carried its key.
		const editedB = { name_s: 'b-saved' };
		repeatItemKeysFor<Item>(mounted.valueAtom).carry(ib, editedB);
		await mounted.setStored([ia, editedB, ic]);
		await act(async () => touchListMoves()[0].click());
		const next = mounted.setValueCalls.at(-1);
		assert.deepEqual(names(next), ['b-saved', 'a', 'c']);
		assert.equal(next[0], editedB);
	});

	it('keeps the touch list row with its item through a move', async () => {
		const [ia, ib, ic] = [a(), { name_s: 'b' }, { name_s: 'c' }];
		const mounted = await mount([ia, ib, ic]);
		await openReorder(mounted);
		const listRow = (title: string) =>
			Array.from(document.body.querySelectorAll('.MuiDialog-root li')).find(
				(li) => li.textContent === title
			) as HTMLElement;
		const rows = { a: listRow('a'), b: listRow('b'), c: listRow('c') };
		await act(async () => touchListMoves()[0].click());
		const order = Array.from(document.body.querySelectorAll('.MuiDialog-root li')).map((li) => li.textContent);
		assert.deepEqual(order, ['b', 'a', 'c']);
		sameRow(listRow('a'), rows.a, 'a');
		sameRow(listRow('b'), rows.b, 'b');
		sameRow(listRow('c'), rows.c, 'c');
	});

	it('moves the item the row shows when the stored array shifted after the list was built', async () => {
		const [ia, ib, ic] = [a(), { name_s: 'b' }, { name_s: 'c' }];
		const mounted = await mount([ia, ib, ic]);
		await openReorder(mounted);
		const added = { name_s: 'added' };
		await mounted.setStored([added, ia, ib, ic]);
		// Move "a" (second row of the list) down one place.
		await act(async () => touchListMoves()[0].click());
		const next = mounted.setValueCalls.at(-1);
		assert.deepEqual(names(next), ['b', 'a', 'c', 'added']);
	});
});

const addButton = (host: HTMLElement) =>
	host.querySelector('[data-testid="AddRoundedIcon"]').closest('button') as HTMLButtonElement;
const withLimits = (limits: { minCount?: number; maxCount?: number }) =>
	({
		...field,
		validations: Object.fromEntries(Object.entries(limits).map(([key, value]) => [key, { value }]))
	}) as unknown as ContentTypeField;

describe('Repeat edit against the stored array', () => {
	it('opens the form at the position the item has in the store, not at its render-time index', async () => {
		const [ia, ib, ic] = [a(), { name_s: 'b' }, { name_s: 'c' }];
		const mounted = await mount([ia, ib, ic]);
		// A save landed in front of it after the render. "b" rendered at index 1 and is stored at index 2.
		await mounted.setStored([{ name_s: 'new' }, ia, ib, ic]);
		await act(async () => rowFor(mounted.host, 'b').click());
		assert.equal(mounted.pushed.length, 1);
		const props = mounted.pushed[0] as unknown as { repeat: { index: number; values: Item } };
		assert.equal(props.repeat.index, 2);
		assert.ok(props.repeat.values === ib);
	});

	it('opens no form for an item that is no longer stored', async () => {
		const [ia, ib] = [a(), { name_s: 'b' }];
		const mounted = await mount([ia, ib]);
		await mounted.setStored([ia]);
		await act(async () => rowFor(mounted.host, 'b').click());
		assert.equal(mounted.pushed.length, 0);
	});

	it('saves into the slot the item has now when the store shifted after the form opened', async () => {
		const [ia, ib, ic] = [a(), { name_s: 'b' }, { name_s: 'c' }];
		const mounted = await mount([ia, ib, ic], { live: true });
		const rowB = rowFor(mounted.host, 'b');
		await act(async () => rowB.click());
		await mounted.setStored([{ name_s: 'new' }, ia, ib, ic]);
		await act(async () => {
			await mounted.pushed[0].onSave({ values: { name_s: 'b2' } });
		});
		const stored = mounted.jotai.get(mounted.valueAtom) as Item[];
		assert.deepEqual(names(stored), ['new', 'a', 'b2', 'c']);
		assert.ok(stored[1] === ia && stored[3] === ic);
		sameRow(rowFor(mounted.host, 'b2'), rowB, 'b2');
	});

	it('finds the open item by its row key after a write replaced the object, then shifted', async () => {
		const [ia, ib] = [a(), { name_s: 'b' }];
		const mounted = await mount([ia, ib], { live: true });
		await act(async () => rowFor(mounted.host, 'b').click());
		// The selected-fields write-through replaces the item with a new object that carries its key.
		const replaced = { name_s: 'b1' };
		repeatItemKeysFor<Item>(mounted.valueAtom).carry(ib, replaced);
		await mounted.setStored([{ name_s: 'new' }, ia, replaced]);
		await act(async () => {
			await mounted.pushed[0].onSave({ values: { name_s: 'b2' } });
		});
		assert.deepEqual(names(mounted.jotai.get(mounted.valueAtom) as Item[]), ['new', 'a', 'b2']);
	});

	it('writes nothing when the item being edited is gone', async () => {
		const [ia, ib, ic] = [a(), { name_s: 'b' }, { name_s: 'c' }];
		const mounted = await mount([ia, ib, ic]);
		await act(async () => rowFor(mounted.host, 'b').click());
		await mounted.setStored([ia, ic]);
		const warn = console.warn;
		const warnings: unknown[][] = [];
		console.warn = (...args: unknown[]) => void warnings.push(args);
		try {
			await act(async () => {
				await mounted.pushed[0].onSave({ values: { name_s: 'b2' } });
			});
		} finally {
			console.warn = warn;
		}
		assert.deepEqual(names(mounted.jotai.get(mounted.valueAtom) as Item[]), ['a', 'c']);
		assert.equal(mounted.setValueCalls.length, 0);
		assert.equal(warnings.length, 1);
	});
});

describe('Repeat limits against the stored array', () => {
	it('does not remove below the minimum when the store is shorter than the render', async () => {
		const [ia, ib, ic] = [a(), { name_s: 'b' }, { name_s: 'c' }];
		const mounted = await mount([ia, ib, ic], { field: withLimits({ minCount: 2 }) });
		// The render shows three items, so delete is enabled. The store already has the minimum.
		await mounted.setStored([ia, ib]);
		await act(async () => deleteButton(rowFor(mounted.host, 'a')).click());
		assert.equal(mounted.setValueCalls.length, 0);
		assert.deepEqual(names(mounted.jotai.get(mounted.valueAtom) as Item[]), ['a', 'b']);
	});

	it('does not open the add form past the maximum when the store is longer than the render', async () => {
		const [ia, ib, ic] = [a(), { name_s: 'b' }, { name_s: 'c' }];
		const mounted = await mount([ia, ib], { field: withLimits({ maxCount: 3 }) });
		await mounted.setStored([ia, ib, ic]);
		await act(async () => addButton(mounted.host).click());
		assert.equal(mounted.pushed.length, 0);
	});

	it('still removes and adds within the limits', async () => {
		const [ia, ib, ic] = [a(), { name_s: 'b' }, { name_s: 'c' }];
		const mounted = await mount([ia, ib, ic], { field: withLimits({ minCount: 2, maxCount: 4 }) });
		await act(async () => addButton(mounted.host).click());
		assert.equal(mounted.pushed.length, 1);
		await act(async () => deleteButton(rowFor(mounted.host, 'a')).click());
		assert.deepEqual(names(mounted.setValueCalls.at(-1)), ['b', 'c']);
	});
});

const press = (element: HTMLElement, key: string, init: KeyboardEventInit = {}) => {
	element.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
};
const liveMessage = (host: HTMLElement) => host.querySelector('[aria-live="polite"]')?.textContent ?? '';
const moveControl = (row: HTMLElement, control: 'up' | 'down') =>
	row.closest('li')!.querySelector<HTMLButtonElement>(`button[data-reorder-control="${control}"]`);

describe('Repeat keyboard reorder', () => {
	const three = () => [a(), { name_s: 'b' }, { name_s: 'c' }] as Item[];

	it('moves a row down and up with the arrow keys, and focuses the moved row', async () => {
		const mounted = await mount(three());
		const { host } = mounted;
		await act(async () => press(rowFor(host, 'a'), 'ArrowDown'));
		assert.deepEqual(titles(host), ['b', 'a', 'c']);
		assert.equal(document.activeElement, rowFor(host, 'a'));
		assert.equal(document.activeElement?.getAttribute('data-reorder-control'), 'row');
		assert.equal(liveMessage(host), 'Moved a to position 2 of 3');
		await act(async () => press(rowFor(host, 'a'), 'ArrowUp'));
		assert.deepEqual(titles(host), ['a', 'b', 'c']);
		assert.equal(document.activeElement, rowFor(host, 'a'));
		assert.equal(liveMessage(host), 'Moved a to position 1 of 3');
	});

	it('moves a row to the edge with Shift+Arrow', async () => {
		const mounted = await mount(three());
		const { host } = mounted;
		await act(async () => press(rowFor(host, 'a'), 'ArrowDown', { shiftKey: true }));
		assert.deepEqual(titles(host), ['b', 'c', 'a']);
		assert.equal(document.activeElement, rowFor(host, 'a'));
		assert.equal(liveMessage(host), 'Moved a to position 3 of 3');
		await act(async () => press(rowFor(host, 'a'), 'ArrowUp', { shiftKey: true }));
		assert.deepEqual(titles(host), ['a', 'b', 'c']);
		assert.equal(document.activeElement, rowFor(host, 'a'));
		assert.equal(liveMessage(host), 'Moved a to position 1 of 3');
	});

	it('does nothing on an arrow that would pass an edge', async () => {
		const mounted = await mount(three());
		const { host } = mounted;
		await act(async () => press(rowFor(host, 'a'), 'ArrowUp'));
		await act(async () => press(rowFor(host, 'a'), 'ArrowUp', { shiftKey: true }));
		await act(async () => press(rowFor(host, 'c'), 'ArrowDown'));
		await act(async () => press(rowFor(host, 'c'), 'ArrowDown', { shiftKey: true }));
		assert.equal(mounted.setValueCalls.length, 0);
		assert.equal(liveMessage(host), '');
		assert.deepEqual(titles(host), ['a', 'b', 'c']);
	});

	it('ignores Ctrl, Cmd and Alt, including Ctrl+E', async () => {
		const mounted = await mount(three());
		const { host } = mounted;
		await act(async () => press(rowFor(host, 'a'), 'ArrowDown', { ctrlKey: true }));
		await act(async () => press(rowFor(host, 'a'), 'ArrowDown', { metaKey: true }));
		await act(async () => press(rowFor(host, 'a'), 'ArrowUp', { altKey: true }));
		await act(async () => press(rowFor(host, 'b'), 'e', { ctrlKey: true }));
		await act(async () => press(rowFor(host, 'b'), 'v', { metaKey: true }));
		assert.equal(mounted.setValueCalls.length, 0);
		assert.equal(mounted.pushed.length, 0);
		assert.equal(liveMessage(host), '');
		assert.deepEqual(titles(host), ['a', 'b', 'c']);
	});

	it('moves the second copy of an item stored twice', async () => {
		const ia = a();
		const ib = { name_s: 'b' };
		const mounted = await mount([ia, ia, ib]);
		const second = mounted.host.querySelectorAll<HTMLElement>('.MuiListItemButton-root')[1];
		await act(async () => press(second, 'ArrowDown'));
		const next = mounted.setValueCalls.at(-1);
		assert.ok(next[0] === ia && next[1] === ib && next[2] === ia);
		assert.equal(liveMessage(mounted.host), 'Moved a to position 3 of 3');
		assert.equal(document.activeElement?.getAttribute('data-reorder-index'), '2');
	});

	it('focuses the Move button of the row a button move lands on', async () => {
		const mounted = await mount(three());
		const { host } = mounted;
		await act(async () => moveControl(rowFor(host, 'a'), 'down').click());
		assert.deepEqual(titles(host), ['b', 'a', 'c']);
		assert.equal(document.activeElement, moveControl(rowFor(host, 'a'), 'down'));
		assert.equal(liveMessage(host), 'Moved a to position 2 of 3');
	});

	it('focuses the next row after a remove, and the previous row when the last one goes', async () => {
		const mounted = await mount(three());
		const { host } = mounted;
		const rowB = rowFor(host, 'b');
		await act(async () => deleteButton(rowFor(host, 'a')).click());
		assert.deepEqual(titles(host), ['b', 'c']);
		assert.equal(document.activeElement, rowB);
		assert.equal(liveMessage(host), '');
		const rowC = rowFor(host, 'c');
		await act(async () => deleteButton(rowC).click());
		assert.deepEqual(titles(host), ['b']);
		assert.equal(document.activeElement, rowB);
	});

	it('focuses the Add button after the last row is removed', async () => {
		const mounted = await mount([a()]);
		const { host } = mounted;
		const add = addButton(host);
		await act(async () => deleteButton(rowFor(host, 'a')).click());
		assert.deepEqual(titles(host), []);
		assert.equal(document.activeElement, add);
		assert.equal(add.disabled, false);
	});

	it('hides Move in the scoped item view, and arrow keys do not reorder', async () => {
		const mounted = await mount(three(), { repeatItemIndex: 1 });
		const { host } = mounted;
		assert.deepEqual(titles(host), ['b']);
		assert.equal(host.querySelector('button[data-reorder-control="up"]'), null);
		assert.equal(host.querySelector('button[data-reorder-control="down"]'), null);
		await act(async () => press(rowFor(host, 'b'), 'ArrowDown'));
		await act(async () => press(rowFor(host, 'b'), 'ArrowUp', { shiftKey: true }));
		assert.equal(mounted.setValueCalls.length, 0);
		assert.equal(liveMessage(host), '');
		assert.deepEqual(names(mounted.jotai.get(mounted.valueAtom) as Item[]), ['a', 'b', 'c']);
	});
});
