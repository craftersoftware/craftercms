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

import { BehaviorSubject, merge, Observable, of, Subject } from 'rxjs';
import { filter, map, switchMap, take, tap } from 'rxjs/operators';
import * as Model from '@craftercms/studio-ui/utils/model';
import { extractCollectionPiece } from '@craftercms/studio-ui/utils/model';
import Cookies from 'js-cookie';
import { fromTopic, post } from './utils/communicator';
import { v4 as uuid } from 'uuid';
import { ContentInstance, InstanceRecord } from '@craftercms/studio-ui/models/ContentInstance';
import type { ContentType } from '@craftercms/studio-ui/models/ContentType';
import { LookupTable } from '@craftercms/studio-ui/models/LookupTable';
import { Operation } from './models/Operations';
import {
	contentTypesResponse,
	deleteItemOperation,
	duplicateItemOperation,
	fetchGuestModel,
	fetchGuestModelComplete,
	insertComponentOperation,
	insertItemOperation,
	moveItemOperation,
	sortItemOperation,
	updateFieldValueOperation,
	updateFieldValueOperationComplete
} from '@craftercms/studio-ui/state/actions/preview';
import { createLookupTable, nnou, nou } from '@craftercms/studio-ui/utils/object';
import { isSimple, popPiece, removeLastPiece } from '@craftercms/studio-ui/utils/string';
import { getCollection, getCollectionWithoutItemAtIndex, getParentModelId, setCollection } from './utils/ice';
import { resolveInsertIndex } from './utils/resolveInsertIndex';
import { createQuery, search } from '@craftercms/search';
import { parseDescriptor, preParseSearchResults } from '@craftercms/content';
import { crafterConf } from '@craftercms/classes';
import { getDefaultValue } from '@craftercms/studio-ui/utils/contentType';
import { ModelHierarchyDescriptor, ModelHierarchyMap, modelsToLookup } from '@craftercms/studio-ui/utils/content';
import { ContentItem, StandardAction } from '@craftercms/studio-ui/models';
import { fetchContentItemComplete } from '@craftercms/studio-ui/state/actions/content';

// if (process.env.NODE_ENV === 'development') {
// TODO: Notice
// Not so sure about this assumption. Maybe best to just leave it up to the consumer
// app to set the crafter URL via `crafterConf` if it wants something different?
typeof window !== 'undefined' &&
	crafterConf.getConfig().baseUrl === '' &&
	crafterConf.configure({
		baseUrl: window.location.hostname === 'localhost' ? 'http://localhost:8080' : window.location.origin,
		site: Cookies.get('crafterSite')
	});
// }

const operations$ = new Subject<Operation>();

const operationsObs$ = operations$.asObservable();

export const modelHierarchyMap: ModelHierarchyMap = {
	/* [id]: [id, id, id] */
};

let requestedPaths = {};

const paths$ = new BehaviorSubject<LookupTable<string>>({
	/* 'path': 'modelId' */
});

const models$ = new BehaviorSubject<LookupTable<ContentInstance>>({
	/* 'modelId': { ...modelData } */
});

const items$ = new BehaviorSubject<LookupTable<ContentItem>>({
	/* 'path': { ...contentItem } */
});

const permissions$ = new BehaviorSubject<string[]>([]);

const contentTypes$ = new BehaviorSubject<LookupTable<ContentType>>({
	/* 'contentTypeId': { ...contentTypeData } */
});

// Share operator makes the behaviour subject's behaviour go away. New subscribers
// don't receive the latest value as soon as they subscribe. Would need to multicast
// to be able to continue using share
const notEmpty = (objects) => Object.keys(objects).length > 0;
const modelsObs$ = models$.pipe(filter(notEmpty));
const contentTypesObs$ = contentTypes$.pipe(filter(notEmpty));
const pathsObs$ = paths$.pipe(filter(notEmpty));

export { operationsObs$ as operations$, modelsObs$ as models$, contentTypesObs$ as contentTypes$, pathsObs$ as paths$ };

// region Models

export function model$(modelId: string): Observable<ContentInstance> {
	return models$.pipe(
		map((models) => models[modelId]),
		filter((model) => Boolean(model))
	);
}

export function hasCachedModel(modelId: string): boolean {
	return Boolean(models$.value[modelId]);
}

export function getCachedModel(modelId: string): ContentInstance {
	return models$.value[modelId];
}

export function getCachedModels(): LookupTable<ContentInstance> {
	return models$.value;
}

export function getCachedModelsByPath(): LookupTable<string> {
	return paths$.value;
}

export function getCachedContentItems(): LookupTable<ContentItem> {
	return items$.value;
}

export function getCachedContentItem(path: string): ContentItem {
	return items$.value[path];
}

export function getCachedPermissions(): string[] {
	return permissions$.value;
}

export function fetchById(id: string): Observable<LookupTable<ContentInstance>> {
	return search(
		createQuery({
			query: {
				bool: {
					filter: [
						{
							bool: {
								should: {
									multi_match: {
										query: id,
										fields: ['*objectId']
									}
								}
							}
						}
					]
				}
			}
		}),
		// TODO: Remove hardcoded url
		crafterConf.getConfig()
	).pipe(
		// @ts-ignore - TODO: Upgrade SDK to rxjs@7
		tap(({ total }) => total === 0 && console.log(`[ContentController/fetchById] Model with id ${id} not found.`)),
		map<any, ContentInstance[]>(({ hits }) =>
			hits.map(({ _source }) => parseDescriptor(preParseSearchResults(_source)))
		),
		map(modelsToLookup)
	);
}

export function byPathFetchIfNotLoaded(path: string): Observable<ContentInstance> {
	if (nou(path)) {
		return of(null);
	} else if (requestedPaths[path]) {
		return paths$.pipe(
			filter((paths) => Boolean(paths[path])),
			take(1),
			map((paths) => models$.value[paths[path]])
		);
	} else {
		requestedPaths[path] = true;
		return fetchByPath(path).pipe(map((data) => data?.model));
	}
}

export function getContentInstanceByPath(path: string): ContentInstance {
	let modelId = paths$.value[path];
	return models$.value[modelId];
}

export function isInheritedField(modelId: string, fieldId: string): boolean {
	return !!getCachedModel(modelId).craftercms.sourceMap?.[fieldId];
}

export function getModelIdFromInheritedField(modelId: string, fieldId): string {
	const levelDescriptorPath = models$.value[modelId].craftercms.sourceMap?.[fieldId];
	if (levelDescriptorPath) {
		return getContentInstanceByPath(levelDescriptorPath).craftercms.id;
	} else {
		return modelId;
	}
}

export function fetchByPath(
	path: string
): Observable<{ model: ContentInstance; modelLookup: LookupTable<ContentInstance> }> {
	return of('nothing').pipe(
		tap(() => post(fetchGuestModel({ path }))),
		switchMap(() =>
			fromTopic(fetchGuestModelComplete.type).pipe(
				map((e) => e?.payload),
				filter((payload) => payload.path === path),
				take(1)
			)
		)
	);
}

export function flushRequestedPaths(): void {
	requestedPaths = {};
}

// endregion

// region Content Types

export function hasCachedContentType(contentTypeId: string): boolean {
	return Boolean(contentTypes$.value[contentTypeId]);
}

export function getCachedContentType(contentTypeId: string): ContentType {
	return contentTypes$.value[contentTypeId];
}

export function getCachedContentTypes(): LookupTable<ContentType> {
	return contentTypes$.value;
}

// endregion

// To propagate the update up the model tree for
// reference based UI rendering libraries.
function collectReferrers(modelId) {
	const models = getCachedModels();
	const parentModels = [];
	const modelsToUpdate = {};
	let currentID = getParentModelId(modelId, models, modelHierarchyMap);
	while (currentID) {
		parentModels.push(currentID);
		currentID = getParentModelId(currentID, models, modelHierarchyMap);
	}
	parentModels.forEach((id) => (modelsToUpdate[id] = { ...models[id] }));
	return modelsToUpdate;
}

function updateHierarchyMapIndexesFromCollection(collection: string[]) {
	if (collection.length) {
		const firstEntry = modelHierarchyMap[collection[0]];
		if (!firstEntry) {
			return;
		}
		const isSimpleIndex = isSimple(firstEntry.parentContainerFieldIndex);
		// 1. Update item being sorted and items getting displaced because of that sort
		collection.forEach(
			isSimpleIndex
				? (id, index) => {
						if (modelHierarchyMap[id]) {
							modelHierarchyMap[id].parentContainerFieldIndex = String(index);
						}
					}
				: (id, index) => {
						const entry = modelHierarchyMap[id];
						if (!entry) return;
						const current = entry.parentContainerFieldIndex as string;
						entry.parentContainerFieldIndex = `${removeLastPiece(current)}.${index}`;
					}
		);
	}
}

function updateHierarchyMapIndexesFromPosition(fieldId: string, model: ModelHierarchyDescriptor, currentIndex: number) {
	const { position, splitIndex, numericIndex } = getIndexMetaData(fieldId, model);
	if (numericIndex > currentIndex) {
		splitIndex[position] = (numericIndex - 1).toString();
	}
	model.parentContainerFieldIndex = splitIndex.join('.');
}

function getIndexMetaData(fieldId: string, model: ModelHierarchyDescriptor) {
	const position = model.parentContainerFieldPath.split('.').indexOf(isSimple(fieldId) ? fieldId : popPiece(fieldId));
	const index = model.parentContainerFieldIndex as string;
	const splitIndex = index.split('.');
	const numericIndex = Number(splitIndex[position]);

	return {
		position,
		splitIndex,
		numericIndex
	};
}

function deleteItemFromHierarchyMap(modelId: string) {
	modelHierarchyMap[modelId].children.forEach((_modelId) => {
		deleteItemFromHierarchyMap(_modelId);
	});
	const index = modelHierarchyMap[modelHierarchyMap[modelId].parentId].children.indexOf(modelId);
	const children = [...modelHierarchyMap[modelHierarchyMap[modelId].parentId].children];
	modelHierarchyMap[modelHierarchyMap[modelId].parentId].children = children
		.slice(0, index)
		.concat(children.slice(index + 1));
	delete modelHierarchyMap[modelId];
}

export function updateField(modelId: string, fieldId: string, index: string | number, value: unknown): void {
	const models = getCachedModels();
	const isInherited = isInheritedField(modelId, fieldId);
	let inheritorModel;
	const modelIdToEdit = isInherited ? getModelIdFromInheritedField(modelId, fieldId) : modelId;
	const model = { ...models[modelIdToEdit] };
	const parentModelId = getParentModelId(modelIdToEdit, models, modelHierarchyMap);
	const modelsToUpdate = collectReferrers(modelIdToEdit);

	// Using `index` being present as the factor to determine how to treat this update.
	// For now, fieldId should only ever have a `.` if the target zone is inside some collection
	// (node selector, repeat group) which would in turn mean there should be an `index` present.
	// In the future there may be some object type fields that would need this logic revisited
	// to account for a nested field without an index.
	if (nnou(index)) {
		// Assuming field/index should be asymmetric (one more piece of field than index). e.g.
		// - field = repeatingGroup_o.textField_s, index = 0
		// - field = repeatingGroup_o.nodeSelector_o.textField_s, index = 0.0
		const fieldPieces = fieldId.split('.');
		const indexPieces = `${index}`.split('.');
		let target = model;
		for (let i = 0, length = indexPieces.length; i < length; i++) {
			const fieldPiece = fieldPieces[i]; // repeatingGroup_o   textField_s
			const indexPiece = indexPieces[i]; // 0
			if (i + 1 === length) {
				// If it is the last iteration, create a new object: avoid mutating the original.
				// This should be an object (not an array): a repeat group item.
				target[fieldPiece][indexPiece] = { ...target[fieldPiece][indexPiece] };
			}
			target = target[fieldPiece][indexPiece];
		}
		const specificFieldId = fieldPieces.pop();
		target[specificFieldId] = value;
	} else {
		Model.value(model, fieldId, value);
		if (isInherited) {
			inheritorModel = { ...models[modelId] };
			// If inherited field - update the value in the model from where it inherits the field.
			Model.value(inheritorModel, fieldId, value);
		}
	}

	// Update the model cache
	models$.next({
		...models,
		...modelsToUpdate,
		[modelIdToEdit]: model,
		...(isInherited && { [modelId]: inheritorModel })
	});

	const action = updateFieldValueOperation({
		modelId,
		fieldId,
		index,
		value,
		parentModelId
	});

	// Post the update to studio to persist it
	post(action);
	operations$.next(action);
}

export function duplicateItem(modelId: string, fieldId: string, index: number | string): void {
	const models = getCachedModels();
	const action = duplicateItemOperation({
		modelId,
		fieldId,
		index,
		parentModelId: getParentModelId(modelId, models, modelHierarchyMap)
	});
	post(action);
	operations$.next(action);
}

export function insertItem(modelId: string, fieldId: string, index: number | string, contentType: ContentType): void {
	const instance: InstanceRecord = {};
	const models = getCachedModels();
	const fieldPathArray = fieldId.split('.');
	const repeatFields = fieldPathArray.reduce((acc, field) => acc[field].fields, contentType.fields);
	// For each of the entries of the field of type `content-type`, set the default value for the new instance.
	Object.entries(repeatFields).forEach(([id, field]) => {
		if (!systemProps.includes(field.id)) {
			instance[id] = getDefaultValue(field);
		}
	});
	const currentItems = extractCollectionPiece(models[modelId], fieldId, index);
	const model = setCollection(models[modelId], fieldId, index, [...currentItems, instance]);
	models$.next({
		...models,
		[modelId]: model
	});

	const action = insertItemOperation({
		modelId,
		fieldId,
		index,
		instance,
		parentModelId: getParentModelId(modelId, models, modelHierarchyMap)
	});

	post(action);
	operations$.next(action);
}

const systemProps = ['fileName', 'internalName'];

export function createContentInstance(contentType: ContentType, path: string = null): ContentInstance {
	const id = uuid();
	const now = new Date().toISOString();
	const instance: ContentInstance = {
		craftercms: {
			id,
			path: path ? `${path}/${id}.xml` : null,
			label: `New ${contentType.name}`,
			contentTypeId: contentType.id,
			dateCreated: now,
			dateModified: now,
			disabled: false,
			sourceMap: {}
		}
	};
	Object.entries(contentType.fields).forEach(([id, field]) => {
		if (!systemProps.includes(field.id)) {
			instance[id] = getDefaultValue(field);
		}
	});
	return instance;
}

// region export function insertComponent(...) ...
export function insertComponent(
	modelId: string,
	fieldId: string,
	targetIndex: number | string,
	instance: ContentInstance,
	shared = false,
	create = false
): void {
	const models = getCachedModels();
	const result = getCollection(models[modelId], fieldId, targetIndex)?.concat() ?? [];

	// Dotted indexes address a nested collection that getCollection already resolved.
	// Only the last segment is the slot in that collection. splice("2.5") truncates to 2.
	// Null means the index is not a usable position; do not append or insert at 0.
	const insertAt = resolveInsertIndex(targetIndex, result);
	if (insertAt === null) {
		console.error(
			`[ContentController/insertComponent] Refusing to insert: "${String(targetIndex)}" is not a non-negative integer position for field "${fieldId}" on model "${modelId}".`
		);
		return;
	}

	// Insert in desired position
	result.splice(insertAt, 0, instance.craftercms.id);

	const model = setCollection(
		models[modelId],
		fieldId,
		typeof targetIndex === 'string' ? removeLastPiece(targetIndex) : targetIndex,
		result
	);

	models$.next({
		...models,
		[instance.craftercms.id]: instance,
		[modelId]: model
	});

	modelHierarchyMap[instance.craftercms.id] = {
		children: [],
		modelId: instance.craftercms.id,
		parentContainerFieldIndex: isSimple(targetIndex) ? null : removeLastPiece(targetIndex as string),
		parentContainerFieldPath: isSimple(fieldId) ? fieldId : removeLastPiece(fieldId),
		parentId: modelId
	};

	modelHierarchyMap[modelId]?.children.push(instance.craftercms.id);

	updateHierarchyMapIndexesFromCollection(result);

	const action = insertComponentOperation({
		modelId,
		fieldId,
		targetIndex,
		instance,
		parentModelId: getParentModelId(modelId, models, modelHierarchyMap),
		shared,
		create
	});

	post(action);
	operations$.next(action);
}
// endregion

export function insertGroup(modelId, fieldId, data): void {}

export function sortUpItem(modelId: string, fieldId: string, index: number | string) {
	const currentIndexParsed = typeof index === 'number' ? index : parseInt(popPiece(index));
	if (currentIndexParsed !== 0) {
		const targetIndex = currentIndexParsed - 1;
		sortItem(
			modelId,
			fieldId,
			index,
			isSimple(index) ? targetIndex : `${removeLastPiece(index as string)}.${targetIndex}`
		);
	}
}

export function sortDownItem(modelId: string, fieldId: string, index: number | string) {
	const models = getCachedModels();
	const currentIndexParsed = typeof index === 'number' ? index : parseInt(popPiece(index));
	const collection = getCollection(models[modelId], fieldId, index);
	if (currentIndexParsed < collection.length - 1) {
		const targetIndex = currentIndexParsed + 1;
		sortItem(
			modelId,
			fieldId,
			index,
			isSimple(index) ? targetIndex : `${removeLastPiece(index as string)}.${targetIndex}`
		);
	}
}

// region export function sortItem(...) ...
export function sortItem(
	modelId: string,
	fieldId: string,
	currentIndex: number | string,
	targetIndex: number | string
): void {
	const models = getCachedModels();
	const currentIndexParsed = typeof currentIndex === 'number' ? currentIndex : parseInt(popPiece(currentIndex));
	const targetIndexParsed = typeof targetIndex === 'number' ? targetIndex : parseInt(popPiece(targetIndex));
	const collection = getCollection(models[modelId], fieldId, currentIndex);
	const result = getCollectionWithoutItemAtIndex(collection, currentIndexParsed);

	// Insert in desired position
	result.splice(targetIndexParsed, 0, collection[currentIndexParsed]);

	function updateModel(fieldId: string, model: ModelHierarchyDescriptor, currentIndex: number, targetIndex: number) {
		const { position, splitIndex, numericIndex } = getIndexMetaData(fieldId, model);
		if (numericIndex === currentIndex) {
			splitIndex[position] = targetIndex.toString();
		} else if (numericIndex === targetIndex) {
			splitIndex[position] = currentIndex.toString();
		} else if (targetIndex < currentIndex) {
			splitIndex[position] = (numericIndex + 1).toString();
		} else if (targetIndex > currentIndex) {
			splitIndex[position] = (numericIndex - 1).toString();
		}
		model.parentContainerFieldIndex = splitIndex.join('.');
	}

	// If it is a node selector, the hierarchy map must be updated.
	// Determine if it is a node selector or a repeat group. Node selectors are kept normalized so
	// a node selector collections will have strings on them (ids of the components they hold) vs
	// repeating groups that will have objects (the items per se).
	if (typeof result[0] === 'string') {
		updateHierarchyMapIndexesFromCollection(result);
	} else {
		modelHierarchyMap[modelId].children.forEach((_modelId) => {
			if (modelHierarchyMap[_modelId].parentContainerFieldPath?.startsWith(fieldId)) {
				updateModel(fieldId, modelHierarchyMap[_modelId], currentIndexParsed, targetIndexParsed);
			}
		});
	}

	const model = setCollection(
		models[modelId],
		fieldId,
		typeof currentIndex === 'string' ? removeLastPiece(currentIndex) : currentIndex,
		result
	);

	models$.next({
		...models,
		[modelId]: model
	});

	const action = sortItemOperation({
		modelId,
		fieldId,
		currentIndex,
		targetIndex,
		parentModelId: getParentModelId(modelId, models, modelHierarchyMap)
	});

	post(action);
	operations$.next(action);
}
// endregion

// region export function moveItem(...) ...
export function moveItem(
	originalModelId: string,
	originalFieldId: string,
	originalIndex: number | string,
	targetModelId: string,
	targetFieldId: string,
	targetIndex: number | string
): void {
	const models = getCachedModels();

	// Parse indexes to clear out dot notation for nested repeat/collection items.
	let originalIndexParsed = typeof originalIndex === 'number' ? originalIndex : parseInt(popPiece(originalIndex));
	let targetIndexParsed = typeof targetIndex === 'number' ? targetIndex : parseInt(popPiece(targetIndex));

	const symmetricOriginal = originalFieldId.split('.').length === `${originalIndex}`.split('.').length;
	const symmetricTarget = targetFieldId.split('.').length === `${targetIndex}`.split('.').length;

	if (!symmetricOriginal) {
		debugger;
	} else if (!symmetricTarget) {
		debugger;
	}

	const currentModel = models[originalModelId];
	const currentCollection = symmetricOriginal
		? Model.extractCollection(currentModel, originalFieldId, originalIndex)
		: Model.extractCollectionItem(currentModel, originalFieldId, originalIndex);
	const item = currentCollection[originalIndexParsed];
	// Remove item from original collection
	const currentResult = currentCollection
		.slice(0, originalIndexParsed)
		.concat(currentCollection.slice(originalIndexParsed + 1));

	updateHierarchyMapIndexesFromCollection(currentResult);

	const targetModel = models[targetModelId];
	const targetCollection = symmetricTarget
		? (Model.extractCollection(targetModel, targetFieldId, targetIndex) ?? [])
		: Model.extractCollectionItem(targetModel, targetFieldId, targetIndex);
	// Insert item in target collection @ the desired position
	const targetResult = targetCollection.slice(0);

	targetResult.splice(targetIndexParsed, 0, currentCollection[originalIndexParsed]);

	modelHierarchyMap[item] = {
		...modelHierarchyMap[item],
		parentContainerFieldIndex: targetIndex,
		parentContainerFieldPath: targetFieldId,
		parentId: targetModelId
	};

	modelHierarchyMap[targetModelId]?.children.push(item);

	updateHierarchyMapIndexesFromCollection(targetResult);

	const newOriginalModel = { ...currentModel };
	const newTargetModel = originalModelId === targetModelId ? newOriginalModel : { ...targetModel };

	// This should extract the object that contains the
	// collection so the collection can be replaced with the new one with the modifications.
	// This is for nested cases where there's something like `field_1.field_2`.
	const getFieldItem = (model, field, index) => {
		let item;
		if (symmetricOriginal) {
			item = Model.extractCollectionItem(model, removeLastPiece(`${field}`), removeLastPiece(`${index}`));
		} else {
			debugger;
		}
		return item;
	};

	if (isSimple(originalFieldId)) {
		newOriginalModel[originalFieldId] = currentResult;
	} else {
		let item = getFieldItem(newOriginalModel, originalFieldId, originalIndex);
		item[popPiece(originalFieldId)] = currentResult;
	}

	if (isSimple(targetFieldId)) {
		newTargetModel[targetFieldId] = targetResult;
	} else {
		let item = getFieldItem(newTargetModel, targetFieldId, targetIndex);
		item[popPiece(targetFieldId)] = targetResult;
	}

	models$.next(
		originalModelId === targetModelId
			? {
					...models,
					[originalModelId]: newOriginalModel
				}
			: {
					...models,
					[originalModelId]: newOriginalModel,
					[targetModelId]: newTargetModel
				}
	);

	const action = moveItemOperation({
		originalModelId,
		originalFieldId,
		originalIndex,
		targetModelId,
		targetFieldId,
		targetIndex,
		originalParentModelId: getParentModelId(originalModelId, models, modelHierarchyMap),
		targetParentModelId: getParentModelId(targetModelId, models, modelHierarchyMap)
	});

	post(action);
	operations$.next(action);
}
// endregion

export function deleteItem(modelId: string, fieldId: string, index: number | string): void {
	const isStringIndex = typeof index === 'string';
	const parsedIndex = parseInt(popPiece(`${index}`), 10);

	const models = getCachedModels();
	const collection = isStringIndex
		? Model.extractCollection(models[modelId], fieldId, index)
		: Model.value(models[modelId], fieldId);
	const item = collection[parsedIndex];

	const result = collection.slice(0, parsedIndex).concat(collection.slice(parsedIndex + 1));

	// Deleting item from modelHierarchyMap
	if (typeof collection[0] === 'string') {
		deleteItemFromHierarchyMap(item as string);
		updateHierarchyMapIndexesFromCollection(result);
	} else {
		const modelsToDelete = [];
		modelHierarchyMap[modelId].children.forEach((_modelId) => {
			if (modelHierarchyMap[_modelId].parentContainerFieldPath.startsWith(fieldId)) {
				const { numericIndex } = getIndexMetaData(fieldId, modelHierarchyMap[_modelId]);
				if (numericIndex === parsedIndex) {
					modelsToDelete.push(_modelId);
				}
				updateHierarchyMapIndexesFromPosition(fieldId, modelHierarchyMap[_modelId], parsedIndex);
			}
		});
		modelsToDelete.forEach((id) => {
			deleteItemFromHierarchyMap(id);
		});
	}

	const model = setCollection(
		models[modelId],
		fieldId,
		typeof index === 'string' ? removeLastPiece(index) : index,
		result
	);

	models$.next({
		...models,
		[modelId]: model
	});

	const action = deleteItemOperation({
		modelId,
		fieldId,
		index,
		parentModelId: getParentModelId(modelId, models, modelHierarchyMap)
	});

	post(action);
	operations$.next(action);
}

// Host sends over all content types upon Guest check in.
fromTopic(contentTypesResponse.type).subscribe(({ payload: { contentTypes } }) => {
	contentTypes$.next(Array.isArray(contentTypes) ? createLookupTable(contentTypes) : contentTypes);
});

export interface FetchGuestModelCompletePayload {
	path: string;
	model: ContentInstance;
	modelLookup: LookupTable<ContentInstance>;
	modelIdByPath: LookupTable<string>;
	hierarchyMap: ModelHierarchyMap;
	contentItems: ContentItem[];
	permissions: string[];
}

fromTopic(fetchGuestModelComplete.type).subscribe((action: StandardAction<FetchGuestModelCompletePayload>) => {
	const { modelLookup, hierarchyMap, modelIdByPath, contentItems, permissions } = action.payload;
	Object.keys(modelIdByPath).forEach((path) => {
		requestedPaths[path] = true;
	});
	const mhm = modelHierarchyMap;
	// TODO: Must understand the differences when a model comes multiple times in the `hierarchyMap` coming from Host
	//  parentId has been seen populated as part of a bigger request but null when model loaded in isolation
	Object.keys(hierarchyMap).forEach((id) => {
		if (mhm[id]) {
			mhm[id].modelId = hierarchyMap[id].modelId;
			mhm[id].parentId = mhm[id].parentId ?? hierarchyMap[id].parentId;
			mhm[id].parentContainerFieldPath = mhm[id].parentContainerFieldPath ?? hierarchyMap[id].parentContainerFieldPath;
			mhm[id].parentContainerFieldIndex =
				mhm[id].parentContainerFieldIndex ?? hierarchyMap[id].parentContainerFieldIndex;
			// Flipping around from the fix on ticket #6433 for ticket #8154. The children coming from Host must be the latest.
			// TODO: Observed the local hierarchyMap[id].children containing duplicates. Where is that coming from? Are children computed locally?
			mhm[id].children = hierarchyMap[id].children ?? mhm[id].children;
		} else {
			mhm[id] = hierarchyMap[id];
		}
	});
	const nextModels: Record<string, ContentInstance> = { ...models$.value };
	// Partial models (non-flattened references) can create instability.
	// Take only those that seem complete and let the system fetch those that aren't.
	Object.entries(modelLookup).forEach(([id, instance]) => {
		if ((instance.craftercms.id || instance.craftercms.path) && instance.craftercms.contentTypeId) {
			nextModels[id] = instance;
		}
	});
	models$.next(nextModels);
	paths$.next({ ...paths$.value, ...modelIdByPath });
	items$.next({ ...items$.value, ...createLookupTable(contentItems, 'path') });
	permissions$.next(permissions);
});

fromTopic(fetchContentItemComplete.type)
	.pipe(map((action) => action?.payload))
	.subscribe((item) => {
		items$.next({
			...items$.value,
			[item.path]: item
		});
	});

fromTopic(updateFieldValueOperationComplete.type)
	.pipe(map((action) => action?.payload))
	.subscribe(({ item }) => {
		items$.next({
			...items$.value,
			[item.path]: item
		});
	});
