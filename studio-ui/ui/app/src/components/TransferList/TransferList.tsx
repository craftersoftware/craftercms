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

import Box from '@mui/material/Box';
import React, { ReactNode } from 'react';
import IconButton from '@mui/material/IconButton';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import TransferListColumn, { TransferListColumnProps, TransferListItem } from '../TransferListColumn';
import { FormattedMessage, useIntl } from 'react-intl';
import Tooltip from '@mui/material/Tooltip';

export interface TransferListProps {
	source: TransferListColumnProps;
	target: TransferListColumnProps;
	inProgressIds: (string | number)[];
	disabled?: boolean;
	disableAdd: boolean;
	disableRemove: boolean;
	addToTarget(): void;
	removeFromTarget(): void;
}

export interface TransferListObject {
	title?: ReactNode;
	emptyMessage?: ReactNode;
	items: TransferListItem[];
}

export function TransferList(props: TransferListProps) {
	const {
		source,
		target,
		inProgressIds,
		disableAdd,
		disableRemove,
		addToTarget,
		removeFromTarget,
		disabled = false
	} = props;
	const { formatMessage } = useIntl();

	return (
		<Box
			sx={{
				display: 'flex'
			}}
		>
			<TransferListColumn
				title={source.title}
				items={source.items}
				disabledItems={source.disabledItems}
				checkedList={source.checkedList}
				onCheckAllClicked={source.onCheckAllClicked}
				onItemClick={source.onItemClick}
				isAllChecked={source.isAllChecked}
				inProgressIds={inProgressIds}
				emptyStateMessage={source.emptyStateMessage}
				disabled={disabled}
				filterKeyword={source.filterKeyword}
				setFilterKeyword={source.setFilterKeyword}
				onFilter={source.onFilter}
				onFetchMore={source.onFetchMore}
				hasMoreItems={source.hasMoreItems}
			/>
			<Box
				component="section"
				sx={{
					display: 'flex',
					minWidth: 50,
					flexDirection: 'column',
					justifyContent: 'center',
					margin: '40px 20px',
					'& button:first-child': {
						marginBottom: '20px'
					}
				}}
			>
				{!disabled && (
					<>
						<Tooltip
							title={
								disableAdd ? (
									<FormattedMessage
										id="transferList.addDisabledTooltip"
										defaultMessage="Select items to add from the left"
									/>
								) : (
									<FormattedMessage id="transferList.addToTarget" defaultMessage="Add selected" />
								)
							}
						>
							<span>
								<IconButton
									onClick={addToTarget}
									disabled={disableAdd}
									size="large"
									aria-label={formatMessage({ defaultMessage: 'Add to target' })}
								>
									<NavigateNextIcon />
								</IconButton>
							</span>
						</Tooltip>
						<Tooltip
							title={
								disableRemove ? (
									<FormattedMessage
										id="transferList.removeDisabledTooltip"
										defaultMessage="Select items to remove from the right"
									/>
								) : (
									<FormattedMessage id="transferList.removeFromTarget" defaultMessage="Remove selected" />
								)
							}
						>
							<span>
								<IconButton
									onClick={removeFromTarget}
									disabled={disableRemove}
									size="large"
									aria-label={formatMessage({ defaultMessage: 'Remove from target' })}
								>
									<NavigateBeforeIcon />
								</IconButton>
							</span>
						</Tooltip>
					</>
				)}
			</Box>
			<TransferListColumn
				title={target.title}
				items={target.items}
				disabledItems={target.disabledItems}
				checkedList={target.checkedList}
				onCheckAllClicked={target.onCheckAllClicked}
				onItemClick={target.onItemClick}
				isAllChecked={target.isAllChecked}
				inProgressIds={inProgressIds}
				emptyStateMessage={target.emptyStateMessage}
				disabled={disabled}
				filterKeyword={target.filterKeyword}
				setFilterKeyword={target.setFilterKeyword}
				onFilter={target.onFilter}
				onFetchMore={target.onFetchMore}
				hasMoreItems={target.hasMoreItems}
			/>
		</Box>
	);
}

export default TransferList;
