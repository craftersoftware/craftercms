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
	sourcePath,
	unmountAll,
	unrelatedPath,
	updateItems
} = await import('../lib/formItemTestHarness');
const { default: NodeSelector } = await import('./NodeSelector');

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
		const unlink = host.querySelector<HTMLButtonElement>('button[aria-label="Unlink Alpha"]');
		assert.ok(unlink);
		await act(async () => unlink.click());
		assert.deepEqual(
			items().map((item) => item.value),
			['Beta', 'Gamma']
		);
		assert.equal(document.activeElement, betaRow);
		assert.equal(liveMessage(host), '');
	});

	it('focuses the field body after the last row is removed, because Add cannot take focus', async () => {
		const { host } = await mountSelector([[alpha, 'Alpha']]);
		const add = host.querySelector('[data-testid="AddRoundedIcon"]')?.closest('button') as HTMLButtonElement;
		assert.equal(add.disabled, true);
		const unlink = host.querySelector<HTMLButtonElement>('button[aria-label="Unlink Alpha"]');
		await act(async () => unlink.click());
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

	it('agrees with the row click: a component row opens read-only, E edits and V views', async () => {
		const { host } = await mountMixed();
		await act(async () => rowLabelled(host, 'Alpha').click());
		await act(async () => press(rowLabelled(host, 'Alpha'), 'e'));
		await act(async () => press(rowLabelled(host, 'Alpha'), 'v'));
		assert.deepEqual(
			pushFormCalls.map((call) => call.readonly),
			[true, false, true]
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
