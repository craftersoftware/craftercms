/*
 * Copyright (C) 2007-2022 Crafter Software Corporation. All Rights Reserved.
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

import * as contentController from './contentController';
import { DEFAULT_RECORD_DATA } from './utils/util';
import * as contentTypeUtils from '@craftercms/studio-ui/utils/contentType';
import * as Model from '@craftercms/studio-ui/utils/model';
import { ContentInstance } from '@craftercms/studio-ui/models/ContentInstance';
import type {
	ContentType,
	ContentTypeField,
	ValidationKeys,
	ValidationResult
} from '@craftercms/studio-ui/models/ContentType';
import { LookupTable } from '@craftercms/studio-ui/models/LookupTable';
import { ICEProps, ICERecord, ICERecordRegistration, ReferentialEntries } from './models/InContextEditing';
import { notNullOrUndefined, nou, nullOrUndefined, pluckProps } from '@craftercms/studio-ui/utils/object';
import { forEach } from '@craftercms/studio-ui/utils/array';
import { determineRecordType, findComponentContainerFields, resolvePlacementForZone } from './utils/ice';
import { isSimple, removeLastPiece } from '@craftercms/studio-ui/utils/string';
import { ModelHierarchyMap } from '@craftercms/studio-ui/utils/content';
import { Observer, Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { AllowedContentTypesData } from '@craftercms/studio-ui/models/AllowedContentTypesData';

/** Functions return nullish if everything is fine */
const validationChecks: Partial<Record<ValidationKeys, Function>> = {
	minCount(id, minCount, level, length) {
		if (length < minCount) {
			return {
				id,
				level,
				values: { minCount }
			};
		} else {
			return null;
		}
	},
	maxCount(id, maxCount, level, length) {
		if (length >= maxCount) {
			return {
				id,
				level,
				values: { maxCount }
			};
		} else {
			return null;
		}
	}
};

let rid = 0;

/* private */
export const registry: Map<number, ICERecord> = new Map();

let refCount: LookupTable<number> = {};

export interface AllowedContentTypesLookup {
	result: LookupTable<AllowedContentTypesData> | null;
	/**
	 * Various instances of the content type can be present
	 */
	recordIdKeyLookup: LookupTable<string>;
	allowedLookup: LookupTable<{ recordIds: number[]; data: Partial<AllowedContentTypesData> }>;
}

const allowedContentTypesData: AllowedContentTypesLookup = {
	// Consolidated list of allowed content types in all modes allowed
	/* { [`{contentTypeId}`]: { embedded?: true, shared?: true, sharedExisting?: true } } */
	result: null,
	/* [recordId]: `{contentTypeId}:{fieldId}` */
	recordIdKeyLookup: {},
	/* [`{contentTypeId}:{fieldId}`]: {
    recordIds: []
    data: { [typeId]: { embedded?: true, shared?: true, sharedExisting?: true } },
  } */
	allowedLookup: {}
};

const createAllowedContentTypesLookupKey = (contentTypeId: string, fieldId: string) => `${contentTypeId}:${fieldId}`;
const allowedContentTypes$ = new Subject<AllowedContentTypesLookup['result']>();

export function register(registration: ICERecordRegistration): number {
	// For consistency, set `fieldId` and `index` props
	// to null for records that don't include those values
	const data = Object.assign({}, DEFAULT_RECORD_DATA, pluckProps(registration, true, 'modelId', 'fieldId', 'index'));

	if (nullOrUndefined(data.modelId)) {
		throw new Error(
			`ICE component registration requires a model ID to be supplied. Supplied model id was ${data.modelId}.`
		);
	} else if (
		notNullOrUndefined(data.fieldId) &&
		nullOrUndefined(data.index) &&
		contentTypeUtils.isGroupItem(getReferentialEntries(data).contentType, data.fieldId)
	) {
		throw new Error(
			'Repeating group item registration requires the index within the repeating group to be supplied. ' +
				`Please supply index for '${data.fieldId}' of the ${getReferentialEntries(data).contentType.name} model.`
		);
	}

	const id = exists(data);
	if (id !== null) {
		// TODO: Risk
		// Though more efficient to just keep a refCount
		// clients mistakenly calling deregister multiple
		// times would set things off. The alternative was
		// having slave records.

		const record = getById(id);
		refCount[id]++;

		return record.id;
	} else {
		const record: ICERecord = { ...data, id: rid++ };
		const entities = getReferentialEntries(record);
		const field = entities.field;

		// Record coherence validation
		if (notNullOrUndefined(entities.fieldId) && nullOrUndefined(field)) {
			console.error(
				`[ICERegistry] Field "${entities.fieldId}" was not found on the "${entities.contentType.name}" content type. ` +
					`Please check the field name matches one of the content type field names ` +
					`(${Object.keys(entities.contentType.fields).join(', ')})`
			);
		}

		record.recordType = determineRecordType(entities);

		if (
			record.recordType === 'field' &&
			// Null check field in case of a wrong field name in the registration.
			field?.type === 'node-selector' &&
			field.validations.allowedContentTypes
		) {
			const key = createAllowedContentTypesLookupKey(entities.contentTypeId, entities.fieldId);
			if (!allowedContentTypesData.allowedLookup[key]) {
				const validations = field.validations;
				allowedContentTypesData.allowedLookup[key] = {
					data: validations.allowedContentTypes.value,
					recordIds: []
				};
			}
			allowedContentTypesData.recordIdKeyLookup[record.id] = key;
			allowedContentTypesData.allowedLookup[key].recordIds.push(record.id);
		}
		// Invoking all the time so that the `allowedContentTypes$` subject emits either way.
		// Not emitting could cause UIs to be stuck in a loading state.
		collectAndEmitAllowedContentTypes();

		registry.set(record.id, record);
		refCount[record.id] = 1;

		return record.id;
	}
}

export function deregister(id: number): ICERecord {
	const record = registry.get(id);
	if (!record) return null;
	if (refCount[id] === 1) {
		registry.delete(id);
	} else {
		refCount[id]--;
	}
	let key = allowedContentTypesData.recordIdKeyLookup[id];
	if (key) {
		delete allowedContentTypesData.recordIdKeyLookup[id];
		if (
			// If everything is fitting correctly, if only one is left, it should be this record that's being deleted.
			allowedContentTypesData.allowedLookup[key].recordIds.length === 1
		) {
			delete allowedContentTypesData.allowedLookup[key];
		} else {
			allowedContentTypesData.allowedLookup[key].recordIds = allowedContentTypesData.allowedLookup[
				key
			].recordIds.filter((recId) => recId !== id);
		}
		collectAndEmitAllowedContentTypes();
	}
	return record;
}

export function exists(data: Partial<ICEProps>): number {
	for (const [, record] of registry) {
		if (
			record.modelId === data.modelId &&
			record.fieldId === data.fieldId &&
			(nou(data.index) || nou(record.index) ? record.index === data.index : String(record.index) === String(data.index))
		) {
			return record.id;
		}
	}
	return null;
}

export function getById(id: number | string): ICERecord {
	if (nou(id)) return null;
	id = typeof id === 'string' ? parseInt(id) : id;
	return registry.get(id);
}

export function isRepeatGroup(id: number): boolean {
	const { field, recordType } = getReferentialEntries(id);
	return recordType === 'field' && field.type === 'repeat';
}

export function isRepeatGroupItem(id: number): boolean {
	const record = getById(id);
	return record.recordType === 'repeat-item';
}

export function getMediaDropTargets(type: string): ICERecord[] {
	const dropTargets = [];
	for (const [, record] of registry) {
		const entries = getReferentialEntries(record);
		if (entries.field?.type === type) {
			dropTargets.push(record);
		}
	}
	return dropTargets;
}

export function getRecordDropTargets(id: number): ICERecord[] {
	const record = getById(id);
	const { index, field, fieldId, model } = getReferentialEntries(record);
	// With components, the model lookup contains ids of each of the components, in cases like repeat groups and files,
	// the model lookup contains the actual model of the file/repeat group.
	const isModelId = model[fieldId]?.every((id) => typeof id === 'string');
	if (nullOrUndefined(index)) {
		// Can't move something that's not part of a collection.
		// Collection items will always have an index.
		return [];
	} else if (field.type === 'node-selector' && isModelId) {
		// Get content type of item
		const models = contentController.getCachedModels();
		const id = Model.extractCollectionItem(model, fieldId, index);
		const nestedModel = models[id];
		const contentType = Model.getContentTypeId(nestedModel);
		const hierarchyMap = contentController.modelHierarchyMap;
		const allChildren = [];

		function flattenChildren(id: string, accum: string[]) {
			if (hierarchyMap[id].children.length) {
				accum.push(...hierarchyMap[id].children);
				hierarchyMap[id].children.forEach((child) => flattenChildren(child, accum));
			}
		}

		flattenChildren(id, allChildren);

		return getContentTypeDropTargets(contentType, (rec) => {
			// Exclude if it's the current item or a descendant of it (i.e. can't
			// move an item deeper inside itself).
			return rec.modelId === id || allChildren.includes(rec.modelId);
		});
	} else if (field.type === 'repeat' || (field.type === 'node-selector' && !isModelId)) {
		return getRepeatGroupItemDropTargets(record);
	} else {
		console.error('[ICERegistry/getRecordDropTargets] Unhandled path');
		return [];
	}
}

export function getRepeatGroupItemDropTargets(repeatItemRecord: ICERecord): ICERecord[] {
	const records = registry.values();
	for (const record of records) {
		if (
			// not the present record
			record.id !== repeatItemRecord.id &&
			// same field and model
			record.fieldId === repeatItemRecord.fieldId &&
			record.modelId === repeatItemRecord.modelId
		) {
			if (isSimple(repeatItemRecord.index)) {
				// if the item's index is simple (no dot notation), the parent record wouldn't have an index
				// must have this as separate if statement as the item's index can be simple but the current
				// record not be the one with the null index in which case, it shouldn't fall on the else.
				if (nullOrUndefined(record.index)) {
					return [record];
				}
			} else if (
				// if the item's index isn't simple, the parent record index should be the item's index minus
				// the last piece (e.g. item.index = 1.2, parent.index = 1)
				removeLastPiece(repeatItemRecord.index as string) === String(record.index)
			) {
				return [record];
			}
		}
	}
	console.error(
		'[IceRegistry/getRepeatGroupItemDropTargets] ' +
			'No drop target found for repeat group item. Repeat group items should always have a drop target. ' +
			'Check that the repeat group itself was registered and that the item in question is a repeat group item. ' +
			'Repeat item in question attached.',
		repeatItemRecord
	);
	return [];
}

export function getComponentItemDropTargets(record: ICERecord): number[] {
	const contentType = getReferentialEntries(record).contentType;
	return getContentTypeDropTargets(contentType).map((rec) => rec.id);
}

/**
 * Returns a list of ICE records that matches a content type
 * @param contentType {string | ContentType} The content type that the records should match.
 * @param excludeFn {(record: ICERecord, hierarchyMap: ModelHierarchyMap) => boolean} function that returns true if record has to be excluded, and false it not.
 * @param createMode {embedded | shared | sharedExisting | Array<embedded | shared | sharedExisting>} Check if the content is accepted based on a particular storage format (i.e. shared or embedded)
 */
export function getContentTypeDropTargets(
	contentType: string | ContentType,
	excludeFn?: (record: ICERecord, hierarchyMap: ModelHierarchyMap) => boolean,
	createMode?: CreateMode | CreateMode[] | undefined
): ICERecord[] {
	const contentTypeId = typeof contentType === 'string' ? contentType : contentType.id;
	return Array.from(registry.values()).filter((record) => {
		const { fieldId, index } = record;
		if (nullOrUndefined(fieldId) || excludeFn?.(record, contentController.modelHierarchyMap)) {
			return false;
		}
		const { field, contentType: _contentType, model } = getReferentialEntries(record);
		if (!isTypeAcceptedAsByField(field, contentTypeId, createMode)) {
			return false;
		} else if (nullOrUndefined(index)) {
			return true;
		}
		// At this point, this field has been identified as accepting the content type
		// but the record has an index. If it has an index, it may still be a nested component
		// holder (node-selector).
		return (
			// Check that the field in question is a node-selector
			contentTypeUtils.isComponentHolder(_contentType, fieldId) &&
			// If it is an array, it is a receptacle, otherwise it's an item:
			// If it is a node selector, it may be an item of the node selector or a node
			// selector itself. Node selectors themselves will be arrays. If it's a value of the
			// node selector it would be a string representing an id of a model held by the node
			// selector.
			Array.isArray(Model.extractCollectionItem(model, fieldId, index))
		);
	});
}

export type CreateMode = 'embedded' | 'shared' | 'sharedExisting';

/**
 * Checks if a content type is accepted (as shared, embedded or at-all) by a specific receiver field
 * @param receiverField {ContentTypeField}
 * @param contentTypeId {string}
 * @param createMode {embedded | shared | sharedExisting | Array<embedded | shared | sharedExisting>}
 */
export function isTypeAcceptedAsByField(
	receiverField: ContentTypeField,
	contentTypeId: string,
	// shared == sharedNew, sharedExisting
	createMode?: CreateMode | CreateMode[] | undefined
): boolean {
	const processCreateMode = (mode: CreateMode) =>
		(mode === 'shared'
			? receiverField?.validations?.allowedSharedContentTypes?.value
			: mode === 'embedded'
				? receiverField?.validations?.allowedEmbeddedContentTypes?.value
				: mode === 'sharedExisting'
					? receiverField?.validations?.allowedSharedExistingContentTypes?.value
					: Object.keys(receiverField?.validations?.allowedContentTypes?.value ?? {})) ?? [];
	let acceptedTypes: string[] = Array.isArray(createMode)
		? createMode.flatMap((mode) => processCreateMode(mode))
		: processCreateMode(createMode);
	return acceptedTypes.some((typeId) => typeId === contentTypeId || typeId === '*');
}

export function runDropTargetsValidations(dropTargets: ICERecord[]): LookupTable<LookupTable<ValidationResult>> {
	const lookup = {};
	dropTargets.forEach((record) => {
		const validationResult = {};
		const { fieldId, index } = record;
		let { field: { validations = [] } = {}, model } = getReferentialEntries(record);
		const collection = Model.extractCollectionItem(model, fieldId, index);
		Object.keys(validations).forEach((key) => {
			const validation = validations[key];
			switch (validation.id) {
				case 'minCount': {
					if (validation.value && collection.length < validation.value) {
						validationResult[validation.id] = {
							id: validation.id,
							level: validation.level,
							values: { min: validation.value }
						};
					}
					break;
				}
				case 'maxCount': {
					if (validation.value && collection.length >= validation.value) {
						validationResult[validation.id] = {
							id: validation.id,
							level: validation.level,
							values: { max: validation.value }
						};
					}
					break;
				}
				default:
					break;
			}
		});
		lookup[record.id] = validationResult;
	});
	return lookup;
}

export function runValidation(iceId: number, validationId: ValidationKeys, args?: unknown[]): ValidationResult {
	const record = getById(iceId);
	const validations = getReferentialEntries(record).field?.validations;
	if (validations?.[validationId]) {
		return validationChecks[validationId]?.(...[...Object.values(validations[validationId]), ...args]);
	} else {
		return null;
	}
}

export function getReferentialEntries(record: number | ICERecord): ReferentialEntries {
	record = typeof record === 'object' ? record : getById(record);
	let model = contentController.getCachedModel(record.modelId);
	let contentTypeId = Model.getContentTypeId(model);
	let contentType = contentController.getCachedContentType(contentTypeId);
	let field = record.fieldId
		? contentTypeUtils.getField(contentType, record.fieldId, contentController.getCachedContentTypes())
		: null;

	if (!field && record.fieldId && model.craftercms.sourceMap?.[record.fieldId]) {
		model = contentController.getContentInstanceByPath(model.craftercms.sourceMap[record.fieldId]);
		contentTypeId = Model.getContentTypeId(model);
		contentType = contentController.getCachedContentType(contentTypeId);
		field = record.fieldId ? contentTypeUtils.getField(contentType, record.fieldId) : null;
	}

	return {
		...record,
		model,
		field,
		contentType,
		contentTypeId
	};
}

export function getRecordField(record: ICERecord): ContentTypeField {
	return getReferentialEntries(record).field;
}

export function isMovable(id: number): boolean {
	const { field } = getReferentialEntries(id);
	return isMovableType(id) && field.sortable;
}

export function isMovableType(id: number): boolean {
	const { recordType } = getById(id);
	return recordType === 'node-selector-item' || recordType === 'repeat-item';
}

export function getMovableParentRecord(id: number, contextElement?: Element): number {
	const { recordType, modelId, index, fieldId } = getReferentialEntries(id);
	if (isMovableType(id)) {
		return id;
	} else if (recordType === 'field' || recordType === 'component') {
		if (isSimple(fieldId)) {
			// Can be...
			// - Field of a component (possible move target)
			// - Field of a page
			// - Bare component (fieldId null/undefined); shared components may have multiple placements
			const placement = resolvePlacementForZone(
				modelId,
				contextElement,
				contentController.getCachedModels(),
				contentController.getCachedContentTypes(),
				contentController.modelHierarchyMap
			);
			return placement
				? exists({
						modelId: placement.parentId,
						fieldId: placement.parentContainerFieldPath,
						index: placement.parentContainerFieldIndex
					})
				: null;
		} else {
			// It means the field is a child of a repeat item
			// looking for the parent item of the field
			return exists({
				modelId: modelId,
				fieldId: removeLastPiece(fieldId),
				index: index
			});
		}
	}
	return null;
}

export function collectMoveTargets(): ICERecord[] {
	const movableRecords = [];
	registry.forEach((record) => {
		const recordType = record.recordType;
		if (recordType === 'node-selector-item' || recordType === 'repeat-item') {
			movableRecords.push(record);
		}
	});
	return movableRecords;
}

export function checkComponentMovability(entries: ReferentialEntries): boolean {
	// Can't move if
	// - no other zones
	// - other zones are maxed out
	// - leaving current zone would violate minimum

	if (entries.field?.type !== 'node-selector') {
		return false;
	}

	const records = Array.from(registry.values());

	let parentField, parentModelId, parentCollection, minCount;

	// Find the parent field and it's respective container collection
	// The array in which this model is listed on.

	for (let i = 0, l = records.length; i < l; i++) {
		if (records[i].id === entries.id) {
			continue;
		}
		const record = getReferentialEntries(records[i]);
		if (nullOrUndefined(record.field)) {
			if (notNullOrUndefined(record.index)) {
				// Collection item record. Cannot be the container.
			} else {
				// Is a component...
				// - get model fields
				// - check if one of the fields has this value
				const children = contentController.modelHierarchyMap[record.modelId]?.children;
				if (children?.includes(entries.modelId)) {
					parentModelId = record.modelId;
					const containers = findComponentContainerFields(record.contentType.fields),
						field = findContainerField(record.model, containers, entries.modelId);
					if (notNullOrUndefined(field)) {
						parentField = field;
						parentCollection = Model.prop(record.model, field.id);
						break;
					}
				}
			}
		} else if (record.field.type === 'node-selector') {
			const value = Model.value(record.model, record.fieldId);
			if (value.includes(entries.modelId) || value === entries.modelId) {
				parentField = record.field;
				parentModelId = record.modelId;
				parentCollection = value;
				break;
			}
		}
	}

	if (!parentField) {
		throw new Error(
			`Unable to find the parent field for instance "${entries.modelId}" of ` +
				`${entries.contentType.name} component${entries.fieldId ? ` (${entries.fieldId} field)` : ''}. ` +
				'Did you forget to declare the field when creating the content type?\n' +
				'Check the state of the model data this could mean the data is corrupted.'
		);
	}

	const found = forEach(
		records,
		(record) => {
			if (record.modelId === parentModelId && record.fieldId === parentField.id) {
				return true;
			}
		},
		false
	);

	if (!found) {
		const componentName = `'${entries.contentType.name} ${
			entries.contentType.name.toLowerCase().includes('component') ? "'" : "Component' "
		}`;
		console.warn(
			`Per definition the ${componentName} is sortable but a drop zone for it was not found. ` +
				'Did you forget to register the zone? Please initialize the drop zone element(s) of ' +
				`the ${componentName} with modelId="${parentModelId}" and fieldId="${parentField.id}".`
		);
		return false;
	}

	minCount = (parentField.validations && parentField.validations.minCount) || 0;

	if (parentField.type === 'node-selector') {
		return (
			(parentField.sortable &&
				// If there are more adjacent items on this zone to be able to
				// move current guy before/after
				parentCollection.length > 1) ||
			// Would moving the guy away from this zone violate it's minCount?
			(parentCollection.length - 1 >= minCount &&
				// Does anybody else accept this type of component?
				getComponentItemDropTargets(entries).length > 0)
		);
	} else {
		return (
			// Moving this component would make the parent field value null/blank
			// If the parent field is not required that should be ok
			!parentField.required &&
			// Is this guy accepted elsewhere?
			getComponentItemDropTargets(entries).length > 0
		);
	}
}

export function checkRepeatGroupMovability(entries: ReferentialEntries): boolean {
	const { model, field, index } = entries;
	return (
		field?.type === 'repeat' &&
		field.sortable &&
		// `index` must be a valid number. nullish value
		// may mean it's not a group item but rather the group
		// container
		notNullOrUndefined(index) &&
		// No point making movable an item that can't jump
		// zones and doesn't have any adjacent items to move it
		// next to.
		// TODO: What about DnD trashing, though?
		Model.value(model, field.id).length > 1
	);
}

export function findContainerField(
	model: ContentInstance,
	fields: ContentTypeField[],
	modelId: string
): ContentTypeField {
	return forEach(fields, (field) => {
		const value = Model.value(model, field.id);
		if (field.type === 'node-selector' && (value === modelId || value.includes(modelId))) {
			return field;
		} else if (field.type === 'repeat') {
			// TODO ...
		}
	});
}

export function flush(): void {
	registry.clear();
	refCount = {};
	allowedContentTypesData.recordIdKeyLookup = {};
	allowedContentTypesData.allowedLookup = {};
	allowedContentTypesData.result = null;
}

export function findContainerRecord(modelId: string, fieldId: string, index: string | number): ICERecord {
	let recordId;
	if (isSimple(fieldId)) {
		recordId = exists({
			modelId: modelId,
			fieldId: fieldId ?? null,
			index: null
		});
	} else {
		recordId = exists({
			modelId: modelId,
			fieldId: fieldId ?? null,
			index: parseInt(removeLastPiece(index as string))
		});
	}
	return notNullOrUndefined(recordId) ? getById(recordId) : null;
}

export function findChildRecord(modelId: string, fieldId: string, index: string | number): ICERecord {
	const hierarchyMap = contentController.modelHierarchyMap;
	const mapItem = hierarchyMap[modelId];
	if (mapItem) {
		for (const childId of mapItem.children) {
			const entry = hierarchyMap[childId];
			if (
				entry.parentId === modelId &&
				entry.parentContainerFieldPath === fieldId &&
				String(entry.parentContainerFieldIndex) === String(index)
			) {
				const recordId = exists({ modelId: entry.modelId, fieldId: null, index: null });
				return notNullOrUndefined(recordId) ? getById(recordId) : null;
			}
		}
	}
	return null;
}

export function getRegistry() {
	return registry;
}

function collectAndEmitAllowedContentTypes(): void {
	clearTimeout(collectAndEmitAllowedContentTypes.timeout);
	collectAndEmitAllowedContentTypes.timeout = setTimeout(() => {
		const result: LookupTable<AllowedContentTypesData> = {};
		const allowedLookup = allowedContentTypesData.allowedLookup;
		// Iterate through the data of each typeId:fieldId pair
		for (let key in allowedLookup) {
			const allowed = allowedContentTypesData.allowedLookup[key].data;
			// Iterate through each type id allowed by this field of the current typeId:fieldId
			for (let typeId in allowed) {
				result[typeId] = result[typeId] ?? {};
				Object.assign(result[typeId], allowed[typeId]);
			}
		}
		allowedContentTypesData.result = result;
		allowedContentTypes$.next(result);
	}, 500);
}

collectAndEmitAllowedContentTypes.timeout = null;

export function getAllowedContentTypes(): AllowedContentTypesData {
	return allowedContentTypesData.result;
}

export function subscribeToAllowedContentTypes(
	observerOrNext:
		| Partial<Observer<LookupTable<AllowedContentTypesData>>>
		| ((value: LookupTable<AllowedContentTypesData>) => void)
): Subscription {
	return allowedContentTypes$.subscribe(observerOrNext);
}
