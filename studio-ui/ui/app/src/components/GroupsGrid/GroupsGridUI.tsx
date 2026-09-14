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

import TableContainer from '@mui/material/TableContainer';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import { FormattedMessage } from 'react-intl';
import TableBody from '@mui/material/TableBody';
import React from 'react';
import { PagedArray } from '../../models/PagedArray';
import Pagination from '../Pagination';
import Group from '../../models/Group';
import GlobalAppGridRow from '../GlobalAppGridRow';
import GlobalAppGridCell from '../GlobalAppGridCell';
import Box from '@mui/material/Box';
import { EmptyState } from '../EmptyState';

export interface GroupsGridUIProps {
	groups: PagedArray<Group>;
	onRowClicked(user: Group): void;
	onPageChange(page: number): void;
	onRowsPerPageChange?: React.ChangeEventHandler<HTMLTextAreaElement | HTMLInputElement>;
}

export function GroupsGridUI(props: GroupsGridUIProps) {
	const { groups, onRowClicked, onPageChange, onRowsPerPageChange } = props;

	return (
		<Box display="flex" flexDirection="column">
			<TableContainer>
				<Table sx={{ tableLayout: 'fixed' }}>
					<TableHead>
						<GlobalAppGridRow className="hoverDisabled">
							<GlobalAppGridCell align="left" className="width25">
								<Typography variant="subtitle2">
									<FormattedMessage id="words.name" defaultMessage="Name" />
								</Typography>
							</GlobalAppGridCell>
							<GlobalAppGridCell align="left">
								<Typography variant="subtitle2">
									<FormattedMessage id="words.description" defaultMessage="Description" />
								</Typography>
							</GlobalAppGridCell>
						</GlobalAppGridRow>
					</TableHead>
					<TableBody>
						{groups?.length ? (
							groups.map((group, i) => (
								<GlobalAppGridRow key={group.id} onClick={() => onRowClicked(group)}>
									<GlobalAppGridCell align="left" className="width25">
										<Typography variant="body2" noWrap title={group.name}>
											{group.name}
										</Typography>
									</GlobalAppGridCell>
									<GlobalAppGridCell align="left">
										<Typography variant="body2" sx={{ wordWrap: 'break-word' }}>
											{group.desc}
										</Typography>
									</GlobalAppGridCell>
								</GlobalAppGridRow>
							))
						) : (
							<GlobalAppGridRow className="hoverDisabled">
								<GlobalAppGridCell colSpan={2} align="center">
									<EmptyState
										title={<FormattedMessage id="groupsGrid.emptyStateMessage" defaultMessage="No Groups Found" />}
									/>
								</GlobalAppGridCell>
							</GlobalAppGridRow>
						)}
					</TableBody>
				</Table>
			</TableContainer>
			<Pagination
				mode="table"
				count={groups.total}
				rowsPerPage={groups.limit}
				page={groups && Math.ceil(groups.offset / groups.limit)}
				onPageChange={(e, page: number) => onPageChange(page)}
				onRowsPerPageChange={onRowsPerPageChange}
			/>
		</Box>
	);
}

export default GroupsGridUI;
