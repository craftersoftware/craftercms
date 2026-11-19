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
import { merge, Subject } from 'rxjs';
import '../../../../test/registerTsLoader.mjs';

const { contentTypeSaveSystemEvent, editTypeSaveSuccessActions } = await import('./editTypeSaveSystemEvent.ts');
const { contentTypeCreated, contentTypeUpdated, emitSystemEvent } = await import('../../../state/actions/system.ts');
const { emitSystemEventEpic } = await import('../../../state/epics/system.ts');
const { batchActionsEpic } = await import('../../../state/epics/batchActions.ts');
const { getHostToHostBus } = await import('../../../utils/subjects.ts');
const { batchActions } = await import('../../../state/actions/misc.ts');

/**
 * Drives a Type Builder save-success batch through the same epic path production uses,
 * and returns whatever lands on the host-to-host bus.
 *
 * Steps:
 * 1. Run batchActionsEpic (flatten the batch) and emitSystemEventEpic (forward to the bus).
 * 2. Feed epic outputs back into action$ so flattened emitSystemEvent actions are handled.
 * 3. Dispatch batchActions(editTypeSaveSuccessActions(...)) as EditTypeView does after save.
 * 4. Collect host-bus publishes, then tear down subscriptions.
 */
function runSaveSuccessThroughHostBus(isNew: boolean, contentTypeId: string) {
	const action$ = new Subject();
	const epicOut$ = merge(batchActionsEpic(action$), emitSystemEventEpic(action$));
	const feedback = epicOut$.subscribe((action) => action$.next(action));
	const received = [];
	const busSub = getHostToHostBus().subscribe((action) => received.push(action));
	action$.next(batchActions(editTypeSaveSuccessActions(isNew, contentTypeId, 'Save successful.')));
	feedback.unsubscribe();
	busSub.unsubscribe();
	return received;
}

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
});

describe('editTypeSaveSuccessActions', () => {
	it('includes exactly one contentTypeSaveSystemEvent for an existing type', () => {
		const actions = editTypeSaveSuccessActions(false, '123', 'Save successful.');
		const systemEvents = actions.filter((action) => action.type === emitSystemEvent.type);
		assert.equal(systemEvents.length, 1);
		assert.deepEqual(systemEvents[0], contentTypeSaveSystemEvent(false, '123'));
	});

	it('publishes exactly one CONTENT_TYPE_UPDATED on the host bus per existing-type save', () => {
		const received = runSaveSuccessThroughHostBus(false, '123');
		const updated = received.filter((action) => action.type === contentTypeUpdated.type);
		assert.equal(updated.length, 1);
		assert.deepEqual(updated[0], contentTypeUpdated({ contentTypeId: '123' }));
	});
});
