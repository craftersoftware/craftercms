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
import { processPathMacros } from '@craftercms/studio-ui/utils/path';
import { ICERecord } from '../models/InContextEditing';
import { getById, getReferentialEntries, isTypeAcceptedAsByField, runValidation } from '../iceRegistry';
import {
	createContentInstance,
	getCachedContentItems,
	getCachedModels,
	insertComponent,
	modelHierarchyMap
} from '../contentController';
import { getCollection, getParentModelId } from './ice';
import { isEditActionAvailable } from './util';

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
	if (fieldId?.includes('.')) {
		return index == null || `${index}` === '' ? String(length) : `${index}.${length}`;
	}
	return length;
}

export function isSymmetricIndex(fieldId: string, index: number | string | null | undefined): boolean {
	if (fieldId == null || index == null || `${index}` === '') {
		return false;
	}
	return fieldId.split('.').length === `${index}`.split('.').length;
}

export type PlacementFailure = 'missing' | 'notEditable' | 'notAccepted' | 'max';

export type PlacementResult = { ok: true } | { ok: false; reason: PlacementFailure; validation?: ValidationResult };

/**
 * Inserts a new or existing component at the end of a drop zone.
 * Caller is responsible for locking (beforeWrite$) first.
 */
export function placeComponentAtDropZone(
	iceId: number,
	contentType: ContentType,
	instance?: ContentInstance
): PlacementResult {
	const record = getById(iceId);
	if (!record?.fieldId) {
		return { ok: false, reason: 'missing' };
	}
	const models = getCachedModels();
	const parentModelId = getParentModelId(record.modelId, models, modelHierarchyMap);
	const path = models[record.modelId]?.craftercms.path ?? models[parentModelId]?.craftercms.path;
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
	const entries = getReferentialEntries(record);
	const targetIndex = appendIndexForDropZone(record);
	const length = typeof targetIndex === 'number' ? targetIndex : parseInt(String(targetIndex).split('.').pop(), 10);
	const maxCount = runValidation(iceId, 'maxCount', [Number.isNaN(length) ? 0 : length]);
	if (maxCount) {
		return { ok: false, reason: 'max', validation: maxCount };
	}
	if (instance) {
		if (!isTypeAcceptedAsByField(entries.field, instance.craftercms.contentTypeId, 'sharedExisting')) {
			return { ok: false, reason: 'notAccepted' };
		}
		insertComponent(record.modelId, record.fieldId, targetIndex, instance, true);
		return { ok: true };
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
	const created = createContentInstance(contentType, newComponentPath);
	insertComponent(record.modelId, record.fieldId, targetIndex, created, !createAsEmbedded, true);
	return { ok: true };
}
