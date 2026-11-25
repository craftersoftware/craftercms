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

import '../../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const { matchesFocusRequest, FOCUS_REQUEST_MAX_AGE_MS } = await import('./nodeSelectorFocusRequest.ts');

const list = [
	{ key: 'a', value: 'A' },
	{ key: 'b', value: 'B' }
];
const request = { modelId: 'm', fieldId: 'f', index: 1, key: 'b', at: 1000 };
const current = { modelId: 'm', fieldId: 'f', list, now: 1000 };

describe('matchesFocusRequest', () => {
	it('matches the field, a fresh request, and the row at the requested index', () => {
		assert.equal(matchesFocusRequest(request, current), true);
	});

	it('does not match without a request', () => {
		assert.equal(matchesFocusRequest(null, current), false);
	});

	it('does not match another field or model', () => {
		assert.equal(matchesFocusRequest(request, { ...current, fieldId: 'other' }), false);
		assert.equal(matchesFocusRequest(request, { ...current, modelId: 'other' }), false);
	});

	it('does not match when the row at the index is another item', () => {
		assert.equal(matchesFocusRequest({ ...request, key: 'c' }, current), false);
		assert.equal(matchesFocusRequest({ ...request, index: 5 }, current), false);
	});

	it('does not match an expired request', () => {
		assert.equal(matchesFocusRequest(request, { ...current, now: 1000 + FOCUS_REQUEST_MAX_AGE_MS }), true);
		assert.equal(matchesFocusRequest(request, { ...current, now: 1000 + FOCUS_REQUEST_MAX_AGE_MS + 1 }), false);
	});
});
