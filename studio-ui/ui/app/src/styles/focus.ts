/*
 * Copyright (C) 2007-2022 Crafter Software Corporation. All Rights Reserved.
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

import type { Theme } from '@mui/material/styles';

/** Keyboard focus ring that stays visible when the theme turns ripples off (WCAG 2.4.7). */
export const focusVisibleSx = {
	'&.Mui-focusVisible': {
		outline: (theme: Theme) => `2px solid ${theme.palette.primary.main}`,
		outlineOffset: 2
	}
};

/** Same ring, drawn inside the box: a full-width row starts at the panel edge, where an outer ring is clipped. */
export const focusVisibleInsetSx = {
	'&.Mui-focusVisible': {
		outline: (theme: Theme) => `2px solid ${theme.palette.primary.main}`,
		outlineOffset: -2
	}
};
