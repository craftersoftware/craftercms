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
import {
	previewToolbarTooltipDelays,
	toolbarTooltipClearance,
	tooltipShiftFitsViewport,
	withPreviewToolbarTooltipDelays
} from './previewToolbarTooltip.ts';

test('toolbarTooltipClearance is zero on the last row and the distance to the toolbar bottom otherwise', () => {
	assert.equal(toolbarTooltipClearance(100, 100), 0);
	assert.equal(toolbarTooltipClearance(98, 100), 0);
	assert.equal(toolbarTooltipClearance(60, 100), 48);
	assert.equal(toolbarTooltipClearance(120, 100), 0);
});

test('preview toolbar tooltip delays stay 200/0 above 480px and 600/400 at the narrow width', () => {
	assert.deepEqual(previewToolbarTooltipDelays(false), { leaveDelay: 200, enterNextDelay: 0 });
	assert.deepEqual(previewToolbarTooltipDelays(true), { leaveDelay: 600, enterNextDelay: 400 });
});

test('tooltipShiftFitsViewport is false when the shifted tooltip would leave the window', () => {
	assert.equal(tooltipShiftFitsViewport(40, 48, 32, 215), true);
	assert.equal(tooltipShiftFitsViewport(180, 48, 32, 215), false);
	assert.equal(tooltipShiftFitsViewport(100, 40, 32, 180), true);
	assert.equal(tooltipShiftFitsViewport(140, 48, 32, 180), false);
});

test('withPreviewToolbarTooltipDelays keeps 200/0 above 480px and sets 600/400 only when narrow', () => {
	const theme = {
		palette: { mode: 'light' },
		components: {
			MuiButton: { defaultProps: { disableRipple: true } },
			MuiTooltip: {
				defaultProps: { disableInteractive: false, leaveDelay: 200, slotProps: { popper: { keepMounted: true } } },
				styleOverrides: { tooltip: { marginTop: 14 } }
			}
		}
	};
	const wide = withPreviewToolbarTooltipDelays(theme, false);
	assert.notEqual(wide, theme);
	assert.equal(wide.palette, theme.palette);
	assert.equal(wide.components.MuiButton, theme.components.MuiButton);
	assert.deepEqual(wide.components.MuiTooltip.styleOverrides, theme.components.MuiTooltip.styleOverrides);
	assert.deepEqual(wide.components.MuiTooltip.defaultProps, {
		disableInteractive: false,
		leaveDelay: 200,
		enterNextDelay: 0,
		slotProps: { popper: { keepMounted: true } }
	});
	assert.equal(theme.components.MuiTooltip.defaultProps.leaveDelay, 200);
	assert.equal(theme.components.MuiTooltip.defaultProps.enterNextDelay, undefined);
	const narrow = withPreviewToolbarTooltipDelays(theme, true);
	assert.equal(narrow.palette, theme.palette);
	assert.equal(narrow.components.MuiButton, theme.components.MuiButton);
	assert.deepEqual(narrow.components.MuiTooltip.styleOverrides, theme.components.MuiTooltip.styleOverrides);
	assert.deepEqual(narrow.components.MuiTooltip.defaultProps, {
		disableInteractive: false,
		leaveDelay: 600,
		enterNextDelay: 400,
		slotProps: { popper: { keepMounted: true } }
	});
	assert.equal(theme.components.MuiTooltip.defaultProps.leaveDelay, 200);
	assert.equal(theme.components.MuiTooltip.defaultProps.enterNextDelay, undefined);
});
