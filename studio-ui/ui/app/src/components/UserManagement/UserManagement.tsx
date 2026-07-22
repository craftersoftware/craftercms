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

import { FormattedMessage } from 'react-intl';
import AddIcon from '@mui/icons-material/Add';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import UsersGridUI, { UsersGridSkeletonTable } from '../UsersGrid';
import CreateUserDialog from '../CreateUserDialog';
import EditUserDialog from '../EditUserDialog';
import { fetchAll } from '../../services/users';
import { PagedArray } from '../../models/PagedArray';
import User from '../../models/User';
import { ApiResponse } from '../../models/ApiResponse';
import GlobalAppToolbar from '../GlobalAppToolbar';
import Button from '@mui/material/Button';
import SearchBar from '../SearchBar/SearchBar';
import { useDebouncedInput } from '../../hooks/useDebouncedInput';
import Paper from '@mui/material/Paper';
import { useEnhancedDialogState } from '../../hooks/useEnhancedDialogState';
import { useWithPendingChangesCloseRequest } from '../../hooks/useWithPendingChangesCloseRequest';
import { ApiResponseErrorState } from '../ApiResponseErrorState';
import { EmptyState } from '../EmptyState';
import { useActiveUser } from '../../hooks/useActiveUser';
import { getStoredShowDisabledUsers, setStoredShowDisabledUsers } from '../../utils/state';

export interface UserManagementProps {
	passwordRequirementsMinComplexity?: number;
}

export function UserManagement(props: UserManagementProps) {
	const { passwordRequirementsMinComplexity = 4 } = props;
	const [offset, setOffset] = useState(0);
	const [limit, setLimit] = useState(10);
	const [fetching, setFetching] = useState(false);
	const [users, setUsers] = useState<PagedArray<User> | null>(null);
	const [error, setError] = useState<ApiResponse | null>(null);
	const [viewUser, setViewUser] = useState<User | null>(null);
	const [keyword, setKeyword] = useState('');
	const user = useActiveUser();
	const [showDisabled, setShowDisabled] = useState(getStoredShowDisabledUsers(user.username));
	const searchInpuRef = useRef(undefined);

	const fetchUsers = useCallback(
		(searchKeyword = keyword, _offset = offset, _showDisabled = showDisabled) => {
			setFetching(true);
			return fetchAll({ limit, offset: _offset, keyword: searchKeyword, showDisabled: _showDisabled }).subscribe({
				next(users) {
					setUsers(users);
					setError(null);
					setFetching(false);
				},
				error({ response }) {
					setError(response?.response);
					setFetching(false);
				}
			});
		},
		[limit, offset, showDisabled]
	);

	useEffect(() => {
		const sub = fetchUsers();
		return () => sub?.unsubscribe();
	}, [fetchUsers]);

	const createUserDialogState = useEnhancedDialogState();
	const createUserDialogPendingChangesCloseRequest = useWithPendingChangesCloseRequest(createUserDialogState.onClose);
	const editUserDialogState = useEnhancedDialogState();
	const editUserDialogPendingChangesCloseRequest = useWithPendingChangesCloseRequest(editUserDialogState.onClose);

	const onUserCreated = () => {
		createUserDialogState.onClose();
		fetchUsers();
	};

	const editUserDialogClosed = () => {
		setViewUser(null);
	};

	const onUserEdited = () => {
		fetchUsers();
	};

	const onRowClicked = (user: User) => {
		setViewUser({ ...user });
		editUserDialogState.onOpen();
	};

	const onPageChange = (page: number) => {
		setOffset(page * limit);
	};

	const onRowsPerPageChange = (e) => {
		setLimit(e.target.value);
	};

	const onSearch = useCallback(
		(keyword) => {
			fetchUsers(keyword, 0);
		},
		[fetchUsers]
	);

	const onSearch$ = useDebouncedInput(onSearch, 400);

	function handleSearchKeyword(keyword: string) {
		setKeyword(keyword);
		onSearch$.next(keyword);
	}

	const onShowDisabledChange = (checked: boolean) => {
		setShowDisabled(checked);
		setStoredShowDisabledUsers(user.username, checked);
		setOffset(0);
	};

	return (
		<Paper elevation={0}>
			<GlobalAppToolbar
				title={<FormattedMessage id="words.users" defaultMessage="Users" />}
				leftContent={
					<Button
						startIcon={<AddIcon />}
						variant="outlined"
						color="primary"
						onClick={() => createUserDialogState.onOpen()}
					>
						<FormattedMessage id="usersGrid.createUser" defaultMessage="Create User" />
					</Button>
				}
				rightContent={
					<SearchBar
						ref={searchInpuRef}
						sxs={{
							root: {
								transition: 'width 500ms',
								width: '210px',
								border: 0,
								background: 'none'
							}
						}}
						keyword={keyword}
						onChange={handleSearchKeyword}
						showActionButton={Boolean(keyword)}
					/>
				}
			/>

			{error ? (
				<ApiResponseErrorState error={error} />
			) : fetching ? (
				<UsersGridSkeletonTable numOfItems={limit} />
			) : users ? (
				users.length ? (
					<UsersGridUI
						users={users}
						onRowClicked={onRowClicked}
						onPageChange={onPageChange}
						onRowsPerPageChange={onRowsPerPageChange}
						showDisabled={showDisabled}
						onShowDisabledChange={onShowDisabledChange}
					/>
				) : (
					<EmptyState title={<FormattedMessage id="usersGrid.emptyStateMessage" defaultMessage="No Users Found" />} />
				)
			) : (
				<></>
			)}

			<CreateUserDialog
				open={createUserDialogState.open}
				onCreateSuccess={onUserCreated}
				onClose={createUserDialogState.onClose}
				passwordRequirementsMinComplexity={passwordRequirementsMinComplexity}
				isSubmitting={createUserDialogState.isSubmitting}
				isMinimized={createUserDialogState.isMinimized}
				hasPendingChanges={createUserDialogState.hasPendingChanges}
				onWithPendingChangesCloseRequest={createUserDialogPendingChangesCloseRequest}
				updateSubmittingOrHasPendingChanges={createUserDialogState.onSubmittingAndOrPendingChange}
			/>
			<EditUserDialog
				open={editUserDialogState.open}
				onClose={editUserDialogState.onClose}
				onClosed={editUserDialogClosed}
				onUserEdited={onUserEdited}
				user={viewUser}
				isSubmitting={editUserDialogState.isSubmitting}
				isMinimized={editUserDialogState.isMinimized}
				hasPendingChanges={editUserDialogState.hasPendingChanges}
				passwordRequirementsMinComplexity={passwordRequirementsMinComplexity}
				onWithPendingChangesCloseRequest={editUserDialogPendingChangesCloseRequest}
				updateSubmittingOrHasPendingChanges={editUserDialogState.onSubmittingAndOrPendingChange}
			/>
		</Paper>
	);
}

export default UserManagement;
