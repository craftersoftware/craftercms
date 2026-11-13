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

/**
 * Inset, in theme spacing units (16px by default), that Project Tools keeps around its header, empty state and footer.
 * The drawer itself has no padding; the tool list runs to the drawer edges.
 */
export const sidebarDrawerPadding = 2;

/** Space below the Project Tools sidebar header, in px. */
export const sidebarHeaderMarginBottom = 10;

/** Footer padding: 20px of its own on top, plus the sidebar inset on the sides and bottom. */
export const sidebarFooterPadding = (theme: Theme) =>
	theme.spacing(2.5, sidebarDrawerPadding, 2.5 + sidebarDrawerPadding);

/** Where the first row of the Project Tools sidebar starts: header top inset plus header margin. */
export const sidebarFirstRowInset = (theme: Theme) =>
	`calc(${theme.spacing(sidebarDrawerPadding)} + ${sidebarHeaderMarginBottom}px)`;
