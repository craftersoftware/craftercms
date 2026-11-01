/*
 * Copyright (C) 2007-2025 Crafter Software Corporation. All Rights Reserved.
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

// MUI IconButton size="small" padding is 5px per side. spacing(1.25) is those 10px.
export const iconButtonSmallPadding = 1.25;

// SvgIcon's medium size plus that padding. The button is square, so this is its height and width.
export function iconButtonSmallSize(theme: Theme) {
	return `${theme.typography.pxToRem(24)} + ${theme.spacing(iconButtonSmallPadding)}`;
}

export function formHeaderTitleMinHeight(theme: Theme) {
	return `calc(${iconButtonSmallSize(theme)})`;
}
