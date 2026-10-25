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

import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import GlobalAppGridRow from '../GlobalAppGridRow';
import GlobalAppGridCell from '../GlobalAppGridCell';
import Typography from '@mui/material/Typography';
import { FormattedMessage } from 'react-intl';
import TableBody from '@mui/material/TableBody';
import TableContainer from '@mui/material/TableContainer';
import React from 'react';
import Checkbox from '@mui/material/Checkbox';
import ItemDisplay from '../ItemDisplay';
import { ContentItem } from '../../models/Item';
import { PagedArray } from '../../models/PagedArray';
import Pagination from '../Pagination';
import LookupTable from '../../models/LookupTable';

export interface WorkflowStatesGridUIProps {
	itemStates: PagedArray<ContentItem>;
	selectedItems: LookupTable<ContentItem>;
	allItemsSelected: boolean;
	hasThisPageItemsChecked: boolean;
	isThisPageIndeterminate: boolean;
	onToggleSelectedItems(): void;
	onItemSelected(item: ContentItem, value: boolean): void;
	onPageChange(page: number): void;
	onRowSelected(item: ContentItem): void;
	onRowsPerPageChange?: React.ChangeEventHandler<HTMLTextAreaElement | HTMLInputElement>;
}

export function ItemStatesGridUI(props: WorkflowStatesGridUIProps) {
	const {
		itemStates,
		onPageChange,
		onRowsPerPageChange,
		selectedItems,
		onItemSelected,
		onRowSelected,
		onToggleSelectedItems,
		allItemsSelected,
		hasThisPageItemsChecked,
		isThisPageIndeterminate
	} = props;
	return (
		<>
			<TableContainer>
				<Table size="small">
					<TableHead>
						<GlobalAppGridRow className="hoverDisabled">
							<GlobalAppGridCell align="center">
								<Checkbox
									checked={allItemsSelected || hasThisPageItemsChecked}
									indeterminate={hasThisPageItemsChecked ? isThisPageIndeterminate : false}
									onClick={(e) => onToggleSelectedItems()}
								/>
							</GlobalAppGridCell>
							<GlobalAppGridCell className="width60 pl0">
								<Typography variant="subtitle2">
									<FormattedMessage id="words.item" defaultMessage="Item" />
								</Typography>
							</GlobalAppGridCell>
							<GlobalAppGridCell className="width20">
								<Typography variant="subtitle2">
									<FormattedMessage id="words.processing" defaultMessage="Processing" />
								</Typography>
							</GlobalAppGridCell>
							<GlobalAppGridCell className="width40">
								<Typography variant="subtitle2">
									<FormattedMessage id="words.locked" defaultMessage="Locked" />
								</Typography>
							</GlobalAppGridCell>
							<GlobalAppGridCell className="width20">
								<Typography variant="subtitle2">
									<FormattedMessage id="words.live" defaultMessage="Live" />
								</Typography>
							</GlobalAppGridCell>
							<GlobalAppGridCell className="width20">
								<Typography variant="subtitle2">
									<FormattedMessage id="words.staged" defaultMessage="Staged" />
								</Typography>
							</GlobalAppGridCell>
						</GlobalAppGridRow>
					</TableHead>
					<TableBody>
						{itemStates.map((item) => (
							<GlobalAppGridRow
								key={item.id}
								tabIndex={0}
								onClick={() => onRowSelected(item)}
								onKeyDown={(event) => {
									if (event.target !== event.currentTarget) {
										return;
									}
									if (event.key === 'Enter' || event.key === ' ') {
										event.preventDefault();
										onRowSelected(item);
									}
								}}
								sx={{
									backgroundColor:
										Boolean(selectedItems[item.path]) || allItemsSelected ? 'action.selected' : 'inherit',
									'&:focus-visible': {
										outline: (theme) => `2px solid ${theme.palette.primary.main}`,
										outlineOffset: '-2px'
									}
								}}
							>
								<GlobalAppGridCell align="center">
									<Checkbox
										checked={allItemsSelected || Boolean(selectedItems[item.path])}
										onClick={(e) => {
											e.stopPropagation();
										}}
										onChange={(e) => {
											onItemSelected(item, e.target.checked);
										}}
									/>
								</GlobalAppGridCell>
								<GlobalAppGridCell className="ellipsis maxWidth300 pl0">
									<ItemDisplay item={item} />
									<Typography
										title={item.path}
										variant="caption"
										component="p"
										sx={{
											color: (theme) => theme.palette.text.secondary,
											overflow: 'hidden',
											textOverflow: 'ellipsis',
											whiteSpace: 'nowrap'
										}}
									>
										{item.path}
									</Typography>
								</GlobalAppGridCell>
								<GlobalAppGridCell>
									<Typography variant="body2">
										{item.stateMap.systemProcessing ? (
											<FormattedMessage id="words.yes" defaultMessage="Yes" />
										) : (
											<FormattedMessage id="words.no" defaultMessage="No" />
										)}
									</Typography>
								</GlobalAppGridCell>
								<GlobalAppGridCell>
									<Typography
										variant="body2"
										sx={{
											overflow: 'hidden',
											textOverflow: 'ellipsis',
											whiteSpace: 'nowrap'
										}}
										title={item.lockOwner?.username}
									>
										{item.stateMap.locked ? (
											<FormattedMessage
												id="itemStates.lockedBy"
												defaultMessage="By {owner}"
												values={{
													owner: item.lockOwner?.username
												}}
											/>
										) : (
											<FormattedMessage id="words.no" defaultMessage="No" />
										)}
									</Typography>
								</GlobalAppGridCell>
								<GlobalAppGridCell>
									<Typography variant="body2">
										{item.stateMap.live ? (
											<FormattedMessage id="words.yes" defaultMessage="Yes" />
										) : (
											<FormattedMessage id="words.no" defaultMessage="No" />
										)}
									</Typography>
								</GlobalAppGridCell>
								<GlobalAppGridCell>
									<Typography variant="body2">
										{item.stateMap.staged ? (
											<FormattedMessage id="words.yes" defaultMessage="Yes" />
										) : (
											<FormattedMessage id="words.no" defaultMessage="No" />
										)}
									</Typography>
								</GlobalAppGridCell>
							</GlobalAppGridRow>
						))}
					</TableBody>
				</Table>
			</TableContainer>
			<Pagination
				mode="table"
				count={itemStates.total}
				rowsPerPage={itemStates.limit}
				page={itemStates && Math.ceil(itemStates.offset / itemStates.limit)}
				onPageChange={(e, page: number) => onPageChange(page)}
				onRowsPerPageChange={onRowsPerPageChange}
			/>
		</>
	);
}

export default ItemStatesGridUI;
