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
import {
	getRepeatMinimum,
	getRepeatOccurrenceViolations,
	isRepeatAddDisabled,
	isRepeatRemoveDisabled,
	parseRepeatOccursLimit
} from './repeatLimits.ts';

describe('parseRepeatOccursLimit', () => {
	it('maps FE1 minOccurs/maxOccurs elements onto a numeric limit', () => {
		assert.equal(parseRepeatOccursLimit('1', '9'), 1);
		assert.equal(parseRepeatOccursLimit('3'), 3);
		assert.equal(parseRepeatOccursLimit(2, '9'), 2);
	});

	it('treats * and blank as unlimited', () => {
		assert.equal(parseRepeatOccursLimit('*', '4'), null);
		assert.equal(parseRepeatOccursLimit('  *  '), null);
		assert.equal(parseRepeatOccursLimit(undefined, '*'), null);
		assert.equal(parseRepeatOccursLimit(undefined, null), null);
		assert.equal(parseRepeatOccursLimit(undefined, undefined), null);
	});

	it('falls back to the duplicated property when the element is missing', () => {
		assert.equal(parseRepeatOccursLimit(undefined, '5'), 5);
		assert.equal(parseRepeatOccursLimit('', 4), 4);
		assert.equal(parseRepeatOccursLimit(undefined, 5), 5);
	});
});

describe('isRepeatAddDisabled', () => {
	it('enables Add on an empty repeat that has a max', () => {
		assert.equal(isRepeatAddDisabled(false, 0, 5), false);
	});

	it('enables Add below the max and disables it once the count reaches the max', () => {
		assert.equal(isRepeatAddDisabled(false, 4, 5), false);
		assert.equal(isRepeatAddDisabled(false, 5, 5), true);
		assert.equal(isRepeatAddDisabled(false, 6, 5), true);
	});

	it('leaves Add enabled when there is no max', () => {
		assert.equal(isRepeatAddDisabled(false, 0, undefined), false);
		assert.equal(isRepeatAddDisabled(false, 20, null), false);
		assert.equal(isRepeatAddDisabled(false, 20, '*'), false);
		assert.equal(isRepeatAddDisabled(false, 20, ''), false);
	});

	it('disables Add when the field is readonly', () => {
		assert.equal(isRepeatAddDisabled(true, 0, undefined), true);
		assert.equal(isRepeatAddDisabled(true, 0, 5), true);
	});

	it('accepts a numeric string limit from a content type property', () => {
		assert.equal(isRepeatAddDisabled(false, 0, '5'), false);
		assert.equal(isRepeatAddDisabled(false, 5, '5'), true);
	});
});

describe('isRepeatRemoveDisabled', () => {
	it('disables removal at or below the minimum, matching FE1', () => {
		assert.equal(isRepeatRemoveDisabled(false, 1, 1), true);
		assert.equal(isRepeatRemoveDisabled(false, 2, 1), false);
		assert.equal(isRepeatRemoveDisabled(false, 2, 2), true);
	});

	it('allows removal of existing items when no minimum is set', () => {
		assert.equal(isRepeatRemoveDisabled(false, 1, undefined), false);
		assert.equal(isRepeatRemoveDisabled(false, 1, null), false);
		assert.equal(isRepeatRemoveDisabled(false, 1, 0), false);
	});

	it('disables removal when readonly', () => {
		assert.equal(isRepeatRemoveDisabled(true, 3, 0), true);
	});

	it('treats a required repeat with no minCount as a minimum of 1', () => {
		assert.equal(getRepeatMinimum(undefined, true), 1);
		assert.equal(getRepeatMinimum(undefined, false), 0);
		assert.equal(getRepeatMinimum(3, true), 3);
		assert.equal(isRepeatRemoveDisabled(false, 1, undefined, true), true);
		assert.equal(isRepeatRemoveDisabled(false, 2, undefined, true), false);
	});
});

describe('getRepeatOccurrenceViolations', () => {
	it('is invalid below the minimum, including an empty repeat', () => {
		assert.deepEqual(getRepeatOccurrenceViolations(0, 1, 3), [{ kind: 'min', limit: 1 }]);
		assert.deepEqual(getRepeatOccurrenceViolations(1, 2, 5), [{ kind: 'min', limit: 2 }]);
	});

	it('is invalid when loaded data has more items than the maximum', () => {
		assert.deepEqual(getRepeatOccurrenceViolations(4, 1, 3), [{ kind: 'max', limit: 3 }]);
	});

	it('accepts a count equal to the minimum or the maximum', () => {
		assert.deepEqual(getRepeatOccurrenceViolations(1, 1, 3), []);
		assert.deepEqual(getRepeatOccurrenceViolations(3, 1, 3), []);
		assert.deepEqual(getRepeatOccurrenceViolations(0, 0, 3), []);
	});

	it('does not apply an upper bound when there is no max', () => {
		assert.deepEqual(getRepeatOccurrenceViolations(100, undefined, undefined), []);
		assert.deepEqual(getRepeatOccurrenceViolations(100, 0, '*'), []);
		assert.deepEqual(getRepeatOccurrenceViolations(100, null, null), []);
	});

	it('reads numeric strings', () => {
		assert.deepEqual(getRepeatOccurrenceViolations(0, '1', '3'), [{ kind: 'min', limit: 1 }]);
		assert.deepEqual(getRepeatOccurrenceViolations(4, '1', '3'), [{ kind: 'max', limit: 3 }]);
	});
});
