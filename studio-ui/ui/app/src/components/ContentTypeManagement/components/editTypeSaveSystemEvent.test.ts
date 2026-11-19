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
import { of, firstValueFrom } from 'rxjs';
import '../../../../test/registerTsLoader.mjs';

const { contentTypeSaveSystemEvent } = await import('./editTypeSaveSystemEvent.ts');
const { contentTypeCreated, contentTypeUpdated, emitSystemEvent } = await import('../../../state/actions/system.ts');
const { emitSystemEventEpic } = await import('../../../state/epics/system.ts');
const { getHostToHostBus } = await import('../../../utils/subjects.ts');

describe('contentTypeSaveSystemEvent', () => {
	it('emits contentTypeCreated wrapped in emitSystemEvent for a new type', () => {
		const action = contentTypeSaveSystemEvent(true, '123');
		assert.deepEqual(action, emitSystemEvent(contentTypeCreated({ contentTypeId: '123' })));
		assert.equal(action.payload.payload.contentTypeId, '123');
	});

	it('emits contentTypeUpdated wrapped in emitSystemEvent for an existing type', () => {
		const action = contentTypeSaveSystemEvent(false, '123');
		assert.deepEqual(action, emitSystemEvent(contentTypeUpdated({ contentTypeId: '123' })));
		assert.equal(action.payload.payload.contentTypeId, '123');
	});

	it('publishes exactly one CONTENT_TYPE_UPDATED on the host bus for an existing type save', async () => {
		const received = [];
		const subscription = getHostToHostBus().subscribe((action) => {
			received.push(action);
		});
		try {
			await firstValueFrom(emitSystemEventEpic(of(contentTypeSaveSystemEvent(false, '123'))));
			const updated = received.filter((action) => action.type === contentTypeUpdated.type);
			assert.equal(updated.length, 1);
			assert.deepEqual(updated[0], contentTypeUpdated({ contentTypeId: '123' }));
		} finally {
			subscription.unsubscribe();
		}
	});
});
