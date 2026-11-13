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

import type { Theme } from '@mui/material/styles';

/** Drawer padding of the Project Tools sidebar, in theme spacing units (16px by default). */
export const sidebarDrawerPadding = 2;

/** Space below the Project Tools sidebar header, in px. */
export const sidebarHeaderMarginBottom = 10;

/** Where the first row of the Project Tools sidebar starts: drawer padding plus header margin. */
export const sidebarFirstRowInset = (theme: Theme) =>
	`calc(${theme.spacing(sidebarDrawerPadding)} + ${sidebarHeaderMarginBottom}px)`;
