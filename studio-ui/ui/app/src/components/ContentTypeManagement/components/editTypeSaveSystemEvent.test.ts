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
 * Successful Type Builder save must notify the host bus: CONTENT_TYPE_CREATED for new
 * types, CONTENT_TYPE_UPDATED for existing ones (so PreviewConcierge / plugins can react).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import '../../../../test/registerTsLoader.mjs';

const { contentTypeSaveSystemEvent } = await import('./editTypeSaveSystemEvent.ts');
const { contentTypeCreated, contentTypeUpdated, emitSystemEvent } = await import('../../../state/actions/system.ts');

describe('contentTypeSaveSystemEvent', () => {
	it('emits contentTypeCreated wrapped in emitSystemEvent for a new type', () => {
		assert.deepEqual(contentTypeSaveSystemEvent(true), emitSystemEvent(contentTypeCreated()));
	});

	it('emits contentTypeUpdated wrapped in emitSystemEvent for an existing type', () => {
		assert.deepEqual(contentTypeSaveSystemEvent(false), emitSystemEvent(contentTypeUpdated()));
	});

	it('does not emit contentTypeUpdated when creating, or contentTypeCreated when updating', () => {
		assert.notDeepEqual(contentTypeSaveSystemEvent(true), emitSystemEvent(contentTypeUpdated()));
		assert.notDeepEqual(contentTypeSaveSystemEvent(false), emitSystemEvent(contentTypeCreated()));
	});
});
