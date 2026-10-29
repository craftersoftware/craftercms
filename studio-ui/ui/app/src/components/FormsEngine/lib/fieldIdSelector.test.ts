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

// Node has no CSS.escape. The selector must use whatever the platform provides, so the test
// installs a stand-in before the module runs and checks the id is passed through it.
globalThis.CSS = {
	escape(value: string) {
		return `escaped:${value}`;
	}
} as unknown as typeof CSS;

const { fieldIdSelector } = await import('./formUtils.tsx');

describe('fieldIdSelector', () => {
	it('puts the escaped field id inside the attribute selector', () => {
		assert.equal(fieldIdSelector('title_s'), '[data-field-id="escaped:title_s"]');
		assert.equal(fieldIdSelector('a"b'), '[data-field-id="escaped:a"b"]');
	});
});
