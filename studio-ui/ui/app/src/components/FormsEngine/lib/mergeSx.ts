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

import type { SxProps, Theme } from '@mui/material/styles';

/**
 * Appends a caller's `sx` to the host's own `sx`. MUI accepts an object, a function or an array,
 * so spreading the caller's value into an object would drop function and array forms.
 * The caller's styles come last and win.
 */
export function mergeSx(base: SxProps<Theme>, extra?: SxProps<Theme>): SxProps<Theme> {
	return [...(Array.isArray(base) ? base : [base]), ...(extra == null ? [] : Array.isArray(extra) ? extra : [extra])];
}
