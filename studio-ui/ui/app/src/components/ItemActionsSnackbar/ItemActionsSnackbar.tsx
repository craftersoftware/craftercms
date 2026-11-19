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

import React, { ReactNode } from 'react';
import { ListItem, ListItemText, Snackbar } from '@mui/material';
import palette from '../../styles/palette';
import { defineMessages, useIntl } from 'react-intl';
import List from '@mui/material/List';
import Skeleton from '@mui/material/Skeleton';
import { rand } from '../PathNavigator/utils';
import Button from '@mui/material/Button';
import { ContextMenuOption } from '../ContextMenu';
import { useTheme } from '@mui/material/styles';

export interface ItemActionsSnackbarProps {
	open: boolean;
	options: Array<ContextMenuOption>;
	onActionClicked(id: string, event: React.MouseEvent<Element, MouseEvent>): void;
	append?: ReactNode;
	prepend?: ReactNode;
}

const messages = defineMessages({
	acceptSelection: {
		id: 'search.acceptSelection',
		defaultMessage: 'Accept Selection'
	},
	noOptionsAvailable: {
		id: 'siteSearch.noOptionsAvailable',
		defaultMessage: 'No options available'
	}
});

// The action row is a real list. The item itself adds no marker, padding or width, so the buttons stay in a row.
const actionItemStyle: React.CSSProperties = {
	display: 'flex',
	margin: 0,
	padding: 0,
	listStyle: 'none',
	width: 'auto'
};

function ItemActionsSnackbar(props: ItemActionsSnackbarProps) {
	const { open, options, onActionClicked, append, prepend } = props;
	const { formatMessage } = useIntl();
	const theme = useTheme();
	const isDarkMode = theme.palette.mode === 'dark';
	return (
		<Snackbar
			anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
			open={open}
			sx={{
				zIndex: theme.zIndex.modal,
				'& .MuiSnackbarContent-root': {
					backgroundColor: palette.blue.highlightHex,
					color: palette.black,
					borderRadius: '6px',
					padding: '0 10px',
					minWidth: 'unset'
				},
				'& .MuiSnackbarContent-message': {
					display: 'flex',
					padding: 0
				}
			}}
			message={
				<>
					{prepend}
					<List
						sx={{
							display: 'flex',
							flexDirection: 'row',
							padding: 0
						}}
					>
						{options ? (
							options.length ? (
								options.map((option) => (
									<li key={option.id} style={actionItemStyle}>
										<Button size="small" variant="text" color="primary" onClick={(e) => onActionClicked(option.id, e)}>
											<ListItemText primary={option.label} />
										</Button>
									</li>
								))
							) : (
								<ListItem>
									<ListItemText primary={formatMessage(messages.noOptionsAvailable)} />
								</ListItem>
							)
						) : (
							new Array(5).fill(null).map((_, index) => (
								<ListItem
									key={index}
									disableGutters
									sx={{
										width: 'fit-content',
										padding: '0 10px'
									}}
								>
									<ListItemText
										primary={
											<Skeleton
												animation="pulse"
												height="10px"
												width={`${rand(60, 80)}px`}
												sx={{ backgroundColor: isDarkMode && palette.gray.light5 }}
											/>
										}
									/>
								</ListItem>
							))
						)}
						{append != null && append !== '' && typeof append !== 'boolean' && (
							<li style={actionItemStyle}>{append}</li>
						)}
					</List>
				</>
			}
		/>
	);
}

export default ItemActionsSnackbar;
