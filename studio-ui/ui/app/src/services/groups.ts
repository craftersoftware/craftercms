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

import PaginationOptions from '../models/PaginationOptions';
import { PagedArray } from '../models/PagedArray';
import { Observable } from 'rxjs';
import { toQueryString } from '../utils/object';
import { del, get, patchJSON, postJSON } from '../utils/ajax';
import { map } from 'rxjs/operators';
import Group from '../models/Group';
import User from '../models/User';

const paginationDefault = {
	limit: 100,
	offset: 0
};

export function fetchAll(options?: Partial<PaginationOptions> & { keyword?: string }): Observable<PagedArray<Group>> {
	const mergedOptions = {
		...paginationDefault,
		...options
	};
	return get(`/studio/api/2/groups${toQueryString(mergedOptions)}`).pipe(
		map(({ response }) =>
			Object.assign(response.groups, {
				limit: response.limit < mergedOptions.limit ? mergedOptions.limit : response.limit,
				offset: response.offset,
				total: response.total
			})
		)
	);
}

export function fetchUsersFromGroup(id: number, options?: Partial<PaginationOptions>): Observable<PagedArray<User>> {
	const qs = toQueryString({
		...paginationDefault,
		...options
	});
	return get(`/studio/api/2/groups/${id}/members${qs}`).pipe(
		map(({ response }) =>
			Object.assign(response.users, {
				limit: response.limit,
				offset: response.offset,
				total: response.total
			})
		)
	);
}

export function create(group: Partial<Group>): Observable<Group> {
	return postJSON('/studio/api/2/groups', group).pipe(map((response) => response?.response?.group));
}

export function update(group: Partial<Group>): Observable<Group> {
	return patchJSON(`/studio/api/2/groups`, group).pipe(map((response) => response?.response?.group));
}

export function trash(groupId: number): Observable<true> {
	return del(`/studio/api/2/groups?id=${groupId}`).pipe(map(() => true));
}

export function addUserToGroup(groupId: number, username: string): Observable<User> {
	return addUsersToGroup(groupId, [username]).pipe(map((response) => response[0]));
}

export function addUsersToGroup(groupId: number, ids: number[]): Observable<User[]>;
export function addUsersToGroup(groupId: number, usernames: string[]): Observable<User[]>;
export function addUsersToGroup(groupId: number, idsOrUsernames: Array<number> | Array<string>): Observable<User[]> {
	return postJSON(`/studio/api/2/groups/${groupId}/members`, {
		[typeof idsOrUsernames[0] === 'string' ? 'usernames' : 'ids']: idsOrUsernames
	}).pipe(map((response) => response?.response?.users));
}

export function deleteUserFromGroup(groupId: number, username: string): Observable<true>;
export function deleteUserFromGroup(groupId: number, userId: number): Observable<true>;
export function deleteUserFromGroup(groupId: number, usernameOrUserId: number | string): Observable<true> {
	// @ts-ignore - types are correct, signature to accept either is simply not published by deleteUsersFromGroup
	return deleteUsersFromGroup(groupId, [usernameOrUserId]);
}

export function deleteUsersFromGroup(groupId: number, userIds: number[]): Observable<true>;
export function deleteUsersFromGroup(groupId: number, usernames: string[]): Observable<true>;
export function deleteUsersFromGroup(groupId: number, usernamesOrUserIds: number[] | string[]): Observable<true> {
	const qs = toQueryString({
		[typeof usernamesOrUserIds[0] === 'string' ? 'username' : 'userId']: usernamesOrUserIds
	});
	return del(`/studio/api/2/groups/${groupId}/members${qs}`).pipe(map(() => true));
}
