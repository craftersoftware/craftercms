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

/**
 * The Experience Builder zone marker shows "Required" for a missing minimum and "Maximum reached" for a
 * reached maximum. It cannot use the validation level for that: `assignCountLimits` stores both minCount and
 * maxCount at level `required`, so the id is the only distinction.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { occurrenceViolationKind } from './countLimits.ts';

describe('occurrenceViolationKind', () => {
	it('reads a short minimum as the required prompt', () => {
		assert.equal(occurrenceViolationKind([{ id: 'minCount' }]), 'required');
	});

	it('reads a reached maximum as a maximum, not as required', () => {
		// Both are stored at level 'required', which is the case the marker got wrong.
		assert.equal(occurrenceViolationKind([{ id: 'maxCount' }]), 'maxCount');
	});

	it('prefers required when a range reports both', () => {
		assert.equal(occurrenceViolationKind([{ id: 'maxCount' }, { id: 'minCount' }]), 'required');
	});

	it('ignores validations that are not item counts', () => {
		assert.equal(occurrenceViolationKind([]), null);
		assert.equal(occurrenceViolationKind([{ id: 'maxlength' }, { id: 'required' }]), null);
	});
});
