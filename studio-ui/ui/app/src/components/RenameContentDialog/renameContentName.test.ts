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
 * Rename starts with the current item name. When that name already exceeds maxLength (legacy content
 * or a tightened limit), exceedsRenameMaxLength is true immediately — the field shows the error and
 * rename stays disabled until the user shortens it. HTML maxLength does not clear that initial state.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import '../../../test/registerTsLoader.mjs';

const { exceedsRenameMaxLength, getItemName } = await import('./renameContentName.ts');

describe('exceedsRenameMaxLength', () => {
	// Given an unchanged legacy name longer than the configured limit, flag as over-limit on open.
	it('flags an initial legacy name that already exceeds maxLength', () => {
		const legacyName = 'this-name-is-already-longer-than-the-limit';
		const maxLength = 20;
		assert.ok(legacyName.length > maxLength);
		assert.equal(exceedsRenameMaxLength(legacyName, maxLength), true);
	});

	it('does not flag names at or under maxLength', () => {
		assert.equal(exceedsRenameMaxLength('short', 20), false);
		assert.equal(exceedsRenameMaxLength('exactly-twenty-chars', 20), false);
	});

	it('treats missing maxLength as no limit', () => {
		const longName = 'a'.repeat(200);
		assert.equal(exceedsRenameMaxLength(longName, undefined), false);
		assert.equal(exceedsRenameMaxLength(longName, null), false);
	});

	// After the user shortens below the limit, the over-limit flag clears (rename still needs a change).
	it('clears once the name is shortened to fit', () => {
		const maxLength = 10;
		assert.equal(exceedsRenameMaxLength('way-too-long-legacy-name', maxLength), true);
		assert.equal(exceedsRenameMaxLength('shortened', maxLength), false);
	});
});

describe('getItemName', () => {
	it('strips page and component extensions before length checks', () => {
		assert.equal(getItemName('about/index.xml'), 'about');
		assert.equal(getItemName('my-component.xml'), 'my-component');
		assert.equal(exceedsRenameMaxLength(getItemName('abcdefghijklmnop/index.xml'), 10), true);
		assert.equal(exceedsRenameMaxLength(getItemName('short.xml'), 10), false);
	});
});
