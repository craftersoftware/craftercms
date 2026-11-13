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
import '../../../../test/registerTsLoader.mjs';
import type { ContentTypeField } from '../../../models/ContentType';

const { getNumericValidationValue } = await import('./fieldPropertyUtils.ts');

function validations(maxLength: unknown): ContentTypeField['validations'] {
	return {
		maxLength: { id: 'maxLength', value: maxLength, level: 'required' }
	};
}

describe('getNumericValidationValue', () => {
	// Given a positive integer (number or digit string), the limit is kept for input/validator use.
	it('returns a positive integer limit', () => {
		assert.equal(getNumericValidationValue(validations(50), 'maxLength'), 50);
		assert.equal(getNumericValidationValue(validations('50'), 'maxLength'), 50);
	});

	// Given missing, blank, zero, star, or non-numeric junk (e.g. hand-edited maxlength), treat as no limit.
	it('treats missing, zero, and non-numeric values as no limit', () => {
		assert.equal(getNumericValidationValue(undefined, 'maxLength'), undefined);
		assert.equal(getNumericValidationValue({}, 'maxLength'), undefined);
		assert.equal(getNumericValidationValue(validations(0), 'maxLength'), undefined);
		assert.equal(getNumericValidationValue(validations('0'), 'maxLength'), undefined);
		assert.equal(getNumericValidationValue(validations(''), 'maxLength'), undefined);
		assert.equal(getNumericValidationValue(validations('*'), 'maxLength'), undefined);
		assert.equal(getNumericValidationValue(validations('abc'), 'maxLength'), undefined);
		assert.equal(getNumericValidationValue(validations('12abc'), 'maxLength'), undefined);
	});
});
