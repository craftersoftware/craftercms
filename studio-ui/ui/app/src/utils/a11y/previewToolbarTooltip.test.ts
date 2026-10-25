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
import test from 'node:test';
import { toolbarTooltipClearance } from './previewToolbarTooltip.ts';

test('toolbarTooltipClearance is zero on the last row and the distance to the toolbar bottom otherwise', () => {
	assert.equal(toolbarTooltipClearance(100, 100), 0);
	assert.equal(toolbarTooltipClearance(98, 100), 0);
	assert.equal(toolbarTooltipClearance(60, 100), 48);
	assert.equal(toolbarTooltipClearance(120, 100), 0);
});
