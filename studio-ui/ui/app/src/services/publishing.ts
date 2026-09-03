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

import { get, postJSON } from '../utils/ajax';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { LegacyItem, LightItem } from '../models/Item';
import { pluckProps, toQueryString } from '../utils/object';
import {
	PublishingItem,
	PublishingStatus,
	PublishingTarget,
	PublishPackage,
	PublishParams
} from '../models/Publishing';
import { Api2BulkResponseFormat, Api2ResponseFormat, ApiResponse } from '../models/ApiResponse';
import { PagedArray } from '../models/PagedArray';

export interface FetchPackagesResponse extends Omit<PublishPackage, 'items'> {}

export type PackageApprovalState = 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export function fetchPackages(
	siteId: string,
	filters?: Partial<{
		target: string;
		states: number;
		approvalStates: Array<PackageApprovalState>;
		submitter: string;
		reviewer: string;
		isScheduled: boolean;
		sort: string;
		offset: number;
		limit: number;
	}>
): Observable<PagedArray<FetchPackagesResponse>> {
	const qs = toQueryString(filters);
	return get<Api2BulkResponseFormat<{ packages: FetchPackagesResponse[] }>>(
		`/studio/api/2/publish/${siteId}/packages${qs}`
	).pipe(map(({ response }) => Object.assign(response.packages, pluckProps(response, 'limit', 'offset', 'total'))));
}

export function fetchPackage(siteId: string, packageId: number): Observable<PublishPackage> {
	return get<Api2ResponseFormat<{ package: PublishPackage }>>(
		`/studio/api/2/publish/${siteId}/package/${packageId}`
	).pipe(map(({ response }) => response?.package));
}

export function fetchPackageItems(
	siteId: string,
	packageId: number,
	data?: {
		path?: string;
		systemType?: string;
		internalName?: string;
		offset?: number;
		limit?: number;
	}
): Observable<PagedArray<PublishingItem>> {
	const qs = toQueryString(data);
	return get<Api2ResponseFormat<{ limit: number; offset: number; total: number; items: PublishingItem[] }>>(
		`/studio/api/2/publish/${siteId}/package/${packageId}/items${qs}`
	).pipe(map(({ response }) => Object.assign(response.items, pluckProps(response, 'limit', 'offset', 'total'))));
}

export type FetchPublishingTargetsResponse = Api2ResponseFormat<{
	published: boolean;
	publishingTargets: Array<PublishingTarget>;
}>;

export function fetchPublishingTargets(site: string): Observable<FetchPublishingTargetsResponse> {
	return get<FetchPublishingTargetsResponse>(`/studio/api/2/publish/${site}/available_targets`).pipe(
		map((response) => response?.response)
	);
}

export interface GoLiveResponse {
	status: number;
	commitId: string;
	item: LegacyItem;
	invalidateCache: boolean;
	success: boolean;
	message: string;
}

export function fetchStatus(siteId: string): Observable<PublishingStatus> {
	return get<Api2ResponseFormat<{ publishingStatus: PublishingStatus }>>(`/studio/api/2/publish/${siteId}/status`).pipe(
		map((response) => response?.response?.publishingStatus)
	);
}

export function enable(siteId: string, enable: boolean): Observable<ApiResponse> {
	return postJSON(`/studio/api/2/publish/${siteId}/enable`, { enable }).pipe(map(({ response }) => response));
}

export function publish(siteId: string, data: PublishParams): Observable<string> {
	return postJSON(`/studio/api/2/publish/${siteId}/package`, data).pipe(map(({ response }) => response?.packageId));
}

export interface CalculatedPackageResponse {
	hardDependencies: LightItem[];
	softDependencies: LightItem[];
	deletedItems: string[];
	items: LightItem[];
}

export function calculatePackage(
	siteId: string,
	data: {
		publishingTarget: string;
		paths?: PublishParams['paths'];
		commitIds?: PublishParams['commitIds'];
	}
): Observable<CalculatedPackageResponse> {
	return postJSON(`/studio/api/2/publish/${siteId}/calculate`, data).pipe(
		map((response) => response?.response?.package)
	);
}

export function recalculatePackage(
	siteId: string,
	packageId: number,
	publishingTarget: string
): Observable<CalculatedPackageResponse> {
	return postJSON(`/studio/api/2/publish/${siteId}/package/${packageId}/recalculate`, { publishingTarget }).pipe(
		map((response) => response?.response?.package)
	);
}
