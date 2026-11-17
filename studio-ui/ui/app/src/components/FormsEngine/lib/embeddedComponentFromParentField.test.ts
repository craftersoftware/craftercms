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

const { embeddedComponentFromParentField } = await import('./formUtils.tsx');

describe('embeddedComponentFromParentField', () => {
	it('reads XML-deserialized { item: [...] } shape', () => {
		const nested = { objectId: 'nested-1', 'internal-name': 'Child' };
		const fieldValue = { item: [{ component: nested }] };
		assert.equal(embeddedComponentFromParentField(fieldValue, 0), nested);
	});

	it('reads a single XML item object (not an array)', () => {
		const nested = { objectId: 'nested-1' };
		const fieldValue = { item: { component: nested } };
		assert.equal(embeddedComponentFromParentField(fieldValue, 0), nested);
	});

	it('reads in-session NodeSelectorItem[] form values', () => {
		const nested = { objectId: 'nested-2', 'internal-name': 'Child' };
		const fieldValue = [{ key: 'nested-2', value: 'Child', component: nested }];
		assert.equal(embeddedComponentFromParentField(fieldValue, 0), nested);
	});

	it('returns undefined for missing or unmatched shapes', () => {
		assert.equal(embeddedComponentFromParentField(undefined, 0), undefined);
		assert.equal(embeddedComponentFromParentField({ item: [] }, 0), undefined);
		assert.equal(embeddedComponentFromParentField([], 0), undefined);
		assert.equal(embeddedComponentFromParentField('x', 0), undefined);
	});
});
