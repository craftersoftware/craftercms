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

import { styled } from '@mui/material/styles';
import ButtonBase from '@mui/material/ButtonBase';
import TableRow from '@mui/material/TableRow';

const GlobalAppGridRow = styled(TableRow)(({ theme }) => ({
	cursor: 'pointer',
	'&:hover': {
		backgroundColor: theme.palette.action.hover
	},
	'&.hoverDisabled': {
		cursor: 'inherit',
		background: 'none'
	}
}));

/**
 * The keyboard and screen reader control for a clickable row. Place it in the name cell. Its click
 * bubbles to the row's `onClick`, so it needs no handler of its own.
 */
export const GlobalAppGridRowAction = styled(ButtonBase)(({ theme }) => ({
	display: 'block',
	width: '100%',
	font: 'inherit',
	textAlign: 'inherit',
	'&:focus-visible': {
		outline: `2px solid ${theme.palette.primary.main}`,
		outlineOffset: '-2px'
	}
}));

export default GlobalAppGridRow;
