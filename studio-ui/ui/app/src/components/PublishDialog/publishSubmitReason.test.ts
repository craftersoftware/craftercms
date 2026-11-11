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

/** Why Publish is disabled. The button is disabled exactly when this returns a reason. */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import '../../../test/registerTsLoader.mjs';
import type { PublishSubmitReasonArgs } from './publishSubmitReason.ts';

const { getPublishSubmitReason } = await import('./publishSubmitReason.ts');

const now = new Date('2026-01-01T12:00:00Z');
const ready: PublishSubmitReasonArgs = {
	isFetchingItems: false,
	fetchingPackage: false,
	hasContentItems: true,
	publishingTargetsFailed: false,
	publishingTargetCount: 1,
	hasPublishingTarget: true,
	packageTitle: 'Release',
	submissionComment: 'Publishing: Home',
	pendingDependencyCount: 0,
	hasError: false,
	scheduling: 'now',
	scheduledDateTime: new Date('2026-01-01T12:30:00Z'),
	now,
	allItemsAreFolders: false,
	dependenciesFetchFailed: false,
	dependencyDataMissing: false,
	hardDependenciesWithoutPublishPermission: false
};

describe('publish submit reason', () => {
	it('has no reason when everything is ready', () => {
		assert.equal(getPublishSubmitReason(ready), null);
	});

	it('names each blocking condition', () => {
		const cases: Array<[Partial<PublishSubmitReasonArgs>, string]> = [
			[{ isFetchingItems: true }, 'loading'],
			[{ hasContentItems: false }, 'loading'],
			[{ publishingTargetsFailed: true, publishingTargetCount: null }, 'targetsFailed'],
			[{ publishingTargetCount: 0 }, 'noTarget'],
			[{ publishingTargetCount: null }, 'noTarget'],
			[{ hasPublishingTarget: false }, 'selectTarget'],
			[{ fetchingPackage: true }, 'loading'],
			[{ packageTitle: '  ' }, 'packageTitle'],
			[{ submissionComment: '' }, 'submissionComment'],
			[{ pendingDependencyCount: 2 }, 'pendingDependencies'],
			[{ hasError: true }, 'error'],
			[{ allItemsAreFolders: true }, 'emptyFolders'],
			[{ dependenciesFetchFailed: true }, 'dependenciesFailed'],
			[{ dependencyDataMissing: true }, 'dependenciesPending'],
			[{ hardDependenciesWithoutPublishPermission: true }, 'noPermission']
		];
		for (const [override, reason] of cases) {
			assert.equal(getPublishSubmitReason({ ...ready, ...override }), reason, JSON.stringify(override));
		}
	});

	it('checks the schedule date only for a custom schedule', () => {
		const past = new Date('2026-01-01T11:00:00Z');
		assert.equal(getPublishSubmitReason({ ...ready, scheduledDateTime: past }), null);
		assert.equal(getPublishSubmitReason({ ...ready, scheduling: 'custom', scheduledDateTime: past }), 'pastSchedule');
	});

	it('reports a failed target load ahead of the loading package', () => {
		assert.equal(
			getPublishSubmitReason({ ...ready, publishingTargetsFailed: true, fetchingPackage: true }),
			'targetsFailed'
		);
	});
});
