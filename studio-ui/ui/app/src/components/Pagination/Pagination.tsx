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

import TablePagination, {
	tablePaginationClasses,
	TablePaginationClassKey,
	TablePaginationProps
} from '@mui/material/TablePagination';
import React from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { PartialSxRecord } from '../../models/CustomRecord';
import { Theme } from '@mui/material';
import { inputBaseClasses } from '@mui/material/InputBase';
import { SystemStyleObject } from '@mui/system/styleFunctionSx/styleFunctionSx';
import { UNDEFINED } from '../../utils/constants';

export type PaginationClassKey = TablePaginationClassKey;

export type PaginationPartialSx = PartialSxRecord<PaginationClassKey>;

export interface PaginationProps extends TablePaginationProps<any, {}> {
	sxs?: PaginationPartialSx;
	mode?: 'table' | 'items';
	showBottomBorder?: boolean;
}

const translations = defineMessages({
	previousPage: {
		id: 'pagination.previousPage',
		defaultMessage: 'Previous page'
	},
	nextPage: {
		id: 'pagination.nextPage',
		defaultMessage: 'Next page'
	},
	itemsPerPage: {
		id: 'pagination.itemsPerPage',
		defaultMessage: 'Items per page'
	}
});

function getStyles(sx: PaginationPartialSx, props: PaginationProps): PaginationProps['sx'] {
	sx = sx ?? {};
	const { mode = 'items', showBottomBorder = false } = props;
	return (theme) =>
		(({
            display: 'flex',
            [`.${inputBaseClasses.root}`]: { ml: 0, mr: 0 },
            borderBottom: showBottomBorder ? `1px solid ${theme.palette.divider}` : UNDEFINED,
            ...sx.root,

            [`& .${tablePaginationClasses.toolbar}`]: {
				width: '100%',
				minHeight: '40px',
				padding: `0 ${theme.spacing(1)}`,
				justifyContent: mode === 'table' ? 'right' : 'space-between',
				...sx.toolbar
			},

            [`& .${tablePaginationClasses.select}`]: {
				...sx.select
			},

            [`& .${tablePaginationClasses.selectLabel}`]: {
				position: 'absolute',
				width: '1px',
				height: '1px',
				padding: '0',
				margin: '-1px',
				overflow: 'hidden',
				clip: 'rect(0, 0, 0, 0)',
				whiteSpace: 'nowrap',
				border: '0',
				...sx.selectLabel
			},

            [`& .${tablePaginationClasses.selectRoot}`]: {
				marginRight: 0,
				...sx.selectRoot
			},

            [`& .${tablePaginationClasses.selectIcon}`]: {
				...sx.selectIcon
			},

            [`& .${tablePaginationClasses.actions}`]: {
				marginLeft: '0 !important',
				...sx.actions
			},

            [`& .${tablePaginationClasses.spacer}`]: {
				display: 'none',
				...sx.actions
			},

            [`& .${tablePaginationClasses.displayedRows}`]: {
				mt: 0,
				mr: mode === 'table' ? 1 : 0,
				mb: 0,
				ml: mode === 'table' ? 1 : 0,
				...sx.displayedRows
			},

            [`& .${tablePaginationClasses.input}`]: {
				...sx.input
			},

            [`& .${tablePaginationClasses.menuItem}`]: {
				...sx.menuItem
			}
        }) as SystemStyleObject<Theme>);
}

export function Pagination(props: PaginationProps) {
	const { formatMessage } = useIntl();
	const { sxs, mode, showBottomBorder, ...tablePaginationProps } = props;
	return (
		<TablePagination
			component="div"
			sx={getStyles(sxs, props)}
			labelRowsPerPage={formatMessage(translations.itemsPerPage)}
			{...tablePaginationProps}
			rowsPerPageOptions={props.rowsPerPageOptions ?? [5, 10, 25, 50]}
			labelDisplayedRows={({ from, to, count }) => (
				<FormattedMessage defaultMessage="{from}-{to} of {count}" values={{ from, to, count }} />
			)}
			backIconButtonProps={{
				'aria-label': formatMessage(translations.previousPage),
				title: formatMessage(translations.previousPage),
				size: 'small',
				...props.backIconButtonProps
			}}
			nextIconButtonProps={{
				'aria-label': formatMessage(translations.nextPage),
				title: formatMessage(translations.nextPage),
				size: 'small',
				...props.nextIconButtonProps
			}}
		/>
	);
}

export default Pagination;
