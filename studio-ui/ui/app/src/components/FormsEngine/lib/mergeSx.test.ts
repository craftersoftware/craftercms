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

/** The wrapper's own sx comes first, and the caller's sx in any MUI form is appended after it. */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import '../../../../test/registerTsLoader.mjs';

const { mergeSx } = await import('./mergeSx.ts');

const base = { '.MuiFormLabel-asterisk': { display: 'none' } };

describe('mergeSx', () => {
	it('returns the base alone when there is no caller sx', () => {
		assert.deepEqual(mergeSx(base), [base]);
		assert.deepEqual(mergeSx(base, undefined), [base]);
	});

	it('appends an object, a function and an array in order', () => {
		const object = { mt: 2 };
		const fn = () => ({ mb: 1 });
		assert.deepEqual(mergeSx(base, object), [base, object]);
		assert.deepEqual(mergeSx(base, fn), [base, fn]);
		assert.deepEqual(mergeSx(base, [object, fn, false]), [base, object, fn, false]);
	});
});
