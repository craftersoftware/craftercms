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
import { describe, it, mock } from 'node:test';
import '../../../test/registerTsLoader.mjs';

const { reverseTypeFieldValuesObject } = await import('./utils.ts');

describe('reverseTypeFieldValuesObject', () => {
	// Given a stored property the descriptor no longer defines, committing the field drops it without logging anything.
	it('drops a property that is not in the descriptor without logging', () => {
		const descriptor = {
			sections: [{ title: 'Properties', fields: ['known'], id: 'properties' }],
			fields: { known: { id: 'known', type: 'input', name: 'known' } }
		};
		const field = {
			id: 'title_t',
			type: 'input',
			properties: {
				known: { name: 'known', value: 'old', type: 'string' },
				obsolete: { name: 'obsolete', value: 'stale', type: 'string' }
			}
		};
		const values = { known: 'new', obsolete: 'stale' };

		const log = mock.method(console, 'log', () => {});
		try {
			const result = reverseTypeFieldValuesObject(field as never, values, descriptor as never);
			assert.equal(Object.hasOwn(result.properties, 'obsolete'), false);
			assert.equal(result.properties.known.value, 'new');
			assert.equal(log.mock.callCount(), 0);
		} finally {
			log.mock.restore();
		}
	});
});
