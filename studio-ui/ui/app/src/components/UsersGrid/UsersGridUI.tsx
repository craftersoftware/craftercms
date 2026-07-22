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
import Avatar from '@mui/material/Avatar';
import User from '../../models/User';
import { PagedArray } from '../../models/PagedArray';
import Pagination from '../Pagination';
import GlobalAppGridRow from '../GlobalAppGridRow';
import GlobalAppGridCell from '../GlobalAppGridCell';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';

export interface UsersGridUIProps {
	users: PagedArray<User>;
	onRowClicked(user: User): void;
	onPageChange(page: number): void;
	onRowsPerPageChange?: React.ChangeEventHandler<HTMLTextAreaElement | HTMLInputElement>;
	showDisabled: boolean;
	onShowDisabledChange(checked: boolean): void;
}

export function UsersGridUI(props: UsersGridUIProps) {
	const { users, onRowClicked, onPageChange, onRowsPerPageChange, showDisabled, onShowDisabledChange } = props;
	return (
		<Box display="flex" flexDirection="column">
			<TableContainer>
				<Table sx={{ tableLayout: 'fixed' }}>
					<TableHead>
						<GlobalAppGridRow className="hoverDisabled">
							<GlobalAppGridCell align="center" className="avatar">
								<span />
							</GlobalAppGridCell>
							<GlobalAppGridCell align="left" className="pl20 width20">
								<Typography variant="subtitle2">
									<FormattedMessage id="words.name" defaultMessage="Name" />
								</Typography>
							</GlobalAppGridCell>
							<GlobalAppGridCell align="left" className="width20">
								<Typography variant="subtitle2">
									<FormattedMessage id="words.username" defaultMessage="Username" />
								</Typography>
							</GlobalAppGridCell>
							<GlobalAppGridCell align="left" className="width40">
								<Typography variant="subtitle2">
									<FormattedMessage id="words.email" defaultMessage="E-mail" />
								</Typography>
							</GlobalAppGridCell>
							<GlobalAppGridCell align="right" className="width20">
								<FormControlLabel
									control={
										<Checkbox
											size="small"
											checked={showDisabled}
											onChange={(e) => onShowDisabledChange(e.target.checked)}
										/>
									}
									label={
										<Typography variant="subtitle2">
											<FormattedMessage defaultMessage="Show disabled users" />
										</Typography>
									}
									labelPlacement="start"
								/>
							</GlobalAppGridCell>
						</GlobalAppGridRow>
					</TableHead>
					<TableBody>
						{users?.map((user) => (
							<GlobalAppGridRow key={user.id} onClick={() => onRowClicked(user)}>
								<GlobalAppGridCell align="center" className="avatar">
									<Avatar sx={{ margin: '0 auto' }}>
										{user.firstName.charAt(0)}
										{user.lastName?.charAt(0) ?? ''}
									</Avatar>
								</GlobalAppGridCell>
								<GlobalAppGridCell align="left" className="pl20 width20">
									{user.firstName} {user.lastName}
								</GlobalAppGridCell>
								<GlobalAppGridCell align="left" className="width20">
									<Typography variant="body2" noWrap title={user.username}>
										{user.username}
									</Typography>
								</GlobalAppGridCell>
								<GlobalAppGridCell align="left" className="width40">
									{user.email}
								</GlobalAppGridCell>
								<GlobalAppGridCell align="right" className="width20">
									{!user.enabled && <Chip label={<FormattedMessage defaultMessage="Disabled" />} size="small" />}
								</GlobalAppGridCell>
							</GlobalAppGridRow>
						))}
					</TableBody>
				</Table>
			</TableContainer>
			<Pagination
				mode="table"
				count={users.total}
				rowsPerPage={users.limit}
				page={users && Math.ceil(users.offset / users.limit)}
				onPageChange={(e, page: number) => onPageChange(page)}
				onRowsPerPageChange={onRowsPerPageChange}
			/>
		</Box>
	);
}

export default UsersGridUI;
