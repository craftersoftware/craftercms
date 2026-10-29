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
	countLimitValue,
	countLimitsFromStorage,
	itemCountEditorValue,
	getRepeatMinimum,
	getRepeatOccurrenceViolations,
	isItemCountMaxEditorValue,
	isItemCountMinEditorValue,
	isItemCountRangeValid,
	isRepeatAddDisabled,
	isRepeatRemoveDisabled,
	getCountLimitStorage,
	repeatLimitEditorValues,
	repeatOccursXmlValues
} from './countLimits.ts';

/**
 * The shared min/max contract in utils/countLimits.ts.
 * getCountLimitStorage reads that table by the control's own key. Prototype names are not controls.
 * countLimitStorage says where each control stores its limits. Each entry is round-tripped through parse,
 * the Type Builder editor and XML in countLimits.roundTrip.test.ts.
 * Storage parsing: the element wins, an invalid token falls back to the property, and 0, blank and * are unlimited.
 * A warning is logged only when a bound has nothing usable. Type Builder editor tokens and the Add, Delete and
 * occurrence helpers use that same reading of a limit.
 */

// The warning text names this content type and this field. accounts_o is the repeat used for the element-vs-property case.
const fieldContext = { contentTypeId: '/page/article', fieldId: 'accounts_o' };

describe('getCountLimitStorage', () => {
	// Given constructor and toString, the lookup is undefined. Those names live on Object.prototype, not in the table. repeat is a real entry.
	it('ignores prototype keys and returns an entry only for a listed control', () => {
		assert.equal(getCountLimitStorage('constructor'), undefined);
		assert.equal(getCountLimitStorage('toString'), undefined);
		assert.equal(getCountLimitStorage('repeat')?.type, 'repeat');
		assert.equal(getCountLimitStorage('input'), undefined);
	});
});

describe('countLimitsFromStorage', () => {
	// Given a usable element and a different property, the element is the limit and the property is ignored.
	it('lets the element win over the property', () => {
		assert.deepEqual(countLimitsFromStorage({ minElement: '1', minProperty: '0', maxElement: '*', maxProperty: '4' }), {
			minCount: 1
		});
		assert.deepEqual(countLimitsFromStorage({ minElement: '2', minProperty: '9', maxElement: '3', maxProperty: '8' }), {
			minCount: 2,
			maxCount: 3
		});
	});

	// Given a blank or whitespace element, the property is the limit.
	it('uses the property when the element is blank', () => {
		assert.deepEqual(countLimitsFromStorage({ minProperty: '5', maxElement: '', maxProperty: '4' }), {
			minCount: 5,
			maxCount: 4
		});
		assert.deepEqual(countLimitsFromStorage({ minElement: '  ', minProperty: 2, maxProperty: 6 }), {
			minCount: 2,
			maxCount: 6
		});
	});

	// Given a stored 0, including a repeat maximum of 0 next to a property of 4, there is no limit. 0 does not fall back.
	it('treats 0 as unlimited for every control, including a repeat maximum', () => {
		assert.deepEqual(
			countLimitsFromStorage({ minElement: '0', minProperty: '4', maxElement: '*', maxProperty: '3' }),
			{}
		);
		assert.deepEqual(countLimitsFromStorage({ maxElement: '0', maxProperty: '*' }), {});
		assert.deepEqual(countLimitsFromStorage({ minProperty: '0', maxProperty: '0' }), {});
		assert.deepEqual(countLimitsFromStorage({ minProperty: 2, maxProperty: 0 }), { minCount: 2 });
		assert.deepEqual(countLimitsFromStorage({ minProperty: '2' }), { minCount: 2 });
	});

	// Given '0.5', '3abc', '-1' or a minimum of '*', the token is blank and the property is used.
	it('treats an invalid value as blank and falls back to the property', () => {
		assert.deepEqual(
			countLimitsFromStorage({ minElement: '0.5', minProperty: '2', maxElement: '3abc', maxProperty: '4' }),
			{ minCount: 2, maxCount: 4 }
		);
		assert.deepEqual(countLimitsFromStorage({ minElement: '-1', minProperty: '2', maxElement: -1, maxProperty: '4' }), {
			minCount: 2,
			maxCount: 4
		});
		assert.deepEqual(
			countLimitsFromStorage({ minElement: '*', minProperty: '2', maxElement: ' * ', maxProperty: '4' }),
			{
				minCount: 2
			}
		);
		assert.equal(isRepeatAddDisabled(false, 0, '-1'), false);
		assert.equal(isRepeatAddDisabled(false, 1, 0), false);
	});

	// Given accounts_o with '-1'/'3abc' and '0.5'/blank, both bounds warn and stay unset. A blank limit, or a usable property, does not warn.
	it('warns when nothing is usable, and stays quiet for a blank limit', () => {
		const warnings: string[] = [];
		const original = console.warn;
		console.warn = (message?: unknown) => {
			warnings.push(String(message));
		};
		try {
			assert.deepEqual(
				countLimitsFromStorage(
					{ minElement: '-1', minProperty: '3abc', maxElement: '0.5', maxProperty: '' },
					fieldContext
				),
				{}
			);
			assert.equal(warnings.length, 2);
			assert.match(warnings.join('\n'), /\/page\/article/);
			assert.match(warnings.join('\n'), /accounts_o/);
			assert.match(warnings.join('\n'), /min/);
			assert.match(warnings.join('\n'), /max/);

			warnings.length = 0;
			assert.deepEqual(countLimitsFromStorage({ minElement: '', maxElement: undefined }, fieldContext), {});
			assert.equal(warnings.length, 0);

			assert.deepEqual(countLimitsFromStorage({ minElement: 'nope', minProperty: '1' }), { minCount: 1 });
			assert.equal(warnings.length, 0);
		} finally {
			console.warn = original;
		}
	});

	// Given no maximum, an int field shows blank and any other field shows '*'. A minimum with no limit shows 0.
	it('shows a stored max of 0 as the editor unlimited token', () => {
		assert.equal(itemCountEditorValue(undefined, 'max', 'int'), '');
		assert.equal(itemCountEditorValue(undefined, 'max', 'string'), '*');
		assert.equal(itemCountEditorValue(4, 'max', 'int'), 4);
		assert.equal(itemCountEditorValue(undefined, 'min', 'int'), 0);
		assert.equal(itemCountEditorValue(2, 'min', 'int'), 2);
	});

	// Given blank editor values, the saved repeat is min '0' and max '*'. A stored max of 0 is saved as '*'.
	it('writes TB1 defaults for the editor and the XML', () => {
		assert.deepEqual(repeatLimitEditorValues({}), { minOccurs: 0, maxOccurs: '*' });
		assert.deepEqual(repeatLimitEditorValues({ minCount: 1, maxCount: 3 }), { minOccurs: 1, maxOccurs: '3' });
		assert.deepEqual(repeatOccursXmlValues(undefined, ''), { minOccurs: '0', maxOccurs: '*' });
		assert.deepEqual(repeatOccursXmlValues(1, '*'), { minOccurs: '1', maxOccurs: '*' });
		assert.deepEqual(repeatOccursXmlValues('2', 4), { minOccurs: '2', maxOccurs: '4' });
		assert.deepEqual(repeatOccursXmlValues(0, 0), { minOccurs: '0', maxOccurs: '*' });
	});
});

describe('item count editor values', () => {
	// Given the editor helpers, a minimum may be blank or 0, and a maximum may be blank or '*' but not 0 or junk.
	it('accepts a minimum of 0 and rejects a maximum of 0', () => {
		assert.equal(isItemCountMinEditorValue(''), true);
		assert.equal(isItemCountMinEditorValue(0), true);
		assert.equal(isItemCountMinEditorValue('2'), true);
		assert.equal(isItemCountMinEditorValue('-1'), false);
		assert.equal(isItemCountMinEditorValue('1.5'), false);

		assert.equal(isItemCountMaxEditorValue(''), true);
		assert.equal(isItemCountMaxEditorValue(undefined), true);
		assert.equal(isItemCountMaxEditorValue('*'), true);
		assert.equal(isItemCountMaxEditorValue(' * '), true);
		assert.equal(isItemCountMaxEditorValue('1'), true);
		assert.equal(isItemCountMaxEditorValue(4), true);
		assert.equal(isItemCountMaxEditorValue('0'), false);
		assert.equal(isItemCountMaxEditorValue(0), false);
		assert.equal(isItemCountMaxEditorValue('abc'), false);
		assert.equal(isItemCountMaxEditorValue('2.5'), false);
		assert.equal(isItemCountMaxEditorValue('3abc'), false);
	});

	// Given both bounds are set, min greater than max is invalid. An unlimited side (0, '*', blank) skips the comparison.
	it('rejects a minimum greater than the maximum when both are set', () => {
		assert.equal(isItemCountRangeValid(2, 4), true);
		assert.equal(isItemCountRangeValid(4, 4), true);
		assert.equal(isItemCountRangeValid(5, 3), false);
		assert.equal(isItemCountRangeValid(0, 3), true);
		assert.equal(isItemCountRangeValid(5, '*'), true);
		assert.equal(isItemCountRangeValid(5, ''), true);
		assert.equal(isItemCountRangeValid('2', '1'), false);
	});
});

describe('countLimitValue', () => {
	// Given 0, null, blank or '*', the runtime limit is undefined. A positive integer is kept.
	it('treats 0 and nullish values as unlimited', () => {
		assert.equal(countLimitValue(0), undefined);
		assert.equal(countLimitValue('0'), undefined);
		assert.equal(countLimitValue(3), 3);
		assert.equal(countLimitValue(undefined), undefined);
		assert.equal(countLimitValue(null), undefined);
		assert.equal(countLimitValue(''), undefined);
		assert.equal(countLimitValue('*'), undefined);
	});
});

describe('isRepeatAddDisabled', () => {
	// Given an empty repeat and a max of 5, Add stays enabled so the author can reach the minimum.
	it('enables Add on an empty repeat that has a max', () => {
		assert.equal(isRepeatAddDisabled(false, 0, 5), false);
	});

	// Given a max of 5, Add is enabled at 4 and disabled at 5 and above.
	it('enables Add below the max and disables it once the count reaches the max', () => {
		assert.equal(isRepeatAddDisabled(false, 4, 5), false);
		assert.equal(isRepeatAddDisabled(false, 5, 5), true);
		assert.equal(isRepeatAddDisabled(false, 6, 5), true);
	});

	// Given no maximum (undefined, null, '*' or blank), Add stays enabled at any count.
	it('leaves Add enabled when there is no max', () => {
		assert.equal(isRepeatAddDisabled(false, 0, undefined), false);
		assert.equal(isRepeatAddDisabled(false, 20, null), false);
		assert.equal(isRepeatAddDisabled(false, 20, '*'), false);
		assert.equal(isRepeatAddDisabled(false, 20, ''), false);
	});

	// Given a readonly field, Add is disabled whether or not a maximum is set.
	it('disables Add when the field is readonly', () => {
		assert.equal(isRepeatAddDisabled(true, 0, undefined), true);
		assert.equal(isRepeatAddDisabled(true, 0, 5), true);
	});

	// Given a max stored as the string '5', Add uses 5 the same way as the number 5.
	it('accepts a numeric string limit from a content type property', () => {
		assert.equal(isRepeatAddDisabled(false, 0, '5'), false);
		assert.equal(isRepeatAddDisabled(false, 5, '5'), true);
	});
});

describe('isRepeatRemoveDisabled', () => {
	// Given a minimum of 1 or 2, Delete is disabled at that count and enabled once the count is higher.
	it('disables removal at or below the minimum', () => {
		assert.equal(isRepeatRemoveDisabled(false, 1, 1), true);
		assert.equal(isRepeatRemoveDisabled(false, 2, 1), false);
		assert.equal(isRepeatRemoveDisabled(false, 2, 2), true);
	});

	// Given no minimum (undefined, null or 0), Delete stays enabled. The enforced minimum is 0.
	it('allows removal of existing items when no minimum is set', () => {
		assert.equal(isRepeatRemoveDisabled(false, 1, undefined), false);
		assert.equal(isRepeatRemoveDisabled(false, 1, null), false);
		assert.equal(isRepeatRemoveDisabled(false, 1, 0), false);
		assert.equal(getRepeatMinimum(undefined), 0);
		assert.equal(getRepeatMinimum(0), 0);
		assert.equal(getRepeatMinimum(3), 3);
	});

	// Given a readonly field, Delete is disabled even when the count is above the minimum.
	it('disables removal when readonly', () => {
		assert.equal(isRepeatRemoveDisabled(true, 3, 0), true);
	});
});

describe('getRepeatOccurrenceViolations', () => {
	// Given a minimum of 1 or 2, a count below it, including 0, is a minimum violation.
	it('is invalid below the minimum, including an empty repeat', () => {
		assert.deepEqual(getRepeatOccurrenceViolations(0, 1, 3), [{ kind: 'min', limit: 1 }]);
		assert.deepEqual(getRepeatOccurrenceViolations(1, 2, 5), [{ kind: 'min', limit: 2 }]);
	});

	// Given a maximum of 3, a loaded count of 4 is a maximum violation.
	it('is invalid when loaded data has more items than the maximum', () => {
		assert.deepEqual(getRepeatOccurrenceViolations(4, 1, 3), [{ kind: 'max', limit: 3 }]);
	});

	// Given a count sitting on either bound, including a minimum of 0, there is no violation.
	it('accepts a count equal to the minimum or the maximum', () => {
		assert.deepEqual(getRepeatOccurrenceViolations(1, 1, 3), []);
		assert.deepEqual(getRepeatOccurrenceViolations(3, 1, 3), []);
		assert.deepEqual(getRepeatOccurrenceViolations(0, 0, 3), []);
	});

	// Given no maximum (undefined, 0 or '*'), a large count is valid.
	it('does not apply an upper bound when there is no max', () => {
		assert.deepEqual(getRepeatOccurrenceViolations(100, undefined, undefined), []);
		assert.deepEqual(getRepeatOccurrenceViolations(100, 0, '*'), []);
		assert.deepEqual(getRepeatOccurrenceViolations(100, null, null), []);
		assert.deepEqual(getRepeatOccurrenceViolations(5, 0, 0), []);
	});

	// Given limits stored as the strings '1' and '3', the same bounds apply as for numbers.
	it('reads numeric strings', () => {
		assert.deepEqual(getRepeatOccurrenceViolations(0, '1', '3'), [{ kind: 'min', limit: 1 }]);
		assert.deepEqual(getRepeatOccurrenceViolations(4, '1', '3'), [{ kind: 'max', limit: 3 }]);
	});
});
