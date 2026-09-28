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
import React, { useMemo } from 'react';
import { DataGrid, GridCellParams, gridClasses, GridColDef } from '@mui/x-data-grid';
import { useIntl } from 'react-intl';
import { AuditOptions } from '../../services/audit';
// @ts-ignore
import { fieldIdMapping, translations } from './AuditGridUI';
import { rand } from '../PathNavigator/utils';
import Skeleton from '@mui/material/Skeleton';

export interface AuditGridSkeletonProps {
	numOfItems?: number;
	filters: AuditOptions;
	siteMode?: boolean;
}

export function AuditGridSkeleton(props: AuditGridSkeletonProps) {
	const { numOfItems = 5, filters, siteMode = false } = props;
	const { formatMessage } = useIntl();

	const rows = useMemo(() => {
		return new Array(numOfItems).fill(null).map((value, index) => ({
			id: index,
			operationTimestamp: `${rand(90, 100)}%`,
			siteName: `${rand(60, 80)}%`,
			actorId: `${rand(60, 80)}%`,
			operation: `${rand(40, 70)}%`,
			primaryTargetValue: `${rand(80, 100)}%`,
			primaryTargetType: `${rand(60, 80)}%`,
			actorDetails: `${rand(60, 80)}%`,
			origin: `${rand(40, 60)}%`,
			parameters: null
		}));
	}, [numOfItems]);

	const columns: GridColDef[] = useMemo(
		() => [
			{
				field: 'operationTimestamp',
				headerName: formatMessage(translations.timestamp),
				width: 200,
				sortable: false,
				filterable: false,
				renderCell: (params: GridCellParams) => {
					return <Skeleton height={20} variant="text" width={params.value.toString()} />;
				}
			},
			{
				field: 'siteName',
				headerName: formatMessage(translations.siteName),
				width: 150,
				sortable: false,
				filterable: false,
				hide: siteMode,
				renderCell: (params: GridCellParams) => {
					return <Skeleton height={20} variant="text" width={params.value.toString()} />;
				}
			},
			{
				field: 'actorId',
				headerName: formatMessage(translations.username),
				width: 150,
				sortable: false,
				filterable: false,
				renderCell: (params: GridCellParams) => {
					return <Skeleton height={20} variant="text" width={params.value.toString()} />;
				}
			},
			{
				field: 'operation',
				headerName: formatMessage(translations.operation),
				width: 150,
				sortable: false,
				filterable: false,
				renderCell: (params: GridCellParams) => {
					return <Skeleton height={20} variant="text" width={params.value.toString()} />;
				}
			},
			{
				field: 'primaryTargetValue',
				headerName: formatMessage(translations.targetValue),
				width: 300,
				sortable: false,
				filterable: false,
				renderCell: (params: GridCellParams) => {
					return <Skeleton height={20} variant="text" width={params.value.toString()} />;
				}
			},
			{
				field: 'primaryTargetType',
				headerName: formatMessage(translations.targetType),
				width: 150,
				sortable: false,
				filterable: false,
				renderCell: (params: GridCellParams) => {
					return <Skeleton height={20} variant="text" width={params.value.toString()} />;
				}
			},
			{
				field: 'actorDetails',
				headerName: formatMessage(translations.name),
				width: 100,
				sortable: false,
				filterable: false,
				renderCell: (params: GridCellParams) => {
					return <Skeleton height={20} variant="text" width={params.value.toString()} />;
				}
			},
			{
				field: 'origin',
				headerName: formatMessage(translations.origin),
				width: 100,
				sortable: false,
				filterable: false,
				renderCell: (params: GridCellParams) => {
					return <Skeleton height={20} variant="text" width={params.value.toString()} />;
				}
			},
			{
				field: 'parameters',
				headerName: formatMessage(translations.parameters),
				width: 105,
				sortable: false,
				filterable: false,
				renderCell: () => {
					return <Skeleton variant="circular" width={40} height={40} />;
				}
			}
		],
		[formatMessage, siteMode]
	);

	return (
		<Box sx={{ display: 'flex' }}>
			<DataGrid
				autoHeight
				disableColumnFilter
				slots={{
					columnMenuIcon: () => <Skeleton variant="circular" width={20} height={20} />
				}}
				onCellClick={() => {}}
				sx={{
					border: '0 !important',
					minHeight: '400px',
					[`& .${gridClasses.cell}`]: {
						display: 'flex',
						alignItems: 'center',
						'&:focus-within': {
							outline: 'none !important'
						}
					}
				}}
				disableRowSelectionOnClick
				disableColumnSelector
				hideFooterPagination={true}
				rows={rows}
				columns={columns}
				paginationModel={{ page: 0, pageSize: numOfItems }}
			/>
		</Box>
	);
}

export default AuditGridSkeleton;
