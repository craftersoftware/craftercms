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
import '../../../test/registerTsLoader.mjs';

const {
	checkFieldNamePostfix,
	shouldPreserveVariableInput,
	collectTopLevelFieldNamePostfixViolations,
	formatPostfixList
} = await import('./fieldNamePostfix.ts');

describe('checkFieldNamePostfix', () => {
	it('matches ignore-postfix-fields exactly on the whole name', () => {
		assert.equal(checkFieldNamePostfix('internal-name', ['internal-name'], ['_s']), 'ignored');
		assert.equal(checkFieldNamePostfix('internal', ['internal-name'], ['_s']), 'missing');
		assert.equal(checkFieldNamePostfix('internal-name-extra', ['internal-name'], ['_s']), 'missing');
		assert.equal(checkFieldNamePostfix('file-name', ['internal-name', 'file-name'], ['_s']), 'ignored');
	});

	it('requires the postfix at the end of the name', () => {
		assert.equal(checkFieldNamePostfix('title_s', [], ['_s', '_t']), 'ok');
		assert.equal(checkFieldNamePostfix('is_syz', [], ['_s']), 'missing');
		assert.equal(checkFieldNamePostfix('is_sold', [], ['_s']), 'missing');
	});

	it('does not treat a shorter postfix as a match for a longer ending', () => {
		assert.equal(checkFieldNamePostfix('title_dt', [], ['_dt']), 'ok');
		assert.equal(checkFieldNamePostfix('title_dt', [], ['_d']), 'missing');
		assert.equal(checkFieldNamePostfix('title_dt', [], ['_d', '_dt']), 'ok');
		assert.equal(checkFieldNamePostfix('title_d', [], ['_dt', '_d']), 'ok');
	});

	it('treats an empty suffixes list as ok', () => {
		assert.equal(checkFieldNamePostfix('uuid', [], []), 'ok');
		assert.equal(checkFieldNamePostfix('uuid', ['other'], []), 'ok');
	});
});

describe('shouldPreserveVariableInput', () => {
	it('preserves input when an ignore entry starts with it', () => {
		assert.equal(shouldPreserveVariableInput('internal-', ['internal-name']), true);
		assert.equal(shouldPreserveVariableInput('internal-name', ['internal-name', 'file-name']), true);
		assert.equal(shouldPreserveVariableInput('file', ['internal-name', 'file-name']), true);
	});

	it('does not preserve unrelated or empty input', () => {
		assert.equal(shouldPreserveVariableInput('my-field', ['internal-name']), false);
		assert.equal(shouldPreserveVariableInput('internal-name-extra', ['internal-name']), false);
		assert.equal(shouldPreserveVariableInput('', ['internal-name']), false);
		assert.equal(shouldPreserveVariableInput('internal-', []), false);
	});
});

describe('collectTopLevelFieldNamePostfixViolations', () => {
	const suffixesByType: Record<string, string[]> = {
		input: ['_s', '_t'],
		repeat: ['_o']
	};

	it('reports top-level fields missing an ending postfix and skips nested and ignored fields', () => {
		const type = {
			sections: [{ fields: ['title_bad', 'internal-name', 'items_o'] }],
			fields: {
				title_bad: { id: 'title_bad', name: 'Title', type: 'input' },
				'internal-name': { id: 'internal-name', name: 'Internal Name', type: 'input' },
				items_o: {
					id: 'items_o',
					name: 'Items',
					type: 'repeat',
					fields: {
						child_bad: { id: 'child_bad', name: 'Child', type: 'input' }
					}
				}
			}
		};
		const violations = collectTopLevelFieldNamePostfixViolations(
			type as never,
			['internal-name'],
			(field) => suffixesByType[field.type]
		);
		assert.deepEqual(violations, [{ id: 'title_bad', title: 'Title', suffixes: ['_s', '_t'] }]);
	});

	it('skips fields without an id or title', () => {
		const type = {
			sections: [{ fields: ['a', 'b'] }],
			fields: {
				a: { id: '', name: 'Empty Id', type: 'input' },
				b: { id: 'no_title_s', name: '', type: 'input' }
			}
		};
		assert.deepEqual(
			collectTopLevelFieldNamePostfixViolations(type as never, [], (field) => suffixesByType[field.type]),
			[]
		);
	});
});

describe('formatPostfixList', () => {
	it('joins suffixes like Type Builder 1', () => {
		assert.equal(formatPostfixList([]), '');
		assert.equal(formatPostfixList(['_s']), '_s');
		assert.equal(formatPostfixList(['_s', '_t']), '_s or _t');
		assert.equal(formatPostfixList(['_s', '_t', '_i']), '_s, _t or _i');
	});
});
