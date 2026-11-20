/*
 * Copyright (C) 2007-2024 Crafter Software Corporation. All Rights Reserved.
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

import React, { type DetailedHTMLProps, type HTMLAttributes, useState } from 'react';
import { LightItem } from '../../models';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ItemDisplay from '../ItemDisplay';
import Tooltip from '@mui/material/Tooltip';
import { FormattedMessage, useIntl } from 'react-intl';
import IconButton from '@mui/material/IconButton';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import { useInfiniteLoader } from 'react-window-infinite-loader';
import { List, type RowComponentProps } from 'react-window';
import Box from '@mui/material/Box';

export interface PackageItemsListProps {
	items: LightItem[];
	totalItems: number;
	fetchLimit: number;
	loadNextPage: (startIndex: number, stopIndex: number) => Promise<void>;
	onOpenMenu(e: React.MouseEvent<HTMLButtonElement>, item: LightItem): void;
}

export function PackageItemsList(props: PackageItemsListProps) {
	const { items, totalItems, fetchLimit = 10, loadNextPage, onOpenMenu } = props;
	const rowCount = items.length + (items.length < totalItems ? fetchLimit : 0);
	const [over, setOver] = useState(null);
	const { formatMessage } = useIntl();

	// Every row is loaded except for our loading indicator row.
	const isItemLoaded = (index) => {
		return items[index] !== undefined;
	};

	const onRowsRendered = useInfiniteLoader({
		isRowLoaded: isItemLoaded,
		rowCount,
		loadMoreRows: loadNextPage
	});

	return (
		<Box sx={{ flex: 1, minHeight: 0 }}>
			<List
				className="List"
				rowCount={rowCount}
				rowHeight={59}
				onRowsRendered={onRowsRendered}
				rowProps={{ rows: items }}
				rowComponent={({ index, style }: RowComponentProps) => {
					let content;
					if (!isItemLoaded(index)) {
						content = <FormattedMessage defaultMessage="Loading..." />;
					} else {
						const item = items[index];
						content = (
							<ListItemButton
								onMouseOver={() => setOver(item.path)}
								onMouseOut={() => setOver(null)}
								sx={{
									cursor: 'default',
									justifyContent: 'space-between',
									py: 0
								}}
							>
								<ListItemText
									primary={
										<ItemDisplay
											item={item}
											titleDisplayProp="path"
											showWorkflowState={false}
											showPublishingTarget={false}
											showNavigableAsLinks={false}
										/>
									}
									secondary={item.path}
								/>

								{over === item.path && (
									<Tooltip title={formatMessage({ defaultMessage: 'Options' })}>
										<IconButton
											size="small"
											onClick={(e) => {
												onOpenMenu(e, item);
											}}
											sx={{ padding: 0 }}
											aria-label={formatMessage({ defaultMessage: 'Options' })}
										>
											<MoreVertRoundedIcon />
										</IconButton>
									</Tooltip>
								)}
							</ListItemButton>
						);
					}
					return (
						<div style={style as DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>}>{content}</div>
					);
				}}
			/>
		</Box>
	);
}

export default PackageItemsList;
