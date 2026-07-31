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

import { errorSelectorApi1, get, getBinary, getGlobalHeaders, getText, post, postJSON, put } from '../utils/ajax';
import { catchError, map, pluck, switchMap, tap } from 'rxjs/operators';
import { forkJoin, Observable, of, zip } from 'rxjs';
import {
	beautify,
	cdataWrap,
	createElement,
	createElements,
	fromString,
	getInnerHtml,
	newXMLDocument,
	serialize
} from '../utils/xml';
import { ContentType } from '../models/ContentType';
import { createLookupTable, nnou, nou, toQueryString } from '../utils/object';
import { LookupTable } from '../models/LookupTable';
import { dataUriToBlob, ensureSingleSlash, isBlank, isPath, popPiece, removeLastPiece } from '../utils/string';
import ContentInstance, { InstanceRecord } from '../models/ContentInstance';
import { AjaxResponse } from 'rxjs/ajax';
import { ComponentsContentTypeParams, ContentInstancePage } from '../models/Search';
import { Uppy as Core, XHRUpload } from 'uppy';
import { getRequestForgeryToken } from '../utils/auth';
import { ContentItem, LegacyItem } from '../models/Item';
import { ItemHistoryEntry } from '../models/Version';
import { GetChildrenOptions } from '../models/GetChildrenOptions';
import { generateComponentPath, isPdfDocument, parseContentXML, prepareVirtualItemProps } from '../utils/content';
import QuickCreateItem from '../models/content/QuickCreateItem';
import ApiResponse, { Api2ResponseFormat } from '../models/ApiResponse';
import { fetchContentTypes } from './contentTypes';
import { Clipboard } from '../models/GlobalState';
import { getFileNameFromPath } from '../utils/path';
import { StandardAction } from '../models/StandardAction';
import { GetChildrenResponse } from '../models/GetChildrenResponse';
import { GetItemWithChildrenResponse } from '../models/GetItemWithChildrenResponse';
import { FetchItemsByPathOptions } from '../models/FetchItemsByPath';
import { v4 as uuid } from 'uuid';
import FetchItemsByPathArray from '../models/FetchItemsByPathArray';
import { isMediaContent, isTextContent } from '../components/PathNavigator/utils';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';
import { getCurrentIntl } from '../utils/i18n';

export function fetchComponentInstanceHTML(path: string): Observable<string> {
	return getText(`/crafter-controller/component.html${toQueryString({ path })}`).pipe(pluck('response'));
}

export function fetchContentXML(site: string, path: string): Observable<string> {
	return fetchContentByCommitId(site, path, 'HEAD') as Observable<string>;
}

export function fetchContentDOM(site: string, path: string): Observable<XMLDocument> {
	return fetchContentXML(site, path).pipe(map(fromString));
}

interface GetDescriptorOptions {
	flatten: boolean;
}

export function fetchDescriptorXML(
	site: string,
	path: string,
	options?: Partial<GetDescriptorOptions>
): Observable<string> {
	const qs = toQueryString({ siteId: site, path, flatten: true, ...options });
	return get(`/studio/api/2/content/descriptor${qs}`).pipe(pluck('response', 'xml'));
}

export function fetchDescriptorDOM(
	site: string,
	path: string,
	options?: Partial<GetDescriptorOptions>
): Observable<XMLDocument> {
	return fetchDescriptorXML(site, path, options).pipe(map(fromString));
}

export function fetchContentItem(
	siteId: string,
	path: string,
	options?: { preferContent: boolean }
): Observable<ContentItem> {
	const { preferContent } = { preferContent: true, ...options };
	const qs = toQueryString({ siteId, path, preferContent });
	return get(`/studio/api/2/content/item_by_path${qs}`).pipe(
		map(({ response }) => prepareVirtualItemProps(response?.item))
	);
}

export function fetchContentInstanceLookup(
	site: string,
	path: string,
	contentTypesLookup: LookupTable<ContentType>
): Observable<LookupTable<ContentInstance>> {
	return fetchContentDOM(site, path).pipe(
		map((doc) => {
			const lookup = {};
			parseContentXML(doc, path, contentTypesLookup, lookup);
			return lookup;
		})
	);
}

export function fetchContentInstance(
	site: string,
	path: string,
	contentTypesLookup: LookupTable<ContentType>
): Observable<ContentInstance> {
	return fetchContentDOM(site, path).pipe(map((doc) => parseContentXML(doc, path, contentTypesLookup, {})));
}

export type WriteContentResponse = Api2ResponseFormat<{
	items: Array<{
		path: string;
		action: string;
		amended: boolean;
	}>;
}>;

export function writeContent(
	siteId: string,
	path: string,
	content: string,
	options?: { unlock?: boolean; comment?: string }
): Observable<AjaxResponse<WriteContentResponse>> {
	const request$ = postJSON(`/studio/api/2/content/${siteId}`, {
		path,
		content,
		comment: options?.comment || ''
	});
	if (options?.unlock) {
		return request$.pipe(switchMap((response) => unlock(siteId, path).pipe(map(() => response))));
	}
	return request$;
}

// TODO: add link to API docs when available
export function uploadFile(siteId: string, formData: FormData) {
	return put(`/studio/api/2/content/${siteId}`, formData);
}

// TODO: add link to API docs when available
export function moveAndUpdateContent(
	siteId: string,
	sourcePath: string,
	targetPath: string,
	content: string
): Observable<AjaxResponse<WriteContentResponse>> {
	return post(`/studio/api/2/content/${siteId}/move_and_update`, {
		sourcePath,
		targetPath,
		content
	});
}

export function fetchContentInstanceDescriptor(
	site: string,
	path: string,
	options?: Partial<GetDescriptorOptions>,
	contentTypeLookup?: LookupTable<ContentType>
): Observable<{
	model: ContentInstance;
	modelLookup: LookupTable<ContentInstance>;
	/**
	 * A lookup table directly completed/mutated by this function indexed by path of those objects
	 * that are incomplete/unflattened.
	 */
	unflattenedPaths: LookupTable<ContentInstance>;
}> {
	const unflattenedPaths = {};
	return (
		contentTypeLookup
			? of(contentTypeLookup)
			: fetchContentTypes(site).pipe(map((contentTypes) => createLookupTable(contentTypes)))
	).pipe(
		switchMap((contentTypeLookup) =>
			fetchDescriptorDOM(site, path, options).pipe(
				map((doc) => {
					const modelLookup = {};
					const model = parseContentXML(doc, path, contentTypeLookup, modelLookup, unflattenedPaths);
					return { model, modelLookup, unflattenedPaths };
				})
			)
		)
	);
}

function createComponentObject(
	instance: ContentInstance,
	contentType: ContentType,
	shouldSerializeValueFn: (fieldId) => boolean
) {
	const id = (instance.craftercms.id = instance.craftercms.id ?? uuid());
	const path = (instance.craftercms.path =
		instance.craftercms.path ?? generateComponentPath(id, instance.craftercms.contentTypeId));
	const fileName = getFileNameFromPath(path);

	const serializedInstance = {};
	for (let key in instance) {
		if (key !== 'craftercms' && key !== 'fileName' && key !== 'internalName') {
			let value = instance[key];
			serializedInstance[key] =
				nnou(value) && (typeof value !== 'string' || !isBlank(value)) && shouldSerializeValueFn?.(key)
					? cdataWrap(`${value}`)
					: value;
		}
	}

	return mergeContentDocumentProps('component', {
		'@attributes': { id },
		'content-type': contentType.id,
		'display-template': contentType.displayTemplate,
		// TODO: per this, at this point, internal-name is always cdata wrapped, not driven by config.
		'internal-name': cdataWrap(instance.craftercms.label),
		'file-name': fileName,
		objectId: id,
		...serializedInstance
	});
}

// region writeInstance
/**
 * Creates a new content item xml document and writes it to the repo.
 */
export function writeInstance(
	site: string,
	instance: ContentInstance,
	contentType: ContentType,
	shouldSerializeValueFn?: (fieldId: any) => boolean
): Observable<any> {
	const doc = newXMLDocument('component');
	const transferObj = createComponentObject(instance, contentType, shouldSerializeValueFn);
	createElements(doc.documentElement, transferObj);
	return fromPromise(beautify(serialize(doc))).pipe(
		switchMap((xml) => writeContent(site, instance.craftercms.path, xml))
	);
}
// endregion

// region updateField
export function updateField(
	site: string,
	modelId: string,
	fieldId: string,
	indexToUpdate: number,
	path: string,
	value: any,
	serializeValue: boolean | ((value: any) => string) = false
): Observable<any> {
	const writeContentComment = getCurrentIntl().formatMessage(
		{ defaultMessage: 'Updated {fieldId} in {path}' },
		{ fieldId, path }
	);
	return performMutation(
		site,
		path,
		(element) => {
			let node = extractNode(element, removeLastPiece(fieldId) || fieldId, indexToUpdate);
			if (fieldId.includes('.')) {
				// node is <item /> inside collection
				const fieldToUpdate = popPiece(fieldId);
				let fieldNode = node.querySelector(`:scope > ${fieldToUpdate}`);
				if (nou(fieldNode)) {
					fieldNode = createElement(fieldToUpdate);
					node.appendChild(fieldNode);
				}
				node = fieldNode;
			} else if (!node) {
				// node is <fieldId /> inside the element
				node = createElement(fieldId);
				element.appendChild(node);
			}
			node.innerHTML =
				typeof serializeValue === 'function'
					? serializeValue(value)
					: Boolean(serializeValue)
						? cdataWrap(value)
						: value;
		},
		modelId,
		writeContentComment
	);
}
// endregion

// region performMutation
function performMutation(
	site: string,
	path: string,
	mutation: (doc: Element) => void,
	modelId: string = null,
	writeContentComment?: string
): Observable<{ updatedDocument: XMLDocument }> {
	return fetchContentDOM(site, path).pipe(
		switchMap((doc) => {
			const documentModelId = doc.querySelector(':scope > objectId').innerHTML.trim();
			if (nnou(modelId) && documentModelId !== modelId) {
				const component = doc.querySelector(`[id="${modelId}"]`);
				mutation(component);
				updateModifiedDateElement(component);
			} else {
				mutation(doc.documentElement);
			}

			updateModifiedDateElement(doc.documentElement);

			return fromPromise(beautify(serialize(doc))).pipe(
				switchMap((xml) =>
					writeContent(site, path, xml, { unlock: true, comment: writeContentComment }).pipe(
						map(() => ({ updatedDocument: doc }))
					)
				)
			);
		})
	);
}
// endregion

// region insertComponent
/**
 * Inserts a *new* component item on the specified component collection field. In case of shared components, only
 * updates the target content item field to include the reference, does not create/write the shared component document.
 * */
export function insertComponent(
	siteId: string,
	parentDocPath: string,
	parentModelId: string,
	parentFieldId: string,
	targetIndex: string | number,
	parentContentType: ContentType,
	insertedContentInstance: ContentInstance,
	insertedItemContentType: ContentType,
	isSharedInstance = false,
	shouldSerializeValueFn?: (fieldId: string) => boolean
): Observable<any> {
	const writeContentComment = getCurrentIntl().formatMessage(
		{ defaultMessage: 'Inserted component {label} in {path}' },
		{ label: insertedContentInstance.craftercms.label, path: parentDocPath }
	);
	return performMutation(
		siteId,
		parentDocPath,
		(element) => {
			const id = insertedContentInstance.craftercms.id;
			const path = isSharedInstance
				? (insertedContentInstance.craftercms.path ??
					generateComponentPath(id, insertedContentInstance.craftercms.contentTypeId))
				: null;

			// Create the new `item` that holds or references (embedded vs shared) the component.
			const newItem = createElement('item');
			const field = parentContentType.fields[parentFieldId];

			// Add the child elements into the `item` node
			createElements(newItem, {
				'@attributes': { inline: !isSharedInstance },
				key: isSharedInstance ? path : id,
				value: cdataWrap(insertedContentInstance.craftercms.label),
				...(isSharedInstance
					? { include: path, disableFlattening: String(field?.properties?.disableFlattening?.value ?? 'false') }
					: {
							component: createComponentObject(insertedContentInstance, insertedItemContentType, shouldSerializeValueFn)
						})
			});

			insertCollectionItem(element, parentFieldId, targetIndex, newItem);
		},
		parentModelId,
		writeContentComment
	);
}
// endregion

// region insertInstance
/**
 * Insert an *existing* (i.e. shared) component on to the document
 * */
export function insertInstance(
	siteId: string,
	parentDocPath: string,
	parentModelId: string,
	parentFieldId: string,
	targetIndex: string | number,
	parentContentType: ContentType,
	insertedInstance: ContentInstance,
	datasource?: string
): Observable<any> {
	const writeContentComment = getCurrentIntl().formatMessage(
		{ defaultMessage: 'Inserted instance {label} in {path}' },
		{ label: insertedInstance.craftercms.label, path: parentDocPath }
	);
	return performMutation(
		siteId,
		parentDocPath,
		(element) => {
			const path = insertedInstance.craftercms.path;
			const newItem = createElement('item');
			const field = parentContentType.fields[parentFieldId];

			createElements(newItem, {
				'@attributes': {
					// TODO: Review datasource persistence.
					datasource: datasource ?? ''
				},
				key: path,
				value: cdataWrap(insertedInstance.craftercms.label),
				include: path,
				disableFlattening: String(field?.properties?.disableFlattening?.value ?? 'false')
			});

			insertCollectionItem(element, parentFieldId, targetIndex, newItem);
		},
		parentModelId,
		writeContentComment
	);
}
// endregion

// region insertItem
export function insertItem(
	site: string,
	modelId: string,
	fieldId: string,
	index: string | number,
	instance: InstanceRecord,
	path: string,
	shouldSerializeValueFn?: (fieldId: string) => boolean
): Observable<any> {
	return performMutation(
		site,
		path,
		(element) => {
			const node = extractNode(element, fieldId, index);
			const newItem = createElement('item');
			const serializedInstance = {};
			for (let key in instance) {
				if (key !== 'craftercms') {
					let value = instance[key];
					serializedInstance[key] =
						nnou(value) && (typeof value !== 'string' || !isBlank(value)) && shouldSerializeValueFn?.(key)
							? cdataWrap(`${value}`)
							: value;
				}
			}
			createElements(newItem, serializedInstance);
			node.appendChild(newItem);
		},
		modelId
	);
}
// endregion

// region duplicateItem
export function duplicateItem(
	site: string,
	modelId: string,
	fieldId: string,
	targetIndex: string | number,
	path: string
): Observable<{
	updatedDocument: XMLDocument;
	newItem: {
		modelId: string;
		path: string;
	};
}> {
	return fetchContentDOM(site, path).pipe(
		switchMap((doc) => {
			const documentModelId = doc.querySelector(':scope > objectId').innerHTML.trim();
			let parentElement = doc.documentElement;
			if (nnou(modelId) && documentModelId !== modelId) {
				parentElement = doc.querySelector(`[id="${modelId}"]`);
			}

			const indexBeingDuplicated = parseInt(popPiece(`${targetIndex}`));
			const item: Element = extractNode(parentElement, fieldId, targetIndex).cloneNode(true) as Element;
			// If it has a `key` element, then it may be an item reference.
			const itemPath = item.querySelector(':scope > key')?.textContent.trim();
			const isEmbedded = Boolean(item.querySelector(':scope > component'));
			// If not an item reference, duplicating a repeat item.
			const isItemReference = isEmbedded || isPath(itemPath);
			// Remove last piece to get the parent of the item (i.e. the field)
			const field: Element = extractNode(parentElement, fieldId, removeLastPiece(`${targetIndex}`));
			const items = field.querySelectorAll(':scope > item');
			const numOfItems = items.length;

			const newItemData = isItemReference ? updateItemId(item) : { modelId, path };
			newItemData.path = newItemData.path ?? path;
			updateModifiedDateElement(parentElement);

			if (numOfItems - 1 === indexBeingDuplicated) {
				field.appendChild(item);
			} else {
				field.insertBefore(item, items[indexBeingDuplicated + 1]);
			}

			const returnValue = {
				updatedDocument: doc,
				newItem: newItemData
			};

			if (!isItemReference || isEmbedded) {
				if (isEmbedded) {
					const component = item.querySelector(':scope > component');
					updateModifiedDateElement(component);
					updateCreatedDateElement(component);
				}
				return fromPromise(beautify(serialize(doc))).pipe(
					switchMap((xml) => writeContent(site, path, xml, { unlock: true }).pipe(map(() => returnValue)))
				);
			} else {
				return fetchContentDOM(site, itemPath).pipe(
					switchMap((componentDoc) => {
						// Update new shared component info  (ids/date)
						updateComponentId(componentDoc.documentElement, newItemData.modelId);
						updateModifiedDateElement(componentDoc.documentElement);
						updateCreatedDateElement(componentDoc.documentElement);
						const writeContentComment = getCurrentIntl().formatMessage(
							{ defaultMessage: 'Duplicated item {itemPath} in {path}' },
							{ itemPath, path }
						);
						return forkJoin([
							// Write the main document.
							fromPromise(beautify(serialize(doc))).pipe(
								switchMap((xml) => writeContent(site, path, xml, { unlock: true, comment: writeContentComment }))
							),
							// Write the new/duplicated shared component.
							fromPromise(beautify(serialize(componentDoc))).pipe(
								switchMap((xml) =>
									writeContent(site, `${returnValue.newItem.path}/${returnValue.newItem.modelId}.xml`, xml, {
										unlock: true,
										comment: getCurrentIntl().formatMessage(
											{ defaultMessage: 'Created duplicated shared component {path}/{modelId}.xml' },
											{ path: returnValue.newItem.path, modelId: returnValue.newItem.modelId }
										)
									})
								)
							)
						]).pipe(
							map(() => {
								returnValue.newItem.path = `${returnValue.newItem.path}/${returnValue.newItem.modelId}.xml`;
								return returnValue;
							})
						);
					})
				);
			}
		})
	);
}
// endregion

// region sortItem
export function sortItem(
	site: string,
	modelId: string,
	fieldId: string,
	currentIndex: number,
	targetIndex: number,
	path: string
): Observable<any> {
	const writeContentComment = getCurrentIntl().formatMessage(
		{ defaultMessage: 'Moved item from index {currentIndex} to {targetIndex} in {fieldId}. Path: {path}' },
		{ currentIndex, targetIndex, fieldId, path }
	);
	return performMutation(
		site,
		path,
		(element) => {
			const item = extractNode(element, fieldId, currentIndex);
			insertCollectionItem(element, fieldId, targetIndex, item, currentIndex);
		},
		modelId,
		writeContentComment
	);
}
// endregion

// region moveItem
export function moveItem(
	site: string,
	originalModelId: string,
	originalFieldId: string,
	originalIndex: number,
	targetModelId: string,
	targetFieldId: string,
	targetIndex: number,
	originalParentPath: string,
	targetParentPath: string
): Observable<any> {
	// TODO Warning: cannot perform as transaction whilst the UI is the one to do all this.
	// const isOriginalEmbedded = nnou(originalParentPath);
	// const isTargetEmbedded = nnou(targetParentPath);
	// When moving between inherited dropzone to other dropzone, the modelsIds will be different but in some cases the
	// parentId will be null for both targets in that case we need to add a nnou validation to parentsModelId;
	const isSameModel = originalModelId === targetModelId;
	const isSameDocument = originalParentPath === targetParentPath;
	if (isSameDocument || isSameModel) {
		const writeContentComment = getCurrentIntl().formatMessage(
			{ defaultMessage: 'Moving item {originalFieldId} from {originalIndex} to {targetIndex} in {originalParentPath}' },
			{ originalFieldId, originalIndex, targetIndex, originalParentPath }
		);
		// Moving items between two fields of the same document or model...
		return performMutation(
			site,
			originalParentPath,
			(element) => {
				// Item may be moving...
				// - from parent model to an embedded model
				// - from an embedded model to the parent model
				// - from an embedded model to another embedded model
				// - from a field to another WITHIN the same model (parent or embedded)
				const parentDocumentModelId = getInnerHtml(element.querySelector(':scope > objectId'));
				const sourceModelElement =
					parentDocumentModelId === originalModelId ? element : element.querySelector(`[id="${originalModelId}"]`);
				const targetModelElement =
					parentDocumentModelId === targetModelId ? element : element.querySelector(`[id="${targetModelId}"]`);
				const item = extractNode(sourceModelElement, originalFieldId, originalIndex);
				let targetField = extractNode(targetModelElement, targetFieldId, removeLastPiece(`${targetIndex}`));
				if (!targetField) {
					const newField = createElement(originalFieldId);
					newField.setAttribute('item-list', 'true');
					targetModelElement.appendChild(newField);
					targetField = newField;
				}
				const targetFieldItems = targetField.querySelectorAll(':scope > item');
				const parsedTargetIndex = parseInt(popPiece(`${targetIndex}`));
				if (targetFieldItems.length === parsedTargetIndex) {
					targetField.appendChild(item);
				} else {
					targetField.insertBefore(item, targetFieldItems[parsedTargetIndex]);
				}
			},
			null,
			writeContentComment
		);
	} else {
		const writeContentComment = getCurrentIntl().formatMessage(
			{
				defaultMessage:
					'Moving item {originalFieldId} from {originalIndex} to {targetIndex} in {originalParentPath} to {targetParentPath}'
			},
			{ originalFieldId, originalIndex, targetIndex, originalParentPath, targetParentPath }
		);
		let removedItemHTML: string;
		return performMutation(
			site,
			originalParentPath,
			(element) => {
				const item: Element = extractNode(element, originalFieldId, originalIndex);
				const field: Element = extractNode(element, originalFieldId, removeLastPiece(`${originalIndex}`));

				removedItemHTML = item.outerHTML;
				field.removeChild(item);
			},
			originalModelId,
			writeContentComment
		).pipe(
			switchMap(() =>
				performMutation(
					site,
					targetParentPath,
					(element) => {
						const item: Element = extractNode(element, targetFieldId, targetIndex);
						let field: Element = extractNode(element, targetFieldId, removeLastPiece(`${targetIndex}`));
						// If field doesn't exist yet in the document, create it
						if (!field) {
							const newField = createElement(originalFieldId);
							newField.setAttribute('item-list', 'true');
							element.appendChild(newField);
							field = newField;
						}

						const auxElement = createElement('hold');
						auxElement.innerHTML = removedItemHTML;

						field.insertBefore(auxElement.querySelector(':scope > item'), item);
					},
					targetModelId
				)
			)
		);
	}
}
// endregion

// region deleteItem
export function deleteItem(
	site: string,
	modelId: string,
	fieldId: string,
	indexToDelete: number | string,
	path: string
): Observable<any> {
	const writeContentComment = getCurrentIntl().formatMessage(
		{ defaultMessage: 'Removed item {fieldId} at index {indexToDelete} in {path}' },
		{ fieldId, indexToDelete, path }
	);
	return performMutation(
		site,
		path,
		(element) => {
			let index = indexToDelete;
			let fieldNode = element.querySelector(`:scope > ${fieldId}`);

			if (typeof indexToDelete === 'string') {
				index = parseInt(popPiece(indexToDelete));
				// A fieldId can be in the form of `a.b`, which translates to `a > item > b` on the XML.
				// In terms of index, since all it should ever arrive here is collection items,
				// this assumes the index path points to the item itself, not the collection.
				// By calling removeLastPiece(indexToDelete), we should get the collection node here.
				fieldNode = extractNode(element, fieldId, removeLastPiece(`${indexToDelete}`));
			}

			fieldNode.children[index as number].remove();

			if (fieldNode.children.length === 0) {
				// If the node isn't completely blank, the xml formatter won't do it's job in converting to a self-closing tag.
				// Also, later on, when retrieved, some *legacy* functions would impaired as the deserializing into JSON had unexpected content
				fieldNode.innerHTML = '';
			}
		},
		modelId,
		writeContentComment
	);
}
// endregion

interface SearchServiceResponse {
	response: ApiResponse;
	result: {
		total: number;
		items: Array<{
			lastModified: string;
			lastModifier: string;
			mimeType: string;
			name: string;
			path: string;
			previewUrl: string;
			size: number;
			snippets: unknown;
		}>;
		facets: Array<{
			date: boolean;
			multiple: boolean;
			name: string;
			range: boolean;
			values: Array<{
				count: number;
				from: number;
				to: number;
			}>;
		}>;
	};
}

// region fetchItemsByContentType
export function fetchItemsByContentType(
	site: string,
	contentType: string,
	contentTypesLookup: LookupTable<ContentType>,
	options?: ComponentsContentTypeParams
): Observable<ContentInstancePage>;
export function fetchItemsByContentType(
	site: string,
	contentTypes: string[],
	contentTypesLookup: LookupTable<ContentType>,
	options?: ComponentsContentTypeParams
): Observable<ContentInstancePage>;
export function fetchItemsByContentType(
	site: string,
	contentTypes: string[] | string,
	contentTypesLookup: LookupTable<ContentType>,
	options?: ComponentsContentTypeParams
): Observable<ContentInstancePage> {
	// If content types is null|undefined or if is empty (array or string), return empty values as there's no need to
	// make a request.
	if (
		!contentTypes ||
		(typeof contentTypes === 'string' && contentTypes === '') ||
		(Array.isArray(contentTypes) && contentTypes.length === 0)
	) {
		return of({
			count: 0,
			lookup: {}
		});
	}

	if (typeof contentTypes === 'string') {
		contentTypes = [contentTypes];
	}

	return postJSON(`/studio/api/2/search/search.json?siteId=${site}`, {
		...options,
		filters: { 'content-type': contentTypes }
	}).pipe(
		map<AjaxResponse<SearchServiceResponse>, { count: number; paths: string[] }>(({ response }) => ({
			count: response.result.total,
			paths: response.result.items.map((item) => item.path)
		})),
		switchMap(({ paths, count }) =>
			zip(
				of(count),
				paths.length
					? forkJoin(
							paths.reduce((array, path) => {
								array.push(fetchContentInstance(site, path, contentTypesLookup));
								return array;
							}, []) as Array<Observable<ContentInstance>>
						)
					: of([])
			)
		),
		map(([count, array]) => {
			return {
				count,
				lookup: array.reduce(
					(hash, contentInstance) => Object.assign(hash, { [contentInstance.craftercms.path]: contentInstance }),
					{}
				)
			};
		})
	);
}
// endregion

export function formatXML(site: string, path: string): Observable<boolean> {
	return fetchContentDOM(site, path).pipe(
		switchMap((doc) =>
			fromPromise(beautify(serialize(doc))).pipe(switchMap((xml) => writeContent(site, path, xml, { unlock: true })))
		),
		map(() => true)
	);
}

interface LegacyContentDocumentProps {
	'content-type': string;
	'display-template': string;
	'internal-name': string;
	'file-name': string;
	'merge-strategy': string;
	createdDate_dt: string;
	lastModifiedDate_dt: string;
	objectId: string;
	locale?: string;
	placeInNav?: 'true' | 'false';
}

interface AnyObject {
	[key: string]: any;
}

// Updates a component's parent id (the item that contains the component).
// If the component is embedded, update its ids too. When shared it needs to be done separately because the item
// needs to be fetched.
function updateItemId(item: Element, skipShared: boolean = false): { modelId: string; path: string } {
	const component = item.querySelector(':scope > component');
	const key = item.querySelector(':scope > key');
	const id = uuid();
	if (component) {
		// embedded component
		updateComponentId(component, id);
		key.innerHTML = id;
		return {
			modelId: id,
			path: null
		};
	} else if (!skipShared) {
		// shared component
		const originalPath = key.textContent;
		const basePath = originalPath.split('/').slice(0, -1).join('/');
		const newPath = `${basePath}/${id}.xml`;

		const include = item.querySelector(':scope > include');
		key.innerHTML = newPath;
		include.innerHTML = newPath;
		return {
			modelId: id,
			path: basePath
		};
	}
}

// Updates the ids of a component (shared/embedded)
function updateComponentId(component: Element, id: string): void {
	const objectId = component.querySelector(':scope > objectId');
	const fileName = component.querySelector(':scope > file-name');

	component.id = id;
	// Update the file name even if not a UUID (manually assigned name). Otherwise, it could override
	// the existing document when duplicating and the UI has no visibility of whether
	// there could be other duplicates already to create a meaningful name.
	fileName.innerHTML = `${id}.xml`;
	objectId.innerHTML = id;

	updateElementComponentsId(component);
}

// Updates the ids of the embedded components inside an element
// It looks for items inside a component and update its ids (skipping shared).
function updateElementComponentsId(element: Element): void {
	element.querySelectorAll('item').forEach((item) => {
		updateItemId(item, true);
	});
}

function extractNode(doc: XMLDocument | Element, fieldId: string, index: string | number) {
	const indexes = index === '' || nou(index) ? [] : `${index}`.split('.').map((i) => parseInt(i, 10));
	let aux: Element = (doc as XMLDocument).documentElement ?? (doc as Element);
	if (nou(index) || isBlank(`${index}`)) {
		return aux.querySelector(`:scope > ${fieldId}`);
	}
	const fields = fieldId.split('.');
	if (indexes.length > fields.length) {
		// There's more indexes than fields
		throw new Error(
			'[content/extractNode] Path not handled: indexes.length > fields.length. Indexes ' +
				`is ${indexes} and fields is ${fields}`
		);
	}
	indexes.forEach((_index, i) => {
		const field = fields[i];
		aux = aux.querySelectorAll(`:scope > ${field} > item`)[_index];
	});
	if (indexes.length === fields.length) {
		return aux;
	} else if (indexes.length < fields.length) {
		// There's one more field to use as there were less indexes
		// than there were fields. For example: fieldId: `items_o.content_o`, index: 0
		// At this point, aux would be `items_o[0]` and we need to extract `content_o`
		const field = fields[fields.length - 1];
		return aux.querySelector(`:scope > ${field}`);
	}
}

function mergeContentDocumentProps(type: 'page' | 'component', data: AnyObject): LegacyContentDocumentProps {
	// Dasherized props...
	// content-type, display-template, no-template-required, internal-name, file-name
	// merge-strategy, folder-name, parent-descriptor
	const now = data.lastModifiedDate_dt && data.createdDate_dt ? null : createModifiedDate();
	const dateCreated = data.createdDate_dt ? data.createdDate_dt : now;
	const dateModified = data.lastModifiedDate_dt ? data.lastModifiedDate_dt : now;
	return Object.assign(
		{
			'content-type': '',
			'display-template': '',
			'internal-name': '',
			'file-name': '',
			'merge-strategy': 'inherit-levels',
			createdDate_dt: dateCreated,
			lastModifiedDate_dt: dateModified,
			objectId: ''
		},
		type === 'page' ? { placeInNav: 'false' as 'false' } : {},
		data
	);
}

function createModifiedDate(): string {
	return new Date().toISOString();
}

function updateModifiedDateElement(doc: Element): void {
	const date = createModifiedDate();
	(doc.querySelector(':scope > lastModifiedDate') ?? { innerHTML: '' }).innerHTML = date;
	(doc.querySelector(':scope > lastModifiedDate_dt') ?? { innerHTML: '' }).innerHTML = date;
}

function updateCreatedDateElement(doc: Element): void {
	const date = createModifiedDate();
	(doc.querySelector(':scope > createdDate') ?? { innerHTML: '' }).innerHTML = date;
	(doc.querySelector(':scope > createdDate_dt') ?? { innerHTML: '' }).innerHTML = date;
}

function insertCollectionItem(
	element: Element,
	fieldId: string,
	targetIndex: string | number,
	newItem: Node,
	currentIndex?: number
): void {
	let fieldNode = extractNode(element, fieldId, removeLastPiece(`${targetIndex}`));
	let index = typeof targetIndex === 'string' ? parseInt(popPiece(targetIndex)) : targetIndex;

	// If currentIndex it means the op is a 'sort', and the index(targetIndex) needs to plus 1 or no
	if (nnou(currentIndex)) {
		let currentIndexParsed = typeof currentIndex === 'string' ? parseInt(popPiece(currentIndex)) : currentIndex;
		let targetIndexParsed = typeof targetIndex === 'string' ? parseInt(popPiece(targetIndex)) : targetIndex;
		if (currentIndexParsed > targetIndexParsed) {
			index = typeof targetIndex === 'string' ? parseInt(popPiece(targetIndex)) : targetIndex;
		} else {
			index = typeof targetIndex === 'string' ? parseInt(popPiece(targetIndex)) + 1 : targetIndex + 1;
		}
	}

	if (nou(fieldNode)) {
		fieldNode = createElement(fieldId);
		fieldNode.setAttribute('item-list', 'true');
		element.appendChild(fieldNode);
	}

	const itemList = fieldNode.querySelectorAll(`:scope > item`);

	if (itemList.length === index) {
		fieldNode.appendChild(newItem);
	} else {
		fieldNode.insertBefore(newItem, itemList[index]);
	}
}

export function createFileUpload(
	uploadUrl: string,
	file: any,
	path: string,
	uploadMeta: (Record<string, unknown> & { site: string }) | (Record<string, unknown> & { siteId: string }),
	xsrfArgumentName: string = '_csrf'
): Observable<StandardAction> {
	const blob = file.blob ?? dataUriToBlob(file.dataUrl);
	return uploadBlob(
		(uploadMeta?.site ?? uploadMeta?.siteId) as string,
		path,
		{ name: file.name, type: file.type, blob },
		uploadMeta,
		uploadUrl,
		xsrfArgumentName
	);
}

// region uploadBlob
export function uploadBlob(
	site: string,
	path: string,
	fileData: {
		name: string;
		type: string;
		blob: Blob;
	}
): Observable<StandardAction>;
export function uploadBlob(
	site: string,
	path: string,
	fileData: {
		name: string;
		type: string;
		blob: Blob;
	},
	uploadMeta: Record<string, unknown>
): Observable<StandardAction>;
export function uploadBlob(
	site: string,
	path: string,
	fileData: {
		name: string;
		type: string;
		blob: Blob;
	},
	uploadMeta: Record<string, unknown>,
	uploadUrl: string
): Observable<StandardAction>;
export function uploadBlob(
	site: string,
	path: string,
	fileData: {
		name: string;
		type: string;
		blob: Blob;
	},
	uploadMeta: Record<string, unknown>,
	uploadUrl: string,
	xsrfArgumentName: string
): Observable<StandardAction>;
export function uploadBlob(
	site: string,
	path: string,
	fileData: {
		name: string;
		type: string;
		blob: Blob;
	},
	uploadMeta: Record<string, unknown> = {},
	uploadUrl: string = `/studio/api/2/content/${site}`,
	xsrfArgumentName: string = '_csrf'
): Observable<StandardAction> {
	const qs = toQueryString({ [xsrfArgumentName]: getRequestForgeryToken() });
	return new Observable((subscriber) => {
		const uppy = new Core({ autoProceed: true });

		uppy.use(XHRUpload, { endpoint: `${uploadUrl}${qs}`, method: 'PUT', headers: getGlobalHeaders() });

		const fullPath = ensureSingleSlash(`${path}/${fileData.name}`);
		uppy.setMeta({ ...uploadMeta, path: fullPath });

		uppy.on('upload-success', (file, response) => {
			subscriber.next({ type: 'complete', payload: response });
			subscriber.complete();
		});

		uppy.on('upload-progress', (file, progress) => {
			subscriber.next({ type: 'progress', payload: { file, progress } });
		});

		uppy.on('upload-error', (file, error, response) => {
			response.error = response;
			subscriber.error(response);
		});

		uppy.addFile({ name: fileData.name, type: fileData.type, data: fileData.blob });

		return () => {
			uppy.cancelAll();
		};
	});
}
// endregion

export function uploadDataUrl(
	site: string,
	file: any,
	path: string,
	xsrfArgumentName: string
): Observable<StandardAction> {
	return createFileUpload(
		`/studio/api/2/content/${site}`,
		file,
		path,
		{
			site,
			name: file.name,
			type: file.type,
			path
		},
		xsrfArgumentName
	);
}

export function uploadToS3(
	site: string,
	file: any,
	path: string,
	profileId: string,
	xsrfArgumentName: string
): Observable<StandardAction> {
	return createFileUpload(
		'/studio/api/2/aws/s3/upload.json',
		file,
		path,
		{
			name: file.name,
			type: file.type,
			siteId: site,
			path,
			profileId: profileId
		},
		xsrfArgumentName
	);
}

export function uploadToWebDAV(
	site: string,
	file: any,
	path: string,
	profileId: string,
	xsrfArgumentName: string
): Observable<StandardAction> {
	return createFileUpload(
		'/studio/api/2/webdav/upload',
		file,
		path,
		{
			name: file.name,
			type: file.type,
			siteId: site,
			path,
			profileId: profileId
		},
		xsrfArgumentName
	);
}

export function getBulkUploadUrl(site: string, path: string): string {
	const qs = toQueryString({ _csrf: getRequestForgeryToken() });
	return `/studio/api/2/content/${site}${qs}`;
}

export function fetchQuickCreateList(site: string): Observable<QuickCreateItem[]> {
	return get(`/studio/api/2/content/list_quick_create_content.json${toQueryString({ siteId: site })}`).pipe(
		pluck('response', 'items')
	);
}

export function fetchItemHistory(site: string, path: string): Observable<ItemHistoryEntry[]> {
	return get(`/studio/api/2/content/item_history${toQueryString({ siteId: site, path })}`).pipe(
		pluck('response', 'items')
	);
}

export function revertTo(site: string, path: string, commitId: string): Observable<AjaxResponse<ApiResponse>> {
	return postJSON(`/studio/api/2/content/${site}/revert`, {
		path,
		commitId
	});
}

interface VersionDescriptor {
	site: string;
	path: string;
	versionNumber: string;
	content: ContentInstance;
}

export function fetchItemVersion(site: string, path: string, versionNumber: string): Observable<VersionDescriptor> {
	return of({
		site,
		path,
		versionNumber,
		content: null
	});
}

export function fetchVersions(
	site: string,
	versions: ItemHistoryEntry[]
): Observable<[VersionDescriptor, VersionDescriptor]> {
	return of([
		{
			site,
			path: versions[0].path,
			versionNumber: versions[0].versionNumber,
			content: null
		},
		{
			site,
			path: versions[1].path,
			versionNumber: versions[1].versionNumber,
			content: null
		}
	]);
}

export function fetchChildrenByPath(
	siteId: string,
	path: string,
	options?: Partial<GetChildrenOptions>
): Observable<GetChildrenResponse> {
	return fetchChildrenByPaths(siteId, { [path]: options }).pipe(map((data) => data[path]));
}

/**
 * siteId {string} The site id.
 * fetchOptionsByPath {LookupTable<Partial<GetChildrenOptions>>} A lookup table of paths and their respective options.
 * options {GetChildrenOptions} Options that will be applied to all the path requests.
 * */
export function fetchChildrenByPaths(
	siteId: string,
	fetchOptionsByPath: LookupTable<Partial<GetChildrenOptions>>,
	options?: Partial<GetChildrenOptions>
): Observable<LookupTable<GetChildrenResponse>> {
	const paths = Object.keys(fetchOptionsByPath).map((path) => ({ path, ...options, ...fetchOptionsByPath[path] }));
	return paths.length === 0
		? of({})
		: postJSON(`/studio/api/2/content/${siteId}/children`, { paths }).pipe(
				map(({ response: { items } }) => {
					const data = {};
					items.forEach(({ children, levelDescriptor, total, offset, limit, path }) => {
						const totalWithDescriptor = levelDescriptor ? total + 1 : total;
						data[path] = Object.assign(children ? children.map((child) => prepareVirtualItemProps(child)) : [], {
							levelDescriptor: levelDescriptor ? prepareVirtualItemProps(levelDescriptor) : null,
							total: totalWithDescriptor,
							offset,
							limit
						});
					});
					return data;
				})
			);
}

// region export function fetchContentItems(...
export function fetchContentItems(siteId: string, paths: string[]): Observable<FetchItemsByPathArray<ContentItem>>;
export function fetchContentItems(
	siteId: string,
	paths: string[],
	options: FetchItemsByPathOptions
): Observable<FetchItemsByPathArray<ContentItem>>;
export function fetchContentItems(
	siteId: string,
	paths: string[],
	options?: FetchItemsByPathOptions
): Observable<FetchItemsByPathArray<ContentItem>> {
	if (!paths?.length) {
		return of([] as FetchItemsByPathArray<ContentItem>);
	}
	const { preferContent = true } = options ?? {};
	return postJSON('/studio/api/2/content/sandbox_items_by_path', { siteId, paths, preferContent }).pipe(
		pluck('response'),
		map(({ items, missingItems }) =>
			Object.assign(items.map((item) => prepareVirtualItemProps(item)) as ContentItem[], {
				missingItems
			})
		)
	);
}
// endregion

// region export function fetchItemByPath(...
export function fetchItemByPath(siteId: string, path: string): Observable<ContentItem>;
export function fetchItemByPath(
	siteId: string,
	path: string,
	options: FetchItemsByPathOptions
): Observable<ContentItem>;
export function fetchItemByPath(
	siteId: string,
	path: string,
	options?: FetchItemsByPathOptions
): Observable<ContentItem> {
	return fetchContentItems(siteId, [path], options).pipe(
		tap((items) => {
			if (items[0] === void 0) {
				// Fake out the 404 which the backend won't return for this bulk API
				// eslint-disable-next-line no-throw-literal
				throw {
					name: 'AjaxError',
					status: 404,
					response: {
						response: {
							code: 7000,
							message: 'Content not found',
							remedialAction: `Check that path '${path}' is correct and it exists in site '${siteId}'`,
							documentationUrl: ''
						}
					}
				};
			}
		}),
		pluck(0)
	);
}
// endregion

export function fetchItemWithChildrenByPath(
	siteId: string,
	path: string,
	options?: Partial<GetChildrenOptions>
): Observable<GetItemWithChildrenResponse> {
	return forkJoin({
		item: fetchItemByPath(siteId, path),
		children: fetchChildrenByPath(siteId, path, options)
	});
}

export function paste(siteId: string, targetPath: string, clipboard: Clipboard): Observable<any> {
	return postJSON(`/studio/api/2/content/${siteId}/paste`, {
		operation: clipboard.type,
		sourcePath: clipboard.sourcePath,
		targetPath,
		includeChildren: clipboard.includeChildren
	}).pipe(pluck('response'));
}

export function duplicate(siteId: string, path: string): Observable<any> {
	return postJSON('/studio/api/2/content/duplicate', {
		siteId,
		path
	}).pipe(pluck('response'));
}

export function deleteItems(
	siteId: string,
	items: string[],
	title: string,
	comment: string,
	optionalDependencies?: string[]
): Observable<boolean> {
	return postJSON('/studio/api/2/content/delete', {
		siteId,
		items,
		optionalDependencies,
		title,
		comment
	}).pipe(map(() => true));
}

export function lock(siteId: string, path: string): Observable<boolean> {
	return postJSON('/studio/api/2/content/item_lock_by_path', { siteId, path }).pipe(map(() => true));
}

export function unlock(siteId: string, path: string): Observable<boolean> {
	return postJSON('/studio/api/2/content/item_unlock_by_path', { siteId, path }).pipe(
		map(() => true),
		// Do not throw/report 409 (item is already unlocked) as an error.
		catchError((error) => {
			if (error.status === 409) {
				return of(false);
			} else {
				throw error;
			}
		})
	);
}

export function createFolder(site: string, path: string, name: string): Observable<unknown> {
	return postJSON(`/studio/api/2/content/${site}/folder`, {
		path: ensureSingleSlash(`${path}/${name}`)
	});
}

export function createFile(site: string, path: string, fileName: string): Observable<unknown> {
	const fullPath = ensureSingleSlash(`${path}/${fileName}`);
	return writeContent(site, fullPath, '', { unlock: true });
}

export function renameFolder(site: string, path: string, name: string) {
	return renameContent(site, path, name);
}

export function renameContent(siteId: string, path: string, name: string) {
	return postJSON(`/studio/api/2/content/rename`, { siteId, path, name }).pipe(pluck('response'));
}

export function checkPathExistence(siteId: string, path: string): Observable<boolean> {
	return get(`/studio/api/2/content/exists${toQueryString({ siteId, path })}`).pipe(
		map(({ response }) => response.exists)
	);
}

export function fetchContentByCommitId(site: string, path: string, commitId: string): Observable<string | Blob> {
	return getBinary(
		`/studio/api/2/content/get_content_by_commit_id${toQueryString({ siteId: site, path, commitId })}`,
		void 0,
		'blob'
	).pipe(
		switchMap((ajax) => {
			const blob = ajax.response;
			const type = (ajax.xhr.getResponseHeader('content-type') || '').toLowerCase();
			if (isMediaContent(type) || isPdfDocument(type)) {
				return of(URL.createObjectURL(blob));
			} else if (isTextContent(type)) {
				return blob.text() as Promise<string>;
			} else {
				return of(blob);
			}
		})
	);
}

export interface PageNavItem {
	path: string;
	order: number;
	label: string;
}

export function getNavItemsOrder(siteId: string, parentPath: string): Observable<PageNavItem[]> {
	const qs = toQueryString({ parentPath });
	return get(`/studio/api/2/content/${siteId}/order${qs}`).pipe(map((response) => response?.response?.items));
}

export type ReorderNavItemsRequest =
	| { type: 'addBefore'; referencePath: string }
	| { type: 'addAfter'; referencePath: string }
	| { type: 'insertBetween'; previousPath: string; nextPath: string };

/**
 * Calculates a new nav order value for the current page based on its neighbors.
 * The caller must persist the returned `order` onto the page's `orderDefault_f` field.
 */
export function reorderNavItems(siteId: string, request: ReorderNavItemsRequest): Observable<{ order: number }> {
	return postJSON(`/studio/api/2/content/${siteId}/order/reorder`, request).pipe(
		map((response) => ({ order: response?.response?.order as number }))
	);
}
