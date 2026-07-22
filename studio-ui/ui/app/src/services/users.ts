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

import { forkJoin, Observable, of } from 'rxjs';
import { User } from '../models/User';
import { del, get, patchJSON, postJSON } from '../utils/ajax';
import { map, pluck, switchMap } from 'rxjs/operators';
import { fetchAll as fetchAllSites } from './sites';
import LookupTable from '../models/LookupTable';
import { Site } from '../models/Site';
import { PagedArray } from '../models/PagedArray';
import PaginationOptions from '../models/PaginationOptions';
import { toQueryString } from '../utils/object';
import { asArray } from '../utils/array';
import { fetchAuthenticationType } from './auth';

// Check services/auth/login if `me` method is changed.
export function me(): Observable<User> {
	return forkJoin({
		user: get(me.url).pipe(map((response) => response?.response?.authenticatedUser)),
		authenticationType: fetchAuthenticationType()
	}).pipe(map(({ user, authenticationType }) => ({ ...user, authenticationType })));
}

me.url = '/studio/api/2/users/me.json';

export function create(user: Partial<User>): Observable<User> {
	return postJSON(`/studio/api/2/users`, user).pipe(map((response) => response?.response?.user));
}

export function update(user: Partial<User>): Observable<User> {
	return patchJSON(`/studio/api/2/users`, user).pipe(map((response) => response?.response?.user));
}

export function fetchAll(
	options?: Partial<PaginationOptions & { keyword?: string; showDisabled?: boolean }>
): Observable<PagedArray<User>> {
	const mergedOptions = {
		limit: 100,
		offset: 0,
		...options
	};
	return get(`/studio/api/2/users${toQueryString(mergedOptions)}`).pipe(
		map(({ response }) =>
			Object.assign(response.users, {
				limit: response.limit < mergedOptions.limit ? mergedOptions.limit : response.limit,
				offset: response.offset,
				total: response.total
			})
		)
	);
}

export function enable(username: string): Observable<User>;
export function enable(usernames: string[]): Observable<User[]>;
export function enable(usernames: string | string[]): Observable<User | User[]> {
	return patchJSON('/studio/api/2/users/enable', { usernames: asArray(usernames) }).pipe(
		map((response) => (Array.isArray(usernames) ? response?.response?.users : response?.response?.users[0]))
	);
}

export function disable(username: string): Observable<User>;
export function disable(usernames: string[]): Observable<User[]>;
export function disable(usernames: string | string[]): Observable<User | User[]> {
	return patchJSON('/studio/api/2/users/disable', { usernames: asArray(usernames) }).pipe(
		map((response) => (Array.isArray(usernames) ? response?.response?.users : response?.response?.users[0]))
	);
}

/**
 * Sets the password for the supplied username. Requires UPDATE_USERS permission.
 **/
export function setPassword(username: string, password: string): Observable<void> {
	return postJSON(`/studio/api/2/users/${encodeURIComponent(username)}/reset_password`, {
		username,
		new: password
	}).pipe(map((response) => response?.response));
}

/**
 * Set a new password using a valid password reset token.
 **/
export function resetPasswordWithToken(token: string, password: string): Observable<boolean> {
	return postJSON('/studio/api/2/users/set_password', {
		token,
		new: password
	}).pipe(map((response) => response?.response?.user));
}

/**
 * Set the password for the current user.
 **/
export function setMyPassword(username: string, currentPassword: string, newPassword: string): Observable<User> {
	return postJSON('/studio/api/2/users/me/change_password', {
		username,
		current: currentPassword,
		new: newPassword
	}).pipe(map((response) => response?.response?.user));
}

export function fetchByUsername(username: string): Observable<User> {
	return get(`/studio/api/2/users/${encodeURIComponent(username)}`).pipe(map((response) => response?.response?.user));
}

export function fetchRolesInSite(username: string, siteId: string): Observable<string[]> {
	return get(`/studio/api/2/users/${username}/sites/${siteId}/roles`).pipe(
		map((response) => response?.response?.roles)
	);
}

export function fetchMyRolesInSite(siteId: string): Observable<string[]> {
	return get(`/studio/api/2/users/me/sites/${siteId}/roles`).pipe(map((response) => response?.response?.roles));
}

export function fetchRolesBySite(username?: string, sites?: Site[]): Observable<LookupTable<string[]>> {
	return forkJoin({
		username: username ? of(username) : me().pipe(map((user) => user.username)),
		sites: sites ? of(sites) : fetchAllSites()
	}).pipe(
		switchMap(({ username, sites }) =>
			forkJoin(
				sites.reduce(
					(lookup, site) => {
						lookup[site.id] = fetchRolesInSite(username, site.id);
						return lookup;
					},
					{} as LookupTable<Observable<string[]>>
				)
			)
		)
	);
}

// renamed from fetchRolesBySiteForCurrent
export function fetchMyRolesBySite(sites?: Site[]): Observable<LookupTable<string[]>> {
	return (sites ? of(sites) : fetchAllSites()).pipe(
		switchMap((sites) =>
			forkJoin(
				sites.reduce(
					(lookup, site) => {
						lookup[site.id] = fetchMyRolesInSite(site.id);
						return lookup;
					},
					{} as LookupTable<Observable<string[]>>
				)
			)
		)
	);
}

export function fetchGlobalProperties(): Observable<LookupTable<string>> {
	return get('/studio/api/2/users/me/properties').pipe(pluck('response', 'properties', ''));
}

export function deleteGlobalProperties(...preferenceKeys: string[]): Observable<LookupTable<any>> {
	return del(`/studio/api/2/users/me/properties${toQueryString({ properties: preferenceKeys.join(',') })}`).pipe(
		map((response) => response?.response?.properties)
	);
}

export function fetchSiteProperties(siteId: string): Observable<LookupTable<string>> {
	return get(`/studio/api/2/users/me/properties?siteId=${siteId}`).pipe(
		map((response) => response?.response?.properties[siteId])
	);
}

export function deleteSiteProperties(site: string, ...preferenceKeys: string[]): Observable<LookupTable<any>> {
	return del(
		`/studio/api/2/users/me/properties${toQueryString({
			siteId: site,
			properties: JSON.stringify(preferenceKeys)
		})}`
	).pipe(map((response) => response?.response?.properties));
}

export function setProperties(
	preferences: LookupTable<string | number>,
	siteId?: string
): Observable<LookupTable<any>> {
	return postJSON('/studio/api/2/users/me/properties', {
		siteId,
		properties: preferences
	}).pipe(map((response) => response?.response?.properties));
}

export function deleteProperties(properties: string[], siteId?: string): Observable<LookupTable<any>> {
	return del(`/studio/api/2/users/me/properties${toQueryString({ siteId, properties: properties.join(',') })}`).pipe(
		map((response) => response?.response?.properties)
	);
}

export function fetchMyPermissions(site: string): Observable<string[]> {
	return get(`/studio/api/2/users/me/sites/${site}/permissions`).pipe(
		map((response) => response?.response?.permissions)
	);
}

export function hasPermissions(site: string, ...permissions: string[]): Observable<LookupTable<boolean>> {
	return postJSON(`/studio/api/2/users/me/sites/${site}/has_permissions`, { permissions }).pipe(
		map((response) => response?.response?.permissions)
	);
}

export function hasPermission(site: string, permission: string): Observable<boolean> {
	return hasPermissions(site, permission).pipe(map((response) => response[permission]));
}

export function fetchGlobalPermissions(): Observable<string[]> {
	return get(`/studio/api/2/users/me/global/permissions`).pipe(map(({ response: { permissions } }) => permissions));
}

export function hasGlobalPermissions(...permissions: string[]): Observable<LookupTable<boolean>> {
	return postJSON('/studio/api/2/users/me/global/has_permissions', { permissions }).pipe(
		map((response) => response?.response?.permissions)
	);
}

export function hasGlobalPermission(permission: string): Observable<boolean> {
	return hasGlobalPermissions(permission).pipe(map((response) => response[permission]));
}
