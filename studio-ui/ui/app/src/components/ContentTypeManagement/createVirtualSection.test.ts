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

import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const { createVirtualSection } = await import('./utils.ts');

describe('createVirtualSection ids', () => {
	it('gives new sections unique ids, even when they share a title', () => {
		const sections = Array.from({ length: 50 }, () => createVirtualSection({ title: 'New Section', fields: [] }));
		const ids = sections.map((section) => section.id);
		assert.ok(ids.every((id) => typeof id === 'string' && id.length > 0));
		assert.equal(new Set(ids).size, sections.length);
	});

	it('gives a duplicated section a new id and keeps the rest of its data', () => {
		const original = createVirtualSection({ title: 'Details', fields: ['a', 'b'] });
		const copy = createVirtualSection({ ...original, id: undefined });
		assert.notEqual(copy.id, original.id);
		assert.equal(copy.title, original.title);
		assert.deepEqual(copy.fields, original.fields);
	});

	it('keeps an id that was provided', () => {
		assert.equal(createVirtualSection({ id: 'section-3', title: 'Details', fields: [] }).id, 'section-3');
	});
});
