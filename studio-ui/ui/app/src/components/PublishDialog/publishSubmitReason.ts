/*
 * Copyright (C) 2007-2026 Crafter Software Corporation. All Rights Reserved.
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

import { isBlank } from '../../utils/string';

export type PublishSubmitReason =
	| 'loading'
	| 'targetsFailed'
	| 'noTarget'
	| 'selectTarget'
	| 'packageTitle'
	| 'submissionComment'
	| 'pendingDependencies'
	| 'error'
	| 'pastSchedule'
	| 'emptyFolders'
	| 'dependenciesFailed'
	| 'dependenciesPending'
	| 'noPermission';

export interface PublishSubmitReasonArgs {
	/** Detailed items haven't loaded. */
	isFetchingItems: boolean;
	/** The package calculation is running. */
	fetchingPackage: boolean;
	hasContentItems: boolean;
	publishingTargetsFailed: boolean;
	/** `null` while the target list has not arrived. */
	publishingTargetCount: number | null;
	hasPublishingTarget: boolean;
	packageTitle: string;
	submissionComment: string;
	pendingDependencyCount: number;
	hasError: boolean;
	scheduling: 'now' | 'custom';
	scheduledDateTime: Date;
	now: Date;
	allItemsAreFolders: boolean;
	dependenciesFetchFailed: boolean;
	/** The dependency calculation has not produced data yet. */
	dependencyDataMissing: boolean;
	hardDependenciesWithoutPublishPermission: boolean;
}

/**
 * Why Publish (or Schedule, or Request Publish) is unavailable, or `null` when it can be pressed.
 * This is the only list of conditions: the button is disabled exactly when there is a reason,
 * so the two cannot drift apart. The first match wins. Submitting is handled by the caller,
 * since the button shows its own progress then.
 */
export function getPublishSubmitReason(args: PublishSubmitReasonArgs): PublishSubmitReason | null {
	if (args.isFetchingItems || !args.hasContentItems) return 'loading';
	if (args.publishingTargetsFailed) return 'targetsFailed';
	if (!args.publishingTargetCount) return 'noTarget';
	if (!args.hasPublishingTarget) return 'selectTarget';
	if (args.fetchingPackage) return 'loading';
	if (isBlank(args.packageTitle)) return 'packageTitle';
	if (isBlank(args.submissionComment)) return 'submissionComment';
	if (args.pendingDependencyCount > 0) return 'pendingDependencies';
	if (args.hasError) return 'error';
	// The date is sent only for a custom schedule. "Now" must not be blocked by an elapsed default date.
	if (args.scheduling === 'custom' && args.scheduledDateTime < args.now) return 'pastSchedule';
	if (args.allItemsAreFolders) return 'emptyFolders';
	if (args.dependenciesFetchFailed) return 'dependenciesFailed';
	if (args.dependencyDataMissing) return 'dependenciesPending';
	if (args.hardDependenciesWithoutPublishPermission) return 'noPermission';
	return null;
}
