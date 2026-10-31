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

/**
 * Repeat items keep unknown children and prefixed attributes for save, but the
 * list title and summary only read the group's configured fields. Reorder uses
 * that same title and still carries the whole item.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import '../../../../test/registerTsLoader.mjs';

const { xmlAttributePrefix } = await import('../lib/formConsts.ts');
const { getRepeatItemSummary, getRepeatItemTitle, repeatDisplayFieldIds, repeatSortItems } =
	await import('./repeatItemDisplay.ts');

const fields = ['key', 'value'] as const;
const attribute = `${xmlAttributePrefix}source`;

describe('repeat item display', () => {
	it('uses the first configured field when an unknown child is stored first', () => {
		const item = { unicode: 'U+0041', key: 'alpha', value: 'Alpha' };
		assert.equal(getRepeatItemTitle(item, fields), 'alpha');
		assert.equal(getRepeatItemSummary(item, fields), 'alpha | Alpha');
	});

	it('leaves a preserved string item attribute out of the title and summary', () => {
		const item = { [attribute]: 'legacy', key: 'alpha', value: 'Alpha' };
		const fieldIds = repeatDisplayFieldIds({ [attribute]: {}, key: {}, value: {} });
		assert.equal(getRepeatItemTitle(item, fieldIds), 'alpha');
		assert.equal(getRepeatItemSummary(item, fieldIds), 'alpha | Alpha');
	});

	it('prefers a populated configured title field', () => {
		const item = { unicode: 'U+0041', [attribute]: 'legacy', key: 'alpha', title_t: 'The title', value: 'Alpha' };
		const titled = ['key', 'title_t', 'value'];
		assert.equal(getRepeatItemTitle(item, titled), 'The title');
		assert.equal(getRepeatItemSummary(item, titled), 'alpha | The title | Alpha');
	});

	it('is blank when no configured field has a value', () => {
		const item = { unicode: 'U+0041', [attribute]: 'legacy', key: '', value: undefined };
		assert.equal(getRepeatItemTitle(item, fields), '');
		assert.equal(getRepeatItemSummary(item, fields), '');
	});

	it('skips an empty node selector that precedes the title field', () => {
		const item = { subtitle_o: [], key: 'alpha', title_t: 'The title' };
		assert.equal(getRepeatItemTitle(item, ['subtitle_o', 'key', 'title_t']), 'The title');
	});

	it('treats 0 and false as displayable values', () => {
		assert.equal(getRepeatItemTitle({ key: 'alpha', count_title: 0 }, ['key', 'count_title']), '0');
		assert.equal(getRepeatItemTitle({ key: 'alpha', flag_title: false }, ['key', 'flag_title']), 'false');
		assert.equal(getRepeatItemTitle({ count: 0, key: 'alpha' }, ['count', 'key']), '0');
		assert.equal(getRepeatItemTitle({ flag: false, key: 'alpha' }, ['flag', 'key']), 'false');
	});

	it('reorders with the corrected title and keeps the stored item', () => {
		const item = { unicode: 'U+0041', [attribute]: 'legacy', key: 'alpha', value: 'Alpha' };
		const [entry] = repeatSortItems([item], fields);
		assert.equal(entry.value, 'alpha');
		assert.equal(entry.data, item);
	});
});
