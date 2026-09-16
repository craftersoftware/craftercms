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

import { useIntl } from 'react-intl';
import TablePagination, { tablePaginationClasses } from '@mui/material/TablePagination';
import translations from './translations';
import React from 'react';
import { PaginationProps } from './utils';

// TODO: Check if we can use the components/Pagination component

export function HistoryDialogPagination(props: PaginationProps) {
	const { formatMessage } = useIntl();
	const { count, page, rowsPerPage, onRowsPerPageChange } = props;
	return (
		<TablePagination
			sx={(theme) => ({
				marginLeft: 'auto',
				background: theme.palette.background.paper,
				color: theme.palette.text.primary,
				'& p': {
					padding: 0
				},
				'& svg': {
					top: 'inherit'
				},
				'& .hidden': {
					display: 'none'
				},
				[`& .${tablePaginationClasses.toolbar}`]: {
					padding: 0,
					display: 'flex',
					justifyContent: 'space-between',
					paddingLeft: '20px',
					[`& .${tablePaginationClasses.spacer}`]: {
						display: 'none'
					},
					[`& .${tablePaginationClasses.spacer} + p`]: {
						display: 'none'
					}
				}
			})}
			component="div"
			labelRowsPerPage=""
			rowsPerPageOptions={[10, 20, 30]}
			count={count}
			rowsPerPage={rowsPerPage}
			page={page}
			slotProps={{
				actions: {
					previousButton: {
						'aria-label': formatMessage(translations.previousPage),
						title: formatMessage(translations.previousPage)
					},
					nextButton: {
						'aria-label': formatMessage(translations.nextPage),
						title: formatMessage(translations.nextPage)
					}
				}
			}}
			onPageChange={(e: React.MouseEvent<HTMLButtonElement>, nextPage: number) => {
				props.onPageChanged(nextPage);
			}}
			onRowsPerPageChange={(e) => {
				onRowsPerPageChange(parseInt(e.target.value), e);
			}}
		/>
	);
}

export default HistoryDialogPagination;
