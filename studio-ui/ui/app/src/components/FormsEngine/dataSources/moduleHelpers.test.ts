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

const { createExternalUploadAction, resolveActionLabel } = await import('./moduleHelpers.ts');

describe('resolveActionLabel', () => {
	it('prefers an explicit label over title or type defaults', () => {
		assert.equal(resolveActionLabel('browse', { label: 'Custom', title: 'Photos' }), 'Custom');
	});

	it('formats Browse - {title} when a title is provided', () => {
		assert.equal(resolveActionLabel('browse', { title: 'Photos' }), 'Browse - Photos');
	});

	it('returns the bare type label when there is no title', () => {
		assert.equal(resolveActionLabel('browse'), 'Browse');
	});

	it('uses Transcode - {title} for createExternalUploadAction with transcode', () => {
		assert.equal(
			createExternalUploadAction({
				title: 'Videos',
				path: '/static-assets',
				selection: 'variants',
				transcode: true
			}).label,
			'Transcode - Videos'
		);
	});
});
