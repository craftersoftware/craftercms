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

import React, { type DetailedHTMLProps, type HTMLAttributes, ReactNode, useRef } from 'react';
import LookupTable from '../../models/LookupTable';
import Paper from '@mui/material/Paper';
import Checkbox from '@mui/material/Checkbox';
import Typography from '@mui/material/Typography';
import SearchBar from '../SearchBar/SearchBar';
import List from '@mui/material/List';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import CircularProgress from '@mui/material/CircularProgress';
import EmptyState from '../EmptyState/EmptyState';
import { FormattedMessage } from 'react-intl';
import TransferListItem from './TransferListItem';
import ListItemButton from '@mui/material/ListItemButton';
import { PaginationOptions } from '../../models';
import Box from '@mui/material/Box';
import { useInfiniteLoader } from 'react-window-infinite-loader';
import { List as FixedSizeList, type RowComponentProps } from 'react-window';

export interface TransferListColumnProps {
	title: ReactNode;
	emptyStateMessage?: ReactNode;
	items: TransferListItem[];
	onItemClick(item: TransferListItem, e: React.MouseEvent<HTMLDivElement, MouseEvent>): void;
	checkedList: LookupTable<boolean>;
	inProgressIds: (string | number)[];
	isAllChecked?: boolean;
	onCheckAllClicked?(items: TransferListItem[], checked: boolean): void;
	disabled?: boolean;
	disabledItems?: LookupTable<boolean>;
	filterKeyword: string;
	setFilterKeyword(keyword: string): void;
	onFilter?(keyword: string);
	onFetchMore?(options?: Partial<PaginationOptions & { keyword?: string }>): Promise<void>;
	hasMoreItems?: boolean;
}

export function TransferListColumn(props: TransferListColumnProps) {
	const {
		title,
		items,
		onItemClick,
		checkedList,
		isAllChecked,
		onCheckAllClicked,
		inProgressIds,
		emptyStateMessage,
		disabled = false,
		disabledItems,
		filterKeyword: keyword,
		setFilterKeyword: setKeyword,
		onFilter,
		onFetchMore,
		hasMoreItems
	} = props;
	const listRef = useRef(undefined);

	// If there are more items to be loaded then add an extra row to hold a loading indicator.
	const currentItemsCount = items ? (hasMoreItems ? items.length + 1 : items.length) : 0;
	// Every row is loaded except for our loading indicator row.
	const isItemLoaded = (index) => !hasMoreItems || index < items?.length;

	const onSearch = (value) => {
		onFilter?.(value);
		setKeyword(value);
	};

	const onRowsRendered = useInfiniteLoader({
		isRowLoaded: isItemLoaded,
		rowCount: currentItemsCount,
		loadMoreRows: () => onFetchMore()
	});

	return (
		<Paper sx={{ flexBasis: '50%', overflow: 'hidden' }}>
			<Box
				component="header"
				sx={{
					display: 'flex',
					padding: '15px 16px',
					alignItems: 'center',
					borderBottom: (theme) => `1px solid ${theme.palette.divider}`
				}}
			>
				{!disabled && onCheckAllClicked && (
					<Checkbox
						disabled={items?.length === 0}
						checked={isAllChecked}
						onChange={(event) => onCheckAllClicked(items, event.target.checked)}
					/>
				)}
				{title && <Typography color="textSecondary">{title}</Typography>}
				<SearchBar
					keyword={keyword}
					onChange={onSearch}
					sxs={{
						root: {
							width: '100%',
							marginLeft: '20px'
						}
					}}
					showActionButton={Boolean(keyword)}
				/>
			</Box>
			<List dense component="div" role="list" sx={{ height: '310px', overflow: 'auto' }} ref={listRef}>
				{items ? (
					items.length === 0 ? (
						<EmptyState
							title={
								<FormattedMessage
									id="transferListColumn.noResults"
									defaultMessage="No results, try to change the query"
								/>
							}
						/>
					) : (
						<FixedSizeList
							className="List"
							rowCount={currentItemsCount}
							rowHeight={60.03}
							onRowsRendered={onRowsRendered}
							rowProps={{}}
							rowComponent={({ index, style }: RowComponentProps) => {
								let content;
								if (!isItemLoaded(index)) {
									content = (
										<Box
											key={0}
											sx={{
												display: 'flex',
												justifyContent: 'center',
												m: 1
											}}
										>
											<CircularProgress size={16} />
										</Box>
									);
								} else {
									const item = items[index];
									content = (
										<ListItemButton
											disabled={disabled || inProgressIds.includes(item.id) || disabledItems?.[item.id]}
											key={item.id}
											role="listitem"
											onClick={(e) => onItemClick(item, e)}
										>
											{!disabled && (
												<ListItemIcon>
													{inProgressIds.includes(item.id) ? (
														<CircularProgress size={42} />
													) : (
														<Checkbox
															checked={(checkedList[item.id] && !disabledItems?.[item.id]) ?? false}
															tabIndex={-1}
															disableRipple
														/>
													)}
												</ListItemIcon>
											)}
											<ListItemText
												primary={item.title}
												secondary={item.subtitle}
												slotProps={{
													primary: { noWrap: true, title: item.title }
												}}
											/>
										</ListItemButton>
									);
								}
								return (
									<div style={style as DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>}>
										{content}
									</div>
								);
							}}
						/>
					)
				) : (
					emptyStateMessage && <EmptyState title={emptyStateMessage} />
				)}
			</List>
		</Paper>
	);
}

export default TransferListColumn;
