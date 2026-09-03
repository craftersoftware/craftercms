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

import { get } from '../utils/ajax';
import { reversePluckProps, toQueryString } from '../utils/object';
import { map } from 'rxjs/operators';
import { DashboardPublishingPackage } from '../models/Dashboard';
import { Observable } from 'rxjs';
import { ContentItem, PagedArray, PublishingStats, PublishingTargets } from '../models';
import { Activity } from '../models/Activity';
import PaginationOptions from '../models/PaginationOptions';
import { createPagedArray } from '../utils/array';
import { prepareVirtualItemProps } from '../utils/content';
import SystemType from '../models/SystemType';

function parseDashletOptions(options: FetchUnpublishedOptions | FetchPendingApprovalOptions | FetchScheduledOptions) {
	const { sortBy, sortOrder, itemType } = options;
	return {
		...reversePluckProps(options, 'itemType', 'sortBy', 'sortOrder'),
		...(itemType && { itemType: itemType.join(',') }),
		...(sortBy && sortOrder && { sort: `${sortBy} ${sortOrder}` })
	};
}

interface FetchActivityOptions extends PaginationOptions {
	actions?: string[];
	usernames?: string[];
	dateFrom?: string;
	dateTo?: string;
}

export function fetchActivity(siteId: string, options?: FetchActivityOptions): Observable<PagedArray<Activity>> {
	const qs = toQueryString(options, { arrayFormat: 'comma' });
	return get(`/studio/api/2/dashboard/${siteId}/activity${qs}`).pipe(
		map(({ response: { activities, total, offset, limit } }) =>
			Object.assign(activities, {
				total,
				offset,
				limit
			})
		)
	);
}

interface FetchMyActivityOptions extends Omit<FetchActivityOptions, 'usernames'> {}

export function fetchMyActivity(siteId: string, options?: FetchMyActivityOptions): Observable<PagedArray<Activity>> {
	const qs = toQueryString(options);
	return get(`/studio/api/2/dashboard/${siteId}/activity/me${qs}`).pipe(
		map(({ response: { activities, total, offset, limit } }) =>
			Object.assign(activities, {
				total,
				offset,
				limit
			})
		)
	);
}

export interface FetchPendingApprovalOptions extends PaginationOptions {
	itemType?: Array<SystemType>;
	sortBy?: string;
	sortOrder?: 'asc' | 'desc';
}

export function fetchPendingApproval(
	siteId: string,
	options?: FetchPendingApprovalOptions
): Observable<PagedArray<ContentItem>> {
	const qs = toQueryString({ siteId, ...parseDashletOptions(options) });
	return get(`/studio/api/2/dashboard/content/pending_approval${qs}`).pipe(
		map(({ response }) =>
			createPagedArray(
				response.publishingItems.map((item) => prepareVirtualItemProps(item)),
				response
			)
		)
	);
}

export interface FetchUnpublishedOptions extends PaginationOptions {
	itemType?: Array<SystemType>;
	sortBy?: string;
	sortOrder?: 'asc' | 'desc';
}

export function fetchUnpublished(
	siteId: string,
	options: FetchUnpublishedOptions
): Observable<PagedArray<ContentItem>> {
	const qs = toQueryString(parseDashletOptions(options));
	return get(`/studio/api/2/dashboard/${siteId}/content/unpublished${qs}`).pipe(
		map(({ response }) =>
			createPagedArray(
				response.unpublishedItems.map((item) => prepareVirtualItemProps(item)),
				response
			)
		)
	);
}

export interface FetchScheduledOptions extends PaginationOptions {
	publishingTarget?: PublishingTargets;
	approver?: string;
	dateFrom?: string;
	dateTo?: string;
	itemType?: Array<SystemType>;
	sortBy?: string;
	sortOrder?: 'asc' | 'desc';
}

export function fetchScheduled(siteId: string, options: FetchScheduledOptions): Observable<PagedArray<ContentItem>> {
	const qs = toQueryString({ siteId, ...parseDashletOptions(options) });
	return get(`/studio/api/2/dashboard/publishing/scheduled${qs}`).pipe(
		map(({ response }) =>
			createPagedArray(
				response.publishingItems.map((item) => prepareVirtualItemProps(item)),
				response
			)
		)
	);
}

export function fetchScheduledPackageItems(siteId: string, packageId: number): Observable<ContentItem[]> {
	const qs = toQueryString({ siteId });
	return get(`/studio/api/2/dashboard/publishing/scheduled/${packageId}${qs}`).pipe(
		map((response) => response?.response?.publishingPackageItems.map((item) => prepareVirtualItemProps(item)))
	);
}

export function fetchPublishingHistory(
	siteId: string,
	options: Partial<FetchScheduledOptions>
): Observable<PagedArray<DashboardPublishingPackage>> {
	const qs = toQueryString({ siteId, ...options });
	return get(`/studio/api/2/dashboard/publishing/history${qs}`).pipe(
		map(({ response }) => createPagedArray(response.publishingPackages, response))
	);
}

export function fetchPublishingHistoryPackageItems(
	siteId: string,
	packageId: number,
	options?: PaginationOptions
): Observable<PagedArray<ContentItem>> {
	const qs = toQueryString({ siteId, ...options });
	return get(`/studio/api/2/dashboard/publishing/history/${packageId}${qs}`).pipe(
		map(({ response }) =>
			createPagedArray(
				response.publishingPackageItems.map((item) => prepareVirtualItemProps(item)),
				response
			)
		)
	);
}

export interface ExpiredItem {
	itemName: string;
	itemPath: string;
	expiredDateTime: string;
	contentItem: ContentItem;
}

export function fetchExpired(siteId: string, options?: PaginationOptions): Observable<ExpiredItem[]> {
	const qs = toQueryString(options);
	return get(`/studio/api/2/dashboard/${siteId}/content/expired${qs}`).pipe(
		map((response) =>
			response?.response?.items.map((item) => ({
				...item,
				contentItem: prepareVirtualItemProps(item.sandboxItem)
			}))
		)
	);
}

interface FetchExpiringOptions extends PaginationOptions {
	dateFrom: string;
	dateTo: string;
}

export function fetchExpiring(siteId: string, options: FetchExpiringOptions): Observable<ExpiredItem[]> {
	const qs = toQueryString(options);
	return get(`/studio/api/2/dashboard/${siteId}/content/expiring${qs}`).pipe(
		map((response) =>
			response?.response?.items.map((item) => ({
				...item,
				contentItem: prepareVirtualItemProps(item.sandboxItem)
			}))
		)
	);
}

export function fetchPublishingStats(siteId: string, days: number): Observable<PublishingStats> {
	const qs = toQueryString({ days });
	return get(`/studio/api/2/dashboard/${siteId}/publishing/stats${qs}`).pipe(
		map((response) => response?.response?.publishingStats)
	);
}
