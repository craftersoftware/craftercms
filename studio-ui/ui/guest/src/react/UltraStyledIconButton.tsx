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

import { IconButton, styled } from '@mui/material';
import { svgIconClasses } from '@mui/material/SvgIcon';

// Since this button runs guest-side, there may be all sorts of styles that affect button styles.
// The idea of this component is to be as specific as possible to avoid guest site styles to break ours.

export const UltraStyledIconButton = styled(IconButton)(({ theme }) => ({
	boxShadow: 'none !important',
	border: 'none !important',
	color: 'inherit !important',
	height: 'inherit !important',
	width: 'inherit !important',
	[`& .${svgIconClasses.root}`]: {
		fontSize: 21
	},
	'&:focus-visible': {
		outline: `2px solid ${theme.palette.primary.main} !important`,
		outlineOffset: '2px !important'
	}
}));

export default UltraStyledIconButton;
