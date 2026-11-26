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
 * NodeSelector shows the items it includes and only those: an update to any other item must not re-render it, an update
 * to an included item must. Its own form item is read when an action runs, so a lock change on the form's item doesn't
 * re-render it either.
 */

import '../../../../test/stringListDomSetup.mjs';
import '../../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

// MUI's dialog focus trap checks `instanceof ShadowRoot`, which the shared DOM setup does not expose.
Object.defineProperty(globalThis, 'ShadowRoot', { value: window.ShadowRoot, configurable: true, writable: true });

const {
	React,
	act,
	FormHost,
	baseItems,
	createEntry,
	createItemsStore,
	fieldFor,
	formPath,
	mountTree,
	profiled,
	pushFormCalls,
	siteId,
	sourcePath,
	unmountAll,
	unrelatedPath,
	updateItems
} = await import('../lib/formItemTestHarness');
const { default: NodeSelector } = await import('./NodeSelector');
const { Provider: JotaiProvider, createStore: createJotaiStore, atom, useAtom } = await import('jotai');
const { configureStore } = await import('@reduxjs/toolkit');
const { StableGlobalContext, useStableGlobalContext } = await import('../lib/formsEngineContext');
const { nodeSelectorFocusRequestAtom } = await import('../lib/nodeSelectorFocusRequest');

afterEach(unmountAll);

const included = {
	...baseItems()[sourcePath],
	systemType: 'component',
	mimeType: 'application/xml',
	stateMap: {},
	availableActionsMap: { edit: true }
};

describe('NodeSelector subscriptions', () => {
	it('re-renders for the items it includes and not for other items or the form’s own item', async () => {
		const store = createItemsStore({ ...baseItems(), [sourcePath]: included });
		const entry = createEntry(['nodes_o']);
		const counts: Record<string, number> = {};
		const host = await mountTree(
			store,
			React.createElement(
				FormHost,
				{ entry },
				profiled(
					counts,
					'selector',
					React.createElement(NodeSelector as never, {
						field: fieldFor('nodes_o', 'node-selector'),
						value: [{ key: sourcePath, value: 'Source', include: sourcePath }],
						setValue: () => undefined,
						readonly: false,
						autoFocus: false,
						inputId: 'x',
						labelId: 'y',
						contentType: { id: '/component/thing', fields: {} }
					})
				)
			)
		);
		assert.match(host.textContent, /Source/);
		const before = counts.selector;

		await updateItems(store, (items) => ({ ...items, [unrelatedPath]: { ...items[unrelatedPath], label: 'Changed' } }));
		await updateItems(store, (items) => ({
			...items,
			[formPath]: { ...items[formPath], lockOwner: { username: 'max' } }
		}));
		assert.equal(counts.selector, before);

		await updateItems(store, (items) => ({ ...items, [sourcePath]: { ...items[sourcePath], label: 'Renamed' } }));
		assert.equal(counts.selector, before + 1);
		assert.match(host.textContent, /Renamed/);
	});
});

const alpha = '/site/components/alpha.xml';
const beta = '/site/components/beta.xml';
const gamma = '/site/components/gamma.xml';

const selectorItem = (path: string, label: string) => ({
	...baseItems()[sourcePath],
	path,
	label,
	systemType: 'component',
	mimeType: 'application/xml',
	stateMap: {},
	availableActionsMap: { edit: true }
});

const node = (path: string, label: string) => ({ key: path, value: label, include: path });

const press = (element: HTMLElement, key: string, init: KeyboardEventInit = {}) => {
	element.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
};

const rowsOf = (host: HTMLElement) => Array.from(host.querySelectorAll<HTMLElement>('.MuiListItemButton-root'));
const rowLabelled = (host: HTMLElement, label: string) => rowsOf(host).find((row) => row.textContent?.includes(label));
const liveMessage = (host: HTMLElement) => host.querySelector('[aria-live="polite"]')?.textContent ?? '';

describe('NodeSelector keyboard reorder', () => {
	async function mountSelector(labels: Array<[string, string]>) {
		const stored = Object.fromEntries(labels.map(([path, label]) => [path, selectorItem(path, label)]));
		const store = createItemsStore({ ...baseItems(), ...stored });
		const entry = createEntry(['nodes_o']);
		let current: Array<ReturnType<typeof node>> = labels.map(([path, label]) => node(path, label));
		function Selector() {
			const [value, setValue] = React.useState(current);
			current = value;
			return React.createElement(NodeSelector as never, {
				field: fieldFor('nodes_o', 'node-selector'),
				value,
				setValue,
				readonly: false,
				autoFocus: false,
				contentType: { id: '/component/thing', fields: {} }
			});
		}
		const host = await mountTree(store, React.createElement(FormHost, { entry }, React.createElement(Selector)));
		return { host, items: () => current };
	}

	it('moves a row with ArrowDown and Shift+Arrow, announces the new position, and focuses the moved row', async () => {
		const { host, items } = await mountSelector([
			[alpha, 'Alpha'],
			[beta, 'Beta'],
			[gamma, 'Gamma']
		]);
		assert.equal(rowsOf(host).length, 3);
		await act(async () => press(rowLabelled(host, 'Alpha'), 'ArrowDown'));
		assert.deepEqual(
			items().map((item) => item.value),
			['Beta', 'Alpha', 'Gamma']
		);
		assert.equal(liveMessage(host), 'Moved Alpha to position 2 of 3');
		assert.equal(document.activeElement, rowLabelled(host, 'Alpha'));
		assert.equal(document.activeElement?.getAttribute('data-reorder-control'), 'row');

		await act(async () => press(rowLabelled(host, 'Alpha'), 'ArrowDown', { shiftKey: true }));
		assert.deepEqual(
			items().map((item) => item.value),
			['Beta', 'Gamma', 'Alpha']
		);
		assert.equal(liveMessage(host), 'Moved Alpha to position 3 of 3');
		assert.equal(document.activeElement, rowLabelled(host, 'Alpha'));
	});

	async function unlinkViaMenu(host: HTMLElement, itemLabel: string) {
		const options = host.querySelector<HTMLButtonElement>(`button[aria-label="Options for ${itemLabel}"]`);
		assert.ok(options, `expected Options for ${itemLabel}`);
		await act(async () => options.click());
		const unlink = Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(
			(item) => item.textContent === 'Unlink'
		);
		assert.ok(unlink, 'expected Unlink in the item menu');
		await act(async () => unlink.click());
	}

	it('ignores a modifier arrow and focuses the next row after a remove', async () => {
		const { host, items } = await mountSelector([
			[alpha, 'Alpha'],
			[beta, 'Beta'],
			[gamma, 'Gamma']
		]);
		const betaRow = rowLabelled(host, 'Beta');
		await act(async () => press(rowLabelled(host, 'Alpha'), 'ArrowDown', { ctrlKey: true }));
		await act(async () => press(rowLabelled(host, 'Alpha'), 'ArrowUp', { altKey: true }));
		assert.deepEqual(
			items().map((item) => item.value),
			['Alpha', 'Beta', 'Gamma']
		);
		assert.equal(liveMessage(host), '');
		await unlinkViaMenu(host, 'Alpha');
		assert.deepEqual(
			items().map((item) => item.value),
			['Beta', 'Gamma']
		);
		assert.equal(document.activeElement, betaRow);
		assert.equal(liveMessage(host), '');
	});

	it('focuses the previous row when the last row is removed through the menu', async () => {
		const { host, items } = await mountSelector([
			[alpha, 'Alpha'],
			[beta, 'Beta'],
			[gamma, 'Gamma']
		]);
		const betaRow = rowLabelled(host, 'Beta');
		await unlinkViaMenu(host, 'Gamma');
		assert.deepEqual(
			items().map((item) => item.value),
			['Alpha', 'Beta']
		);
		assert.equal(document.activeElement, betaRow);
	});

	it('focuses the field body after the last row is removed, because Add cannot take focus', async () => {
		const { host } = await mountSelector([[alpha, 'Alpha']]);
		const add = host.querySelector('[data-testid="AddRoundedIcon"]')?.closest('button') as HTMLButtonElement;
		assert.equal(add.disabled, true);
		await unlinkViaMenu(host, 'Alpha');
		assert.equal(rowsOf(host).length, 0);
		assert.notEqual(document.activeElement, add);
		assert.equal(document.activeElement?.getAttribute('tabindex'), '-1');
		assert.match(document.activeElement?.textContent ?? '', /No options are available for this control/);
	});
});

describe('NodeSelector E and V shortcuts', () => {
	const lockedByOther = { username: 'max' };

	async function mountMixed() {
		const stored = {
			[alpha]: selectorItem(alpha, 'Alpha'),
			// A shared component that someone else has locked, so this user cannot edit it.
			[beta]: { ...selectorItem(beta, 'Beta'), lockOwner: lockedByOther }
		};
		const store = createItemsStore({ ...baseItems(), ...stored });
		const dispatched: Array<{ type?: string; payload?: { component?: string } }> = [];
		const dispatch = store.dispatch;
		store.dispatch = ((action: never) => {
			dispatched.push(action);
			return dispatch(action);
		}) as never;
		const entry = createEntry(['nodes_o']);
		const host = await mountTree(
			store,
			React.createElement(
				FormHost,
				{ entry },
				React.createElement(NodeSelector as never, {
					field: fieldFor('nodes_o', 'node-selector'),
					value: [node(alpha, 'Alpha'), node(beta, 'Beta')],
					setValue: () => undefined,
					readonly: false,
					autoFocus: false,
					contentType: { id: '/component/thing', fields: {} }
				})
			)
		);
		const formDialogs = () =>
			dispatched.filter((action) => String(action?.payload?.component ?? '').includes('FormsEngineDialog'));
		return { host, formDialogs };
	}

	it('opens an item that cannot be edited read-only, for both E and V', async () => {
		const { host, formDialogs } = await mountMixed();
		await act(async () => press(rowLabelled(host, 'Beta'), 'e'));
		assert.equal(formDialogs().length, 1, 'E opens the read-only view, not a writable form');
		await act(async () => press(rowLabelled(host, 'Beta'), 'v'));
		assert.equal(formDialogs().length, 2);
	});

	it('agrees with the row click: a component row edits when allowed, E edits and V views', async () => {
		const { host } = await mountMixed();
		await act(async () => rowLabelled(host, 'Alpha').click());
		await act(async () => press(rowLabelled(host, 'Alpha'), 'e'));
		await act(async () => press(rowLabelled(host, 'Alpha'), 'v'));
		assert.deepEqual(
			pushFormCalls.map((call) => call.readonly),
			[false, false, true]
		);
	});

	it('edits an item the user can edit on E and views it on V, through the forms API', async () => {
		const { host, formDialogs } = await mountMixed();
		await act(async () => press(rowLabelled(host, 'Alpha'), 'e'));
		await act(async () => press(rowLabelled(host, 'Alpha'), 'v'));
		assert.deepEqual(
			pushFormCalls.map((call) => call.readonly),
			[false, true]
		);
		assert.equal(formDialogs().length, 0, 'an editable item does not take the view dialog path');
	});
});

describe('NodeSelector Move to field entry', () => {
	it('offers Move to field… from the per-item More menu (keyboard-reachable menu item)', async () => {
		const store = createItemsStore({
			...baseItems(),
			[sourcePath]: {
				...included,
				availableActionsMap: { edit: true }
			}
		});
		const entry = createEntry(['nodes_o']);
		const host = await mountTree(
			store,
			React.createElement(
				FormHost,
				{ entry },
				React.createElement(NodeSelector as never, {
					field: fieldFor('nodes_o', 'node-selector'),
					value: [{ key: sourcePath, value: 'Source', include: sourcePath }],
					setValue: () => undefined,
					readonly: false,
					autoFocus: false,
					contentType: { id: '/component/thing', fields: {} }
				})
			)
		);
		const more = host.querySelector<HTMLButtonElement>('button[aria-label="Options for Source"]');
		assert.ok(more);
		assert.equal(more.getAttribute('aria-haspopup'), 'menu');
		await act(async () => {
			more.click();
		});
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 50));
		});
		const menuTexts = Array.from(document.body.querySelectorAll('[role="menuitem"]')).map((item) => item.textContent);
		assert.ok(
			menuTexts.some((text) => (text ?? '').includes('Move to field')),
			`Item More menu lists Move to field…; got: ${JSON.stringify(menuTexts)}`
		);
	});
});

describe('NodeSelector reorder dialog', () => {
	beforeEach(() => {
		(window as unknown as Record<string, unknown>).ontouchstart = null;
	});
	afterEach(() => {
		delete (window as unknown as Record<string, unknown>).ontouchstart;
	});

	it('names rows the way the field does: the stored label first, never an empty or outdated name', async () => {
		const store = createItemsStore({
			...baseItems(),
			[alpha]: selectorItem(alpha, 'Alpha'),
			[beta]: selectorItem(beta, 'Renamed beta'),
			[gamma]: selectorItem(gamma, '')
		});
		const entry = createEntry(['nodes_o']);
		const host = await mountTree(
			store,
			React.createElement(
				FormHost,
				{ entry },
				React.createElement(NodeSelector as never, {
					field: fieldFor('nodes_o', 'node-selector'),
					value: [
						{ key: alpha, value: '', include: alpha },
						{ key: beta, value: 'Old beta', include: beta },
						{ key: gamma, value: '', include: gamma }
					],
					setValue: () => undefined,
					readonly: false,
					autoFocus: false,
					contentType: { id: '/component/thing', fields: {} }
				})
			)
		);
		await act(async () => {
			host.querySelector<HTMLElement>('[data-testid="MoreVertRoundedIcon"]').closest('button').click();
		});
		const entryItem = Array.from(document.body.querySelectorAll('li')).find((li) => li.textContent === 'Reorder Items');
		await act(async () => entryItem.click());
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 50));
		});
		const dialog = document.body.querySelector('.MuiDialog-root');
		assert.deepEqual(
			Array.from(dialog.querySelectorAll('li')).map((li) => li.textContent),
			['Alpha', 'Renamed beta', gamma]
		);
		assert.ok(dialog.querySelector('button[aria-label="Move up: Renamed beta"]'));
		assert.ok(dialog.querySelector(`button[aria-label="Move down: Alpha"]`));
		assert.ok(dialog.querySelector(`button[aria-label="Move up: ${gamma}"]`));
	});
});

describe('NodeSelector saved component label', () => {
	it('stores a blank label when the saved component has no internal-name', async () => {
		const store = createItemsStore({
			...baseItems(),
			[formPath]: { ...baseItems()[formPath], stateMap: {} }
		});
		const entry = createEntry(['nodes_o']);
		let next: Array<{ value?: string }> | undefined;
		const host = await mountTree(
			store,
			React.createElement(
				FormHost,
				{ entry },
				React.createElement(NodeSelector as never, {
					field: fieldFor('nodes_o', 'node-selector'),
					value: [{ key: 'hero', value: 'Hero', component: { objectId: 'hero', 'file-name': 'hero.xml' } }],
					setValue: (value: Array<{ value?: string }>) => {
						next = value;
					},
					readonly: false,
					autoFocus: false,
					contentType: { id: '/component/thing', fields: {} }
				})
			)
		);
		const row = rowLabelled(host, 'Hero');
		assert.ok(row);
		await act(async () => {
			row.click();
		});
		const opened = pushFormCalls.at(-1) as {
			onSave?: (result: { values: Record<string, unknown> }) => Promise<unknown>;
		};
		assert.ok(opened?.onSave);
		await opened.onSave({ values: { objectId: 'hero', 'file-name': 'hero.xml' } });
		assert.equal(next?.[0].value, '');
		await opened.onSave({ values: { objectId: 'hero', 'file-name': 'hero.xml', 'internal-name': 'Hero title' } });
		assert.equal(next?.[0].value, 'Hero title');
	});

	it('preserves items moved into this field while an embedded child form is open, even when shifted', async () => {
		const store = createItemsStore({
			...baseItems(),
			[formPath]: { ...baseItems()[formPath], stateMap: {} }
		});
		const jotaiStore = createJotaiStore();
		const entry = createEntry(['nodes_o']);
		const child = { key: 'child-1', value: 'Child', component: { objectId: 'child-1', 'file-name': 'child-1.xml' } };
		const moved = { key: 'feat-1', value: 'Feature', component: { objectId: 'feat-1', 'file-name': 'feat-1.xml' } };
		jotaiStore.set(entry.atoms.valueByFieldId.nodes_o as never, [child] as never);
		let next: Array<{ key: string; value?: string }> | undefined;
		const host = await mountTree(
			store,
			React.createElement(
				JotaiProvider,
				{ store: jotaiStore },
				React.createElement(
					FormHost,
					{ entry },
					React.createElement(NodeSelector as never, {
						field: fieldFor('nodes_o', 'node-selector'),
						value: [child],
						setValue: (value: Array<{ key: string; value?: string }>) => {
							next = value;
						},
						readonly: false,
						autoFocus: false,
						contentType: { id: '/component/thing', fields: {} }
					})
				)
			)
		);
		await act(async () => {
			rowLabelled(host, 'Child').click();
		});
		// Simulate moving `moved` to index 0 of this same field while `child` is open, shifting `child` to index 1.
		jotaiStore.set(entry.atoms.valueByFieldId.nodes_o as never, [moved, child] as never);

		const opened = pushFormCalls.at(-1) as {
			onSave?: (result: { values: Record<string, unknown> }) => Promise<unknown>;
		};
		assert.ok(opened?.onSave);
		await opened.onSave({
			values: { objectId: 'child-1', 'file-name': 'child-1.xml', 'internal-name': 'Child Updated' }
		});
		assert.deepEqual(
			next?.map((item) => ({ key: item.key, value: item.value })),
			[
				{ key: 'feat-1', value: 'Feature' },
				{ key: 'child-1', value: 'Child Updated' }
			]
		);
	});
});

describe('NodeSelector focus request', () => {
	async function mountWithRequest() {
		const store = createItemsStore({
			...baseItems(),
			[alpha]: selectorItem(alpha, 'Alpha'),
			[beta]: selectorItem(beta, 'Beta')
		});
		const jotaiStore = createJotaiStore();
		const entry = createEntry(['nodes_o']);
		let setItems: (items: Array<ReturnType<typeof node>>) => void = () => undefined;
		function Selector() {
			const [value, setValue] = React.useState([node(alpha, 'Alpha')]);
			setItems = setValue;
			return React.createElement(NodeSelector as never, {
				field: fieldFor('nodes_o', 'node-selector'),
				value,
				setValue,
				readonly: false,
				autoFocus: false,
				contentType: { id: '/component/thing', fields: {} }
			});
		}
		const host = await mountTree(
			store,
			React.createElement(
				JotaiProvider,
				{ store: jotaiStore },
				React.createElement(FormHost, { entry }, React.createElement(Selector))
			)
		);
		const addBeta = () => act(async () => setItems([node(alpha, 'Alpha'), node(beta, 'Beta')]));
		return { host, jotaiStore, addBeta, modelId: entry.itemMeta.id };
	}

	it('focuses the requested row once the moved item shows up in this field, then clears the request', async () => {
		const { host, jotaiStore, addBeta, modelId } = await mountWithRequest();
		jotaiStore.set(nodeSelectorFocusRequestAtom, { modelId, fieldId: 'nodes_o', index: 1, key: beta, at: Date.now() });
		await addBeta();
		// Focus is applied on a timer after the commit, so let it run.
		await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
		assert.equal(document.activeElement, rowLabelled(host, 'Beta'));
		assert.equal(jotaiStore.get(nodeSelectorFocusRequestAtom), null);
	});

	it('leaves a request for another field untouched', async () => {
		const { host, jotaiStore, addBeta, modelId } = await mountWithRequest();
		const request = { modelId, fieldId: 'other_o', index: 1, key: beta, at: Date.now() };
		jotaiStore.set(nodeSelectorFocusRequestAtom, request);
		await addBeta();
		assert.notEqual(document.activeElement, rowLabelled(host, 'Beta'));
		assert.deepEqual(jotaiStore.get(nodeSelectorFocusRequestAtom), request);
	});
});

describe('NodeSelector focus after Move to field when the destination is not on screen', () => {
	const heroType = '/component/hero';
	const nsField = (id: string, name: string) => ({
		id,
		name,
		type: 'node-selector',
		sortable: false,
		validations: {
			allowedContentTypes: {
				id: 'allowedContentTypes',
				level: 'required',
				value: { [heroType]: { embedded: true, shared: true } }
			}
		}
	});
	const pageType = { id: '/page/home', name: 'Home', type: 'page', fields: { nodes_o: nsField('nodes_o', 'Nodes') } };
	const heroContentType = {
		id: heroType,
		name: 'Hero',
		type: 'component',
		fields: { children_o: nsField('children_o', 'Children') }
	};
	const hero = (key: string, label: string, children: unknown[] = []) => ({
		key,
		value: label,
		component: { 'content-type': heroType, objectId: key, 'internal-name': label, children_o: children }
	});

	/** A form on the stack: its model, its content type, and the one node-selector field it holds. */
	function formEntry(id: string, contentType: unknown, fieldId: string, items: unknown[], props: unknown = null) {
		const entry = createEntry([fieldId]);
		entry.atoms.valueByFieldId[fieldId] = atom(items) as never;
		entry.itemMeta = { ...entry.itemMeta, id, contentType } as never;
		entry.props = props as never;
		return entry;
	}

	/** Same shape as the harness store, with the content types Move to field needs to list destinations. */
	function createStoreWithTypes() {
		const items = baseItems();
		return configureStore({
			reducer: {
				sites: (state = { active: siteId }) => state,
				uiConfig: (state = { locale: { localeCode: 'en-US' } }) => state,
				env: (state = { authoringBase: '/studio' }) => state,
				user: (state = { username: 'ann' }) => state,
				content: (
					state: { itemsByPath: typeof items; itemsBeingFetchedByPath: Record<string, boolean> } = {
						itemsByPath: items,
						itemsBeingFetchedByPath: {}
					}
				) => state,
				contentTypes: (state = { byId: { [pageType.id]: pageType, [heroType]: heroContentType }, isFetching: false }) =>
					state
			},
			middleware: (getDefault) => getDefault({ serializableCheck: false, immutableCheck: false })
		});
	}

	/** Overrides FormHost's empty stack with the stack this move needs. */
	function WithFormsStack(props: { stack: Array<ReturnType<typeof createEntry>>; children: React.ReactNode }) {
		const global = useStableGlobalContext();
		const value = React.useMemo(() => ({ ...global, formsStackData: props.stack }), [global, props.stack]);
		return React.createElement(StableGlobalContext.Provider, { value: value as never }, props.children);
	}

	/** Mounts the selector of `entry`'s `fieldId`, bound to that field's atom the way the form binds it. */
	async function mountField(entry: ReturnType<typeof createEntry>, stack: Array<typeof entry>, fieldId: string) {
		const store = createStoreWithTypes();
		const jotaiStore = createJotaiStore();
		const valueAtom = entry.atoms.valueByFieldId[fieldId];
		function Selector() {
			const [value, setValue] = useAtom(valueAtom as never) as [never[], (next: never) => void];
			return React.createElement(NodeSelector as never, {
				field: fieldFor(fieldId, 'node-selector'),
				value,
				setValue,
				readonly: false,
				autoFocus: false,
				contentType: { id: '/component/thing', fields: {} }
			});
		}
		const host = await mountTree(
			store as never,
			React.createElement(
				JotaiProvider,
				{ store: jotaiStore },
				React.createElement(
					FormHost,
					{ entry },
					React.createElement(WithFormsStack, { stack }, React.createElement(Selector))
				)
			)
		);
		return { host, jotaiStore };
	}

	/** Item menu, Move to field…, pick `destination` (the first enabled one by default), Move, then let the dialog close. */
	async function moveViaDialog(host: HTMLElement, itemLabel: string, destination?: string) {
		const options = host.querySelector<HTMLButtonElement>(`button[aria-label="Options for ${itemLabel}"]`);
		assert.ok(options, `expected Options for ${itemLabel}`);
		await act(async () => options.click());
		const menuItem = Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')).find((item) =>
			item.textContent?.includes('Move to field')
		);
		assert.ok(menuItem, 'expected Move to field… in the item menu');
		await act(async () => menuItem.click());
		const dialog = document.body.querySelector('[role="dialog"]');
		assert.ok(dialog, 'expected the Move to field dialog');
		if (destination) {
			const choice = Array.from(dialog.querySelectorAll<HTMLElement>('.MuiListItemButton-root')).find(
				(button) => button.textContent === destination
			);
			assert.ok(choice, `expected the destination ${destination}`);
			await act(async () => choice.click());
		}
		const move = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button')).find(
			(button) => button.textContent === 'Move'
		);
		assert.ok(move);
		await act(async () => move.click());
		// The dialog's exit transition and the focus timer both have to run before focus can settle.
		await act(async () => new Promise((resolve) => setTimeout(resolve, 600)));
	}

	const keysOf = (
		jotaiStore: ReturnType<typeof createJotaiStore>,
		entry: ReturnType<typeof createEntry>,
		field: string
	) => (jotaiStore.get(entry.atoms.valueByFieldId[field] as never) as Array<{ key: string }>).map((item) => item.key);

	it('focuses the item that now holds the moved item when the destination is one of its fields', async () => {
		const page = formEntry('page-1', pageType, 'nodes_o', [hero('hero-1', 'Hero One'), hero('hero-2', 'Hero Two')]);
		const { host, jotaiStore } = await mountField(page, [page], 'nodes_o');

		await moveViaDialog(host, 'Hero Two');

		assert.deepEqual(keysOf(jotaiStore, page, 'nodes_o'), ['hero-1']);
		assert.equal(rowLabelled(host, 'Hero Two'), undefined);
		assert.equal(document.activeElement, rowLabelled(host, 'Hero One'));
	});

	it('focuses the row that took the moved item’s place when the destination is in the parent form', async () => {
		const [a, b, c] = [hero('hero-a', 'Hero A'), hero('hero-b', 'Hero B'), hero('hero-c', 'Hero C')];
		const page = formEntry('page-1', pageType, 'nodes_o', [hero('hero-1', 'Hero One', [a, b, c])]);
		const embedded = formEntry('hero-1', heroContentType, 'children_o', [a, b, c], { update: { modelId: 'hero-1' } });
		const { host, jotaiStore } = await mountField(embedded, [page, embedded], 'children_o');

		await moveViaDialog(host, 'Hero B', 'Nodes');

		assert.deepEqual(keysOf(jotaiStore, embedded, 'children_o'), ['hero-a', 'hero-c']);
		assert.ok(keysOf(jotaiStore, page, 'nodes_o').includes('hero-b'));
		assert.equal(document.activeElement, rowLabelled(host, 'Hero C'));
	});

	it('focuses the field body when the move empties the field', async () => {
		const only = hero('hero-a', 'Hero A');
		const page = formEntry('page-1', pageType, 'nodes_o', [hero('hero-1', 'Hero One', [only])]);
		const embedded = formEntry('hero-1', heroContentType, 'children_o', [only], { update: { modelId: 'hero-1' } });
		const { host } = await mountField(embedded, [page, embedded], 'children_o');

		await moveViaDialog(host, 'Hero A', 'Nodes');

		assert.equal(rowsOf(host).length, 0);
		assert.notEqual(document.activeElement, document.body);
		assert.equal(document.activeElement?.getAttribute('tabindex'), '-1');
		assert.match(document.activeElement?.textContent ?? '', /No options are available for this control/);
	});
});
