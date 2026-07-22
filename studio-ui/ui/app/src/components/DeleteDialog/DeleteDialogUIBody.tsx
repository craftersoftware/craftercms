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

import React from 'react';
import Grid from '@mui/material/Grid';
import TextFieldWithMax from '../TextFieldWithMax/TextFieldWithMax';
import { FormattedMessage } from 'react-intl';
import { SelectionList } from '../DependencySelection/SelectionList';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import { DeleteDialogContentUIProps } from './utils';
import Alert from '@mui/material/Alert';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import InfoIcon from '@mui/icons-material/InfoOutlined';
import TextField from '@mui/material/TextField';

export function DeleteDialogUIBody(props: DeleteDialogContentUIProps) {
	const {
		items,
		childItems,
		dependentItems,
		title,
		comment,
		selectedItems,
		isCommentRequired = false,
		isDisabled,
		isConfirmDeleteChecked,
		onInputChange,
		onItemClicked,
		onSelectAllClicked,
		onConfirmDeleteChange,
		onEditDependantClick
	} = props;
	return (
		<Grid container spacing={3}>
			<Grid size={{ xs: 12, sm: 7 }}>
				<Box
					sx={(theme) => ({
						background: theme.palette.background.paper,
						border: `1px solid ${theme.palette.divider}`
					})}
				>
					<SelectionList
						title={<FormattedMessage id="deleteDialog.deleteItems" defaultMessage="Delete Items" />}
						items={items}
						onItemClicked={onItemClicked}
						onSelectAllClicked={onSelectAllClicked}
						displayItemTitle
						selectedItems={selectedItems}
						disabled={isDisabled}
					/>
					<ListItem divider dense disableGutters={!Boolean(dependentItems)}>
						<ListItemText
							primary={
								<Typography variant="subtitle1" component="span">
									<FormattedMessage defaultMessage="Items that reference the selected item" />

									{` • `}
									<FormattedMessage id="deleteDialog.brokenItems" defaultMessage="Will have broken references" />
								</Typography>
							}
						/>
					</ListItem>
					{dependentItems.length ? (
						<List>
							{dependentItems.map(({ path }) => {
								return (
									<ListItem
										dense
										key={path}
										secondaryAction={
											<Button
												color="primary"
												onClick={(e) => onEditDependantClick(e, path)}
												size="small"
												sx={{
													marginLeft: 'auto',
													fontWeight: 'bold',
													verticalAlign: 'baseline'
												}}
											>
												<FormattedMessage id="words.edit" defaultMessage="Edit" />
											</Button>
										}
									>
										<ListItemText
											primary={path}
											primaryTypographyProps={{
												title: path,
												sx: {
													overflow: 'hidden',
													whiteSpace: 'nowrap',
													textOverflow: 'ellipsis'
												}
											}}
										/>
									</ListItem>
								);
							})}
						</List>
					) : (
						<Box
							sx={{
								display: 'flex',
								alignItems: 'center',
								padding: '8px',
								'& svg': {
									marginRight: '8px'
								}
							}}
						>
							<InfoIcon color="action" fontSize="small" />
							<Typography variant="caption">
								<FormattedMessage defaultMessage="No items that reference the selected item" />
							</Typography>
						</Box>
					)}
					<SelectionList
						title={<FormattedMessage id="deleteDialog.childItemsText" defaultMessage="Child Items" />}
						subtitle={<FormattedMessage id="deleteDialog.willGetDeleted" defaultMessage="Will get deleted" />}
						emptyMessage={<FormattedMessage id="deleteDialog.emptyChildItems" defaultMessage="No child items" />}
						paths={childItems.map(({ path }) => path)}
						displayItemTitle={false}
					/>
				</Box>
			</Grid>
			<Grid size={{ xs: 12, sm: 5 }}>
				<form noValidate autoComplete="off">
					<TextField
						label={<FormattedMessage defaultMessage="Title" />}
						autoFocus
						fullWidth
						sx={{ mb: 2 }}
						value={title}
						onChange={(e) => onInputChange(e, 'title')}
						required
					/>
					<TextFieldWithMax
						label={<FormattedMessage id="deleteDialog.submissionCommentLabel" defaultMessage="Submission Comment" />}
						multiline
						value={comment}
						onChange={(e) => onInputChange(e, 'comment')}
						required={isCommentRequired}
						disabled={isDisabled}
						sx={{ width: '100%' }}
					/>
					<Alert severity="warning" icon={false}>
						<FormControlLabel
							sx={{ margin: (theme) => `${theme.spacing()} 0` }}
							control={
								<Checkbox
									color="primary"
									checked={isConfirmDeleteChecked}
									onChange={onConfirmDeleteChange}
									disabled={isDisabled}
								/>
							}
							label={
								<FormattedMessage
									id="deleteDialog.confirmDeletion"
									defaultMessage="I understand that deleted items will be published immediately."
								/>
							}
						/>
					</Alert>
				</form>
			</Grid>
		</Grid>
	);
}

export default DeleteDialogUIBody;
