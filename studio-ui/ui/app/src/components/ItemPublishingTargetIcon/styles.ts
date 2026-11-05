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

import { Theme } from '@mui/material/styles';
import palette from '../../styles/palette';

// The light-mode mains are 4.5:1 on white but not on a dark dialog (#393939), so dark mode uses the tints.
export const LIVE_COLOUR = (theme: Theme) => (theme.palette.mode === 'dark' ? palette.green.tint : palette.green.main);
export const STAGING_COLOUR = (theme: Theme) => (theme.palette.mode === 'dark' ? palette.blue.tint : palette.blue.main);
