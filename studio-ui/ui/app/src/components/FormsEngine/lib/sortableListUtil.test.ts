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
 * Where a move lands, and the keys that keep two rows of the same object distinct.
 * Focus after the last row is removed is covered here too: the Add button when it can take focus,
 * otherwise the field body.
 */

import '../../../../test/stringListDomSetup.mjs';
import '../../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { destinationIndex, useOccurrenceKeys, useRestoreFocusWhenEmpty } = await import('./sortableListUtil.ts');

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
});

describe('destinationIndex', () => {
	const actions = ['up', 'down', 'left', 'right'] as const;

	it('returns null for a single item, and for an empty list', () => {
		for (const action of actions) {
			assert.equal(destinationIndex(action, false, 0, 1), null);
			assert.equal(destinationIndex(action, true, 0, 1), null);
			assert.equal(destinationIndex(action, false, 0, 0), null);
		}
	});

	it('returns null when the move would pass the first or last edge', () => {
		assert.equal(destinationIndex('up', false, 0, 4), null);
		assert.equal(destinationIndex('left', false, 0, 4), null);
		assert.equal(destinationIndex('up', true, 0, 4), null);
		assert.equal(destinationIndex('left', true, 0, 4), null);
		assert.equal(destinationIndex('down', false, 3, 4), null);
		assert.equal(destinationIndex('right', false, 3, 4), null);
		assert.equal(destinationIndex('down', true, 3, 4), null);
		assert.equal(destinationIndex('right', true, 3, 4), null);
	});

	it('steps by one, and Shift jumps to the edge', () => {
		assert.equal(destinationIndex('down', false, 0, 4), 1);
		assert.equal(destinationIndex('right', false, 1, 4), 2);
		assert.equal(destinationIndex('up', false, 2, 4), 1);
		assert.equal(destinationIndex('left', false, 3, 4), 2);
		assert.equal(destinationIndex('down', true, 0, 4), 3);
		assert.equal(destinationIndex('right', true, 1, 4), 3);
		assert.equal(destinationIndex('up', true, 3, 4), 0);
		assert.equal(destinationIndex('left', true, 2, 4), 0);
		// Two items: Shift from the first still lands on the only other index.
		assert.equal(destinationIndex('down', true, 0, 2), 1);
		assert.equal(destinationIndex('up', true, 1, 2), 0);
	});
});

describe('useOccurrenceKeys', () => {
	it('gives a repeated object a second key and keeps both ids when the list is reordered', async () => {
		const a = { name: 'a' };
		const b = { name: 'b' };
		const seen: string[][] = [];
		let update: (items: object[]) => void = () => undefined;
		function Probe() {
			const [items, setItems] = React.useState<object[]>([a, a, b]);
			update = setItems;
			seen.push(useOccurrenceKeys(items));
			return null;
		}
		const host = document.createElement('div');
		document.body.appendChild(host);
		const root = createRoot(host);
		await act(async () => {
			root.render(React.createElement(Probe));
		});
		mounted.push({ unmount: () => root.unmount(), host });

		const [firstA, secondA, keyB] = seen.at(-1);
		assert.match(firstA, /^occ-\d+$/);
		assert.equal(secondA, `${firstA}-1`);
		assert.match(keyB, /^occ-\d+$/);
		assert.notEqual(keyB, firstA);

		await act(async () => update([b, a, a]));
		assert.deepEqual(seen.at(-1), [keyB, firstA, secondA]);

		await act(async () => update([a, b]));
		assert.deepEqual(seen.at(-1), [firstA, keyB]);
	});
});

describe('useRestoreFocusWhenEmpty', () => {
	async function removeLast(disableAdd: boolean) {
		function Probe() {
			const [list, setList] = React.useState([1]);
			const { addButtonRef, fallbackRef, rememberEmpty } = useRestoreFocusWhenEmpty(list);
			return React.createElement(
				React.Fragment,
				null,
				React.createElement('button', { ref: addButtonRef, type: 'button', disabled: disableAdd }, 'Add'),
				React.createElement('div', { ref: fallbackRef, tabIndex: -1, id: 'field-body' }),
				React.createElement(
					'button',
					{
						type: 'button',
						onClick: () => {
							rememberEmpty();
							setList([]);
						}
					},
					'Remove'
				)
			);
		}
		const host = document.createElement('div');
		document.body.appendChild(host);
		const root = createRoot(host);
		await act(async () => {
			root.render(React.createElement(Probe));
		});
		mounted.push({ unmount: () => root.unmount(), host });
		await act(async () => {
			host.querySelectorAll('button')[1].click();
		});
		return host;
	}

	it('focuses the Add button after the last row is removed', async () => {
		const host = await removeLast(false);
		assert.equal(document.activeElement, host.querySelector('button'));
		assert.equal((document.activeElement as HTMLButtonElement).textContent, 'Add');
	});

	it('focuses the field body when the Add button cannot take focus', async () => {
		const host = await removeLast(true);
		assert.equal(document.activeElement, host.querySelector('#field-body'));
		assert.equal(document.activeElement?.getAttribute('tabindex'), '-1');
	});
});
