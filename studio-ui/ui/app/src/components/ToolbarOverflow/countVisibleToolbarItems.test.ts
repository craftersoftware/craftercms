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
import { test } from 'node:test';
import { countVisibleToolbarItems } from './countVisibleToolbarItems.ts';

test('keeps every item when the row is wide enough', () => {
	assert.equal(countVisibleToolbarItems([40, 40, 48], 1280, 48), 3);
});

test('reserves the overflow button before packing items', () => {
	assert.equal(countVisibleToolbarItems([80, 80, 80], 200, 48), 1);
});

test('puts every item in the menu when even one item cannot sit beside the button', () => {
	assert.equal(countVisibleToolbarItems([180, 40], 100, 48), 0);
});

test('does not collapse a container that has not been measured', () => {
	assert.equal(countVisibleToolbarItems([40, 40], 0, 48), 2);
});

test('returns zero for an empty row', () => {
	assert.equal(countVisibleToolbarItems([], 320, 48), 0);
});
