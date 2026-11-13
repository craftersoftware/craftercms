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

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { JSDOM } from 'jsdom';

const { window } = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.document = window.document;

const { scheduleDeletedItemRemoval } = await import('./deletedItem.ts');

describe('scheduleDeletedItemRemoval', () => {
	let list: HTMLElement;
	let item: HTMLElement;
	let log: string[];
	let schedule: () => void;

	beforeEach(() => {
		mock.timers.enable({ apis: ['setTimeout'] });
		document.body.innerHTML = `
			<ul>
				<li id="item" data-craftercms-model-id="m">
					<span id="child-a" data-craftercms-model-id="m-a"></span>
					<span id="child-b" data-craftercms-model-id="m-b"></span>
				</li>
				<li id="next" data-craftercms-model-id="m"></li>
			</ul>`;
		list = document.querySelector('ul');
		item = document.getElementById('item');
		log = [];
		schedule = () =>
			scheduleDeletedItemRemoval({
				record: { id: 1, element: item },
				deregister: (id) => log.push(`deregister ${id}`),
				idOf: (el) => ({ 'child-a': 2, 'child-b': 3 })[el.id],
				reindex: (parent) => log.push(`reindex ${parent.id || parent.tagName} (${parent.children.length} left)`)
			});
	});
	afterEach(() => mock.timers.reset());

	it('does not deregister, remove or re-index anything before the timer runs', () => {
		schedule();
		assert.deepEqual(log, []);
		assert.equal(item.isConnected, true);
	});

	it('deregisters the item and its registered children, then re-indexes, all in one task', () => {
		schedule();
		mock.timers.tick(0);
		assert.deepEqual(log, ['deregister 1', 'deregister 2', 'deregister 3', 'reindex UL (1 left)']);
		assert.equal(item.isConnected, false);
		assert.equal(list.children.length, 1);
	});
});
