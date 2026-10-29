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

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import '../../../../test/registerTsLoader.mjs';

const { invalidFieldReadDebounceMs, watchInvalidFieldUpdates } = await import('./useInvalidFieldIds.ts');
const { Subject, VirtualTimeScheduler } = await import('rxjs');

describe('invalid field updates', () => {
	// The form used to debounce this read by 300ms. Without it, every keystroke re-checks every field.
	it('reads once after typing pauses, not on every keystroke', () => {
		const scheduler = new VirtualTimeScheduler();
		const updates = new Subject<string>();
		const reads: number[] = [];
		const subscription = watchInvalidFieldUpdates(
			updates,
			() => reads.push(reads.length),
			invalidFieldReadDebounceMs,
			scheduler
		);
		updates.next('title_s');
		updates.next('title_s');
		scheduler.maxFrames = invalidFieldReadDebounceMs - 1;
		scheduler.flush();
		assert.deepEqual(reads, []);
		scheduler.maxFrames = Number.POSITIVE_INFINITY;
		scheduler.flush();
		assert.deepEqual(reads, [0]);
		subscription?.unsubscribe();
	});
});
