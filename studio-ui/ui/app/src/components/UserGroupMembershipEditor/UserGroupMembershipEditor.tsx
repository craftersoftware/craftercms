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

import { defineMessages, FormattedMessage, useIntl, type MessageValue } from 'react-intl';
import { useDispatch } from 'react-redux';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Group from '../../models/Group';
import LookupTable from '../../models/LookupTable';
import { nnou } from '../../utils/object';
import { addUserToGroup, deleteUserFromGroup, fetchAll, fetchUsersFromGroup } from '../../services/groups';
import { map, switchMap } from 'rxjs/operators';
import { forkJoin } from 'rxjs';
import TransferListColumn from '../TransferListColumn/TransferListColumn';
import { showSystemNotification } from '../../state/actions/system';
import { TransferListItem } from '../TransferListColumn';
import { filterTransferListItemsByKeyword } from '../TransferList/utils';

export interface UserGroupMembershipEditorProps {
	username?: string;
	onChange?(selectedGroupIds: string[]): void;
}

const messages = {
	...defineMessages({
		error: {
			id: 'userGroupMembershipEditor.addOrRemoveError',
			defaultMessage: 'Error modifying user group(s). Please try again momentarily.'
		}
	}),
	...defineMessages<{
		addToGroupsSuccess: { readonly numOfGroups: number | bigint; readonly user: MessageValue };
		removeFromGroupsSuccess: { readonly numOfGroups: number | bigint; readonly user: MessageValue };
	}>({
		addToGroupsSuccess: {
			id: 'userGroupMembershipEditor.addToGroupsSuccess',
			defaultMessage: '"{user}" added to {numOfGroups, plural, one {the specified group} other {{numOfGroups} groups}}'
		},
		removeFromGroupsSuccess: {
			id: 'userGroupMembershipEditor.removeFromGroupsSuccess',
			defaultMessage:
				'"{user}" removed from {numOfGroups, plural, one {the specified group} other {{numOfGroups} groups}}'
		}
	})
};

export function UserGroupMembershipEditor(props: UserGroupMembershipEditorProps) {
	const { username, onChange } = props;
	const dispatch = useDispatch();
	const { formatMessage } = useIntl();
	const [groups, setGroups] = useState<Group[]>([]);
	const [selectedGroups, setSelectedGroups] = useState<LookupTable<boolean>>({});
	const [groupsFilterKeyword, setGroupsFilterKeyword] = useState('');
	const [inProgressIds, setInProgressIds] = useState<Array<string | number>>([]);
	const refs = useRef({ inProgressIds });
	const transferListItems = useMemo(
		() =>
			filterTransferListItemsByKeyword(
				groups.map((group) => ({
					id: `${group.id}`,
					title: group.name,
					subtitle: group.desc
				})),
				groupsFilterKeyword
			),
		[groups, groupsFilterKeyword]
	);

	refs.current.inProgressIds = inProgressIds;

	useEffect(() => {
		if (nnou(username)) {
			fetchAll({ limit: 100 })
				.pipe(
					switchMap((groups) =>
						forkJoin(groups.map((group) => fetchUsersFromGroup(group.id))).pipe(
							map((membersOfEachGroup) => {
								const groupsUserIsIn = membersOfEachGroup.reduce((accum, users, index) => {
									if (Boolean(users.find((user) => user.username === username))) {
										accum[groups[index].id] = true;
									}
									return accum;
								}, {});
								return [groups, groupsUserIsIn];
							})
						)
					)
				)
				.subscribe(([groups, groupsUserIsIn]) => {
					setGroups(groups as Group[]);
					setSelectedGroups(groupsUserIsIn);
				});
		} else {
			fetchAll({ limit: 100 }).subscribe(setGroups);
			setSelectedGroups({});
		}
	}, [username]);

	const addRemoveFn = (groups: TransferListItem[], op: 'add' | 'remove') => {
		const ids = groups.map((group) => group.id);
		const service = op === 'add' ? addUserToGroup : deleteUserFromGroup;
		setInProgressIds([...inProgressIds, ...ids]);
		forkJoin(groups.map((group) => service(Number(group.id), username))).subscribe(
			(results) => {
				setInProgressIds(refs.current.inProgressIds.filter((id) => !ids.includes(id)));
				dispatch(
					showSystemNotification({
						message: formatMessage(messages[op === 'add' ? 'addToGroupsSuccess' : 'removeFromGroupsSuccess'], {
							user: username,
							numOfGroups: groups.length
						}),
						options: { variant: 'success' }
					})
				);
			},
			() => {
				setInProgressIds(refs.current.inProgressIds.filter((id) => !ids.includes(id)));
				const next = {};
				for (let id in selectedGroups) {
					if (selectedGroups.hasOwnProperty(id) && !ids.includes(id)) {
						next[id] = true;
					}
				}
				setSelectedGroups(next);
				dispatch(
					showSystemNotification({
						message: formatMessage(messages.error),
						options: { variant: 'error' }
					})
				);
			}
		);
	};

	const addTo = (groups: TransferListItem[]) => {
		addRemoveFn(groups, 'add');
	};

	const removeFrom = (groups) => {
		addRemoveFn(groups, 'remove');
	};

	const onItemClick = (group) => {
		const next = {};
		const including = !selectedGroups[group.id];
		if (including) {
			next[group.id] = true;
		}
		for (let id in selectedGroups) {
			if (selectedGroups.hasOwnProperty(id) && selectedGroups[id] && (including || id !== group.id)) {
				next[id] = true;
			}
		}
		if (username) {
			if (next[group.id]) {
				addTo([group]);
			} else {
				removeFrom([group]);
			}
		}
		setSelectedGroups(next);
		onChange?.(Object.keys(next));
	};

	const onCheckAllClicked = (items, checked) => {
		const next = {};
		if (checked) {
			transferListItems.forEach((group) => (next[group.id] = true));
		}
		setSelectedGroups(next);
		onChange?.(Object.keys(next));
	};

	return (
		<TransferListColumn
			title={<FormattedMessage id="words.groups" defaultMessage="Groups" />}
			items={transferListItems}
			onItemClick={onItemClick}
			checkedList={selectedGroups}
			inProgressIds={inProgressIds}
			isAllChecked={username ? null : !transferListItems?.some((group) => selectedGroups[group.id] !== true)}
			onCheckAllClicked={username ? null : onCheckAllClicked}
			filterKeyword={groupsFilterKeyword}
			setFilterKeyword={setGroupsFilterKeyword}
		/>
	);
}

export default UserGroupMembershipEditor;
