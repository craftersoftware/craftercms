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

import '../../test/stringListDomSetup.mjs';
import '../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const { accessibleName } = await import('../../test/accessibleName.ts');

function mount(labelledBy: string, label: string, refs: Array<{ id: string; text: string }>) {
	const nodes = refs.map(({ id, text }) => {
		const element = document.createElement('span');
		element.id = id;
		element.textContent = text;
		document.body.appendChild(element);
		return element;
	});
	const node = document.createElement('div');
	node.setAttribute('aria-labelledby', labelledBy);
	node.setAttribute('aria-label', label);
	document.body.appendChild(node);
	nodes.push(node);
	return { node, remove: () => nodes.forEach((element) => element.remove()) };
}

describe('accessibleName', () => {
	it('falls back to aria-label when no aria-labelledby id resolves', () => {
		const { node, remove } = mount('nope1 nope2', 'Fallback', []);
		try {
			assert.equal(accessibleName(node), 'Fallback');
		} finally {
			remove();
		}
	});

	it('falls back to aria-label when the referenced id has no text', () => {
		const { node, remove } = mount('empty-label', 'Fallback', [{ id: 'empty-label', text: '' }]);
		try {
			assert.equal(accessibleName(node), 'Fallback');
		} finally {
			remove();
		}
	});

	it('uses the valid id when another referenced id is missing', () => {
		const { node, remove } = mount('missing-label real-label', 'Fallback', [
			{ id: 'real-label', text: 'Content Type' }
		]);
		try {
			assert.equal(accessibleName(node), 'Content Type');
		} finally {
			remove();
		}
	});

	it('joins the text of every id that resolves', () => {
		const { node, remove } = mount('first-label second-label', 'Fallback', [
			{ id: 'first-label', text: 'Sort' },
			{ id: 'second-label', text: 'By' }
		]);
		try {
			assert.equal(accessibleName(node), 'Sort By');
		} finally {
			remove();
		}
	});
});
