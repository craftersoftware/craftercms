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

import LookupTable from './LookupTable';
import { PackageApprovalState } from '../services/publishing';
import Person from './Person';
import { LightItem } from './Item';

export type PublishingTargets = 'live' | 'staging';

export interface Package {
	id: number;
	siteId: string;
	schedule: string;
	approver: string;
	state: string;
	environment: string;
	comment: string;
}

export type Selected = LookupTable<boolean>;

export interface File {
	contentTypeClass: string;
	mimeType: string;
	path: string;
}

export interface CurrentFilters {
	target: string;
	states?: number;
	approvalStates: Array<PackageApprovalState>;
	submitter: string;
	reviewer: string;
	isScheduled: boolean;
	sort: string;
	offset: number;
	limit: number;
}

export type PublishingStatusCodes = 'ready' | 'publishing' | 'stopped';

export interface currentTaskStage {
	name: string;
	state: PublishingStatus['currentTask']['state'];
	processed: number;
	errors: boolean;
	total: number;
}

export interface PublishingStatus {
	enabled: boolean;
	published: boolean;
	currentTask: {
		taskId: {
			siteId: string;
			packageId: number;
		};
		type: string;
		startTime: string;
		endTime: string;
		state: 'READY' | 'IN_PROGRESS' | 'COMPLETED';
		stages: currentTaskStage[];
	};
}

export interface PublishFormData {
	path?: string;
	commitIds?: string;
	title?: string;
	comment: string;
	publishingTarget: string;
}

export type PublishOnDemandMode = 'studio' | 'git' | 'everything';

export interface PublishingTarget {
	name: 'live' | 'staging';
	order: number;
}

export interface PublishParams {
	publishingTarget: string;
	paths?: {
		path: string;
		includeChildren: boolean;
		includeSoftDeps: boolean;
	}[];
	commitIds?: string[];
	schedule?: string;
	requestApproval?: boolean;
	publishAll?: boolean;
	title: string;
	comment?: string;
}

export interface PublishingStats {
	numberOfPublishes: number;
	numberOfNewAndPublishedItems: number;
	numberOfEditedAndPublishedItems: number;
}

export interface PublishingPackagesApproveParams {
	comment: string;
	schedule: string;
	updateSchedule: boolean;
	packageIds: number[];
}

export interface PublishingPackageApproveParams extends Omit<PublishingPackagesApproveParams, 'packageIds'> {}

export interface UpdatePackageParams
	extends
		Pick<PublishParams, 'title' | 'comment' | 'requestApproval'>,
		Pick<PublishingPackagesApproveParams, 'updateSchedule'> {
	schedule?: string | null;
}

export type PackageActions = 'view' | 'review' | 'cancel' | 'resubmit' | 'promote' | 'edit';

export interface PublishingItem {
	action: string;
	id: number;
	liveError: number;
	livePreviousPath: string;
	path: string;
	publishState: number;
	stagingError: number;
	stagingPreviousPath: string;
	userRequested: boolean;
	itemMetadata: {
		label: LightItem['label'];
		systemType: LightItem['systemType'];
		mimeType: LightItem['mimeType'];
	};
}

export interface PublishPackage {
	id: number;
	title: string;
	submittedOn: string;
	submitterComment: string;
	reviewerComment: string;
	reviewedOn: string;
	target: PublishingTargets;
	approvalState: string;
	packageState: number;
	schedule: string;
	submitter: {
		id: number;
		username: string;
		firstName: string;
		lastName: string;
		avatar: string;
	};
	submitterId: number;
	reviewer: {
		id: number;
		username: string;
		firstName: string;
		lastName: string;
		avatar: string;
	};
	reviewerId: number;
	siteId: string;
	liveError: number;
	stagingError: number;
	publishedOn: string;
	packageType: string;
	commitId: string;
	publishedStagingCommitId: string;
	publishedLiveCommitId: string;
	itemCount: number;
	availableActions: number;
}

export interface PublishTargetStatus {
	dateLastPublished: string;
	dateScheduled: string;
	publisher: Person;
}
