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
import { describe, it } from 'node:test';
import '../../test/registerTsLoader.mjs';
import type { ContentTypeField } from '../models/ContentType';

const { getDefaultValue } = await import('./contentType.ts');

/**
 * New-item default for a repeat. Prefill uses minCount only.
 * A required constraint does not invent items, and a missing minCount stays empty.
 */

function repeatField(validations: ContentTypeField['validations']): ContentTypeField {
	return {
		id: 'articles_o',
		name: 'Articles',
		type: 'repeat',
		validations,
		fields: {
			title_s: {
				id: 'title_s',
				name: 'Title',
				type: 'input',
				validations: {},
				defaultValue: 'Hello'
			}
		}
	};
}

describe('getDefaultValue repeat prefill', () => {
	// Given minCount 3 and a required constraint, a new repeat starts with 3 items. The required constraint does not change the count.
	it('starts a new repeat at the effective minimum, using minCount.value', () => {
		const prefilled = getDefaultValue(
			repeatField({
				minCount: { id: 'minCount', value: 3, level: 'required' },
				required: { id: 'required', value: true, level: 'required' }
			})
		);
		assert.equal(prefilled.length, 3);
		assert.deepEqual(prefilled, [{ title_s: 'Hello' }, { title_s: 'Hello' }, { title_s: 'Hello' }]);
	});

	// Given no minCount, a required repeat and an optional repeat both start empty.
	it('does not prefill a repeat that has no minCount, including a required one', () => {
		const required = getDefaultValue(repeatField({ required: { id: 'required', value: true, level: 'required' } }));
		assert.deepEqual(required, []);

		const optional = getDefaultValue(repeatField({}));
		assert.deepEqual(optional, []);
	});
});
