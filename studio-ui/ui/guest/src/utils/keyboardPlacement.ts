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

import ContentType, { ValidationResult } from '@craftercms/studio-ui/models/ContentType';
import { ContentInstance } from '@craftercms/studio-ui/models/ContentInstance';
import { nullOrUndefined } from '@craftercms/studio-ui/utils/object';
import { processPathMacros } from '@craftercms/studio-ui/utils/path';
import { extractCollectionItem, value } from '@craftercms/studio-ui/utils/model';
import { ICERecord } from '../models/InContextEditing';
import { getById, getReferentialEntries, isTypeAcceptedAsByField, runValidation } from '../iceRegistry';
import {
	createContentInstance,
	getCachedContentItems,
	getCachedModels,
	getModelIdFromInheritedField,
	insertComponent,
	modelHierarchyMap
} from '../contentController';
import { getCollection, getParentModelId } from './ice';
import { isEditActionAvailable } from './util';

/**
 * Append position for a drop zone.
 * A nested field id (`items.components`) returns a dotted index (`2.5`).
 * `insertComponent` relies on piece (d)'s `resolveInsertIndex`, which reads the last
 * segment of that dotted index as the position inside the nested collection.
 */
export function appendIndexFromField(
	fieldId: string | null | undefined,
	index: number | string | null | undefined,
	length: number
): number | string {
	if (fieldId?.includes('.')) {
		return index == null || `${index}` === '' ? String(length) : `${index}.${length}`;
	}
	return length;
}

/**
 * Index passed to insertComponent / moveItem so the item is appended to the drop zone.
 * Matches the dotted index shape used by drag-and-drop when the field id is nested.
 */
export function appendIndexForDropZone(record: ICERecord): number | string {
	const { model, fieldId, index } = getReferentialEntries(record);
	const collection = getCollection(
		model,
		fieldId,
		fieldId?.includes('.') && index != null && `${index}` !== '' ? `${index}.0` : 0
	);
	const length = collection?.length ?? 0;
	return appendIndexFromField(fieldId, index, length);
}

/** Facts collected by `collectMoveTargets`. Null means the zone is a valid destination. */
export interface MoveTargetFacts {
	sameZone: boolean;
	symmetric: boolean;
	blocked: boolean;
	duplicate: boolean;
	hasElement: boolean;
	externallyModified: boolean;
	lockedByOther: boolean;
	typeAccepted: boolean;
}

export function moveTargetRefusal(facts: MoveTargetFacts): string | null {
	if (facts.sameZone) {
		return 'sameZone';
	}
	if (!facts.symmetric) {
		return 'asymmetric';
	}
	if (facts.blocked) {
		return 'blocked';
	}
	if (facts.duplicate) {
		return 'duplicate';
	}
	if (!facts.hasElement) {
		return 'missingElement';
	}
	if (facts.externallyModified || facts.lockedByOther) {
		return 'locked';
	}
	if (!facts.typeAccepted) {
		return 'notAccepted';
	}
	return null;
}

export function collectionLength(targetIndex: number | string): number {
	if (typeof targetIndex === 'number') {
		return targetIndex;
	}
	const parsed = parseInt(String(targetIndex).split('.').pop(), 10);
	return Number.isNaN(parsed) ? 0 : parsed;
}

export function isSymmetricIndex(fieldId: string, index: number | string | null | undefined): boolean {
	if (fieldId == null || index == null || `${index}` === '') {
		return false;
	}
	return fieldId.split('.').length === `${index}`.split('.').length;
}

/**
 * Path to lock before writing a drop zone. Inherited fields lock the ancestor model,
 * matching the inline-edit path in the guest drop epic.
 */
export function contentPathForIceRecord(record: ICERecord): string | null {
	const models = getCachedModels();
	const model = models[record.modelId];
	if (!model) {
		return null;
	}
	const parentModelId = getParentModelId(record.modelId, models, modelHierarchyMap);
	const ownPath = model.craftercms.path ?? models[parentModelId]?.craftercms.path ?? null;
	if (record.fieldId && model.craftercms.sourceMap?.[record.fieldId]) {
		const ancestorId = getModelIdFromInheritedField(record.modelId, record.fieldId);
		return models[ancestorId]?.craftercms.path ?? ownPath;
	}
	return ownPath;
}

export function zoneContainsInstance(record: ICERecord, instanceId: string): boolean {
	const { model, fieldId, index, field } = getReferentialEntries(record);
	const allowDuplicates = field?.validations?.allowDuplicates?.value ?? false;
	if (allowDuplicates || !instanceId) {
		return false;
	}
	const collection = nullOrUndefined(index) ? value(model, fieldId) : extractCollectionItem(model, fieldId, index);
	return Array.isArray(collection) && collection.includes(instanceId);
}

export type PlacementFailure = 'missing' | 'notEditable' | 'notAccepted' | 'max' | 'duplicate';

export type PlacementFailureResult = {
	ok: false;
	reason: PlacementFailure;
	validation?: ValidationResult;
};

export type PlacementSuccess = {
	ok: true;
	path: string;
	modelId: string;
	fieldId: string;
	targetIndex: number | string;
	instance?: ContentInstance;
	contentType?: ContentType;
	newComponentPath: string | null;
	shared: boolean;
	create: boolean;
};

export type PlacementResult = PlacementSuccess | PlacementFailureResult;

/**
 * Validation must finish before `beforeWrite$` locks the item.
 * A failure result is not lockable, so a rejected insert never calls `lock`.
 */
export function mayLockForPlacement(result: PlacementResult): result is PlacementSuccess {
	return result.ok === true;
}

/**
 * Edit, max-count and duplicate checks shared by the drop-target list and insert.
 * Does not lock and does not write.
 */
export function dropZoneBlocker(record: ICERecord, instance?: ContentInstance): PlacementFailureResult | null {
	if (!record?.fieldId) {
		return { ok: false, reason: 'missing' };
	}
	const models = getCachedModels();
	const parentModelId = getParentModelId(record.modelId, models, modelHierarchyMap);
	if (
		!isEditActionAvailable({
			record,
			models,
			contentItemsByPath: getCachedContentItems(),
			parentModelId
		})
	) {
		return { ok: false, reason: 'notEditable' };
	}
	const length = collectionLength(appendIndexForDropZone(record));
	const maxCount = runValidation(record.id, 'maxCount', [length]);
	if (maxCount) {
		return { ok: false, reason: 'max', validation: maxCount };
	}
	if (instance && zoneContainsInstance(record, instance.craftercms.id)) {
		return { ok: false, reason: 'duplicate' };
	}
	return null;
}

export function isAvailableKeyboardDropZone(record: ICERecord, instance?: ContentInstance): boolean {
	return dropZoneBlocker(record, instance) == null;
}

/**
 * Validates a keyboard insert. Does not lock and does not write.
 * `applyComponentPlacement` performs the write and must run only after the lock succeeds.
 */
export function validateComponentPlacement(
	iceId: number,
	contentType: ContentType,
	instance?: ContentInstance
): PlacementResult {
	const record = getById(iceId);
	if (!record) {
		return { ok: false, reason: 'missing' };
	}
	const blocked = dropZoneBlocker(record, instance);
	if (blocked) {
		return blocked;
	}
	const path = contentPathForIceRecord(record);
	if (!path) {
		return { ok: false, reason: 'missing' };
	}
	const entries = getReferentialEntries(record);
	const targetIndex = appendIndexForDropZone(record);
	if (instance) {
		if (!isTypeAcceptedAsByField(entries.field, instance.craftercms.contentTypeId, 'sharedExisting')) {
			return { ok: false, reason: 'notAccepted' };
		}
		return {
			ok: true,
			path,
			modelId: record.modelId,
			fieldId: record.fieldId,
			targetIndex,
			instance,
			newComponentPath: null,
			shared: true,
			create: false
		};
	}
	const createAsEmbedded = isTypeAcceptedAsByField(entries.field, contentType.id, 'embedded');
	const createAsShared = isTypeAcceptedAsByField(entries.field, contentType.id, 'shared');
	if (!createAsEmbedded && !createAsShared) {
		return { ok: false, reason: 'notAccepted' };
	}
	let newComponentPath: string | null = null;
	if (!createAsEmbedded) {
		newComponentPath =
			entries.contentType.dataSources?.find(
				(ds) =>
					ds.type === 'components' &&
					String(ds.properties?.contentTypes ?? '')
						.split(',')
						.includes(contentType.id)
			)?.properties?.baseRepoPath ?? null;
		newComponentPath = newComponentPath
			? processPathMacros({
					path: newComponentPath,
					objectId: record.modelId,
					useUUID: false,
					fullParentPath: path
				})
			: newComponentPath;
	}
	return {
		ok: true,
		path,
		modelId: record.modelId,
		fieldId: record.fieldId,
		targetIndex,
		contentType,
		newComponentPath,
		shared: !createAsEmbedded,
		create: true
	};
}

export function applyComponentPlacement(plan: PlacementSuccess): void {
	const instance = plan.create ? createContentInstance(plan.contentType, plan.newComponentPath) : plan.instance;
	insertComponent(plan.modelId, plan.fieldId, plan.targetIndex, instance, plan.shared, plan.create);
}
