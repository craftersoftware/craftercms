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

import { ContentItem, ItemActionsMap, ItemStateMap, LegacyItem } from '../models/Item';
import { getStateMapFromLegacyItem } from './state';
import { nnou, nou } from './object';
import { ContentType, ContentTypeField } from '../models/ContentType';
import LookupTable from '../models/LookupTable';
import ContentInstance, { ContentInstanceBase } from '../models/ContentInstance';
import { deserialize, fromString, getInnerHtml, getInnerHtmlNumber, serialize, wrapElementInAuxDocument } from './xml';
import { fileNameFromPath, replaceAccentedVowels, unescapeHTML } from './string';
import { getRootPath, isRootPath, withIndex, withoutIndex } from './path';
import { isFolder, isNavigable, isPreviewable } from '../components/PathNavigator/utils';
import {
	CONTENT_CHANGE_TYPE_MASK,
	CONTENT_COPY_MASK,
	CONTENT_CREATE_MASK,
	CONTENT_CUT_MASK,
	CONTENT_DELETE_CONTROLLER_MASK,
	CONTENT_DELETE_MASK,
	CONTENT_DELETE_TEMPLATE_MASK,
	CONTENT_DUPLICATE_MASK,
	CONTENT_EDIT_CONTROLLER_MASK,
	CONTENT_EDIT_MASK,
	CONTENT_EDIT_TEMPLATE_MASK,
	CONTENT_GET_DEPENDENCIES_ACTION_MASK,
	CONTENT_ITEM_UNLOCK,
	CONTENT_PASTE_MASK,
	CONTENT_READ_VERSION_HISTORY_MASK,
	CONTENT_RENAME_MASK,
	CONTENT_REVERT_MASK,
	CONTENT_UPLOAD_MASK,
	FOLDER_CREATE_MASK,
	PACKAGE_APPROVE_MASK,
	PACKAGE_CANCEL_MASK,
	PACKAGE_REJECT_MASK,
	PACKAGE_RESUBMIT_MASK,
	pageControllersFieldId,
	pageControllersLegacyFieldId,
	PUBLISH_APPROVE_MASK,
	PUBLISH_MASK,
	PUBLISH_REJECT_MASK,
	PUBLISH_REQUEST_MASK,
	PUBLISH_SCHEDULE_MASK,
	PUBLISHING_DESTINATION_MASK,
	PUBLISHING_LIVE_MASK,
	PUBLISHING_STAGED_MASK,
	READ_MASK,
	STATE_DELETED_MASK,
	STATE_DISABLED_MASK,
	STATE_LOCKED_MASK,
	STATE_MODIFIED_MASK,
	STATE_NEW_MASK,
	STATE_PUBLISHING_MASK,
	STATE_SCHEDULED_MASK,
	STATE_SUBMITTED_MASK,
	STATE_SYSTEM_PROCESSING_MASK,
	STATE_TRANSLATION_IN_PROGRESS_MASK,
	STATE_TRANSLATION_PENDING_MASK,
	STATE_TRANSLATION_UP_TO_DATE_MASK
} from './constants';
import { SystemType } from '../models/SystemType';
import { getStateBitmap } from '../components/WorkflowStateManagement/utils';
import { forEach } from './array';
import { PublishingTargets } from '../models';
import slugify from 'slugify';
import { Dispatch } from 'react';
import { AnyAction } from 'redux';
import { findParentModelId, getModelIdFromInheritedField, isInheritedField } from './model';
import { XmlKeys } from '../components/FormsEngine/lib/formConsts';
import { pushDialog } from '../state/actions/dialogStack';
import { nanoid } from 'nanoid';
import { createComponentId, pickShowContentFormAction } from './system';
import { popCodeEditorDialog } from '../state/actions/dialogs';
import { ImageRestrictions } from '../components/ImageEditorDialog/types';

export function isEditableAsset(path: string) {
	return (
		path.endsWith('.ftl') ||
		path.endsWith('.css') ||
		path.endsWith('.js') ||
		path.endsWith('.groovy') ||
		path.endsWith('.txt') ||
		path.endsWith('.html') ||
		path.endsWith('.hbs') ||
		(path.endsWith('.xml') && !path.startsWith('/config/studio/content-types')) ||
		path.endsWith('.tmpl') ||
		path.endsWith('.htm') ||
		path.endsWith('.sass') ||
		path.endsWith('.scss') ||
		path.endsWith('.less') ||
		path.endsWith('.csv') ||
		path.endsWith('.json') ||
		path.endsWith('.yaml') ||
		path.endsWith('.yml')
	);
}

export function isAsset(path: string): boolean {
	return (
		path.endsWith('.jpg') ||
		path.endsWith('.png') ||
		path.endsWith('.svg') ||
		path.endsWith('.jpeg') ||
		path.endsWith('.gif') ||
		path.endsWith('.pdf') ||
		path.endsWith('.doc') ||
		path.endsWith('.docx') ||
		path.endsWith('.xls') ||
		path.endsWith('.xlsx') ||
		path.endsWith('.ppt') ||
		path.endsWith('.pptx') ||
		path.endsWith('.mp4') ||
		path.endsWith('.avi') ||
		path.endsWith('.webm') ||
		path.endsWith('.mpg')
	);
}

export function isCode(path: string): boolean {
	return (
		path.endsWith('.ftl') ||
		path.endsWith('.css') ||
		path.endsWith('.js') ||
		path.endsWith('.groovy') ||
		path.endsWith('.html') ||
		path.endsWith('.hbs') ||
		path.endsWith('.tmpl') ||
		path.endsWith('.htm')
	);
}

export function isImage(path: string): boolean {
	return (
		path.endsWith('.jpg') ||
		path.endsWith('.png') ||
		path.endsWith('.svg') ||
		path.endsWith('.jpeg') ||
		path.endsWith('.gif')
	);
}

// TODO: check why is LegacyItem accepted.
export function isItemLockedForMe(item: ContentItem | LegacyItem, username: string): boolean {
	return item ? isLockedState(item.state) && item.lockOwner?.username !== username : true;
}

export function isBlobUrl(url: string): boolean {
	return url.startsWith('blob:');
}

export function isInActiveWorkflow(item: ContentItem): boolean {
	return item.stateMap.scheduled || item.stateMap.submitted;
}

/**
 * TODO: Remove?
 * Returns the boolean intersection of editMode, lock status and the item's edit permission
 */
export function getComputedEditMode({
	item,
	username,
	editMode
}: {
	item: ContentItem;
	username: string;
	editMode: boolean;
}): boolean {
	return isItemLockedForMe(item, username) || !hasEditAction(item.availableActions) ? false : editMode;
}

export function getSystemTypeFromPath(path: string): SystemType {
	const rootPath = getRootPath(path);
	if (rootPath.includes('/site/website')) {
		return 'page';
	} else if (rootPath.includes('/components')) {
		return 'component';
	} else if (rootPath.includes('/taxonomy')) {
		return 'taxonomy';
	} else if (rootPath.includes('/templates')) {
		return 'renderingTemplate';
	} else if (rootPath.includes('/static-assets')) {
		return 'asset';
	} else if (rootPath.includes('script')) {
		return 'script';
	} else {
		return 'file';
	}
}

export const systemPropsList = [
	'orderDefault_f',
	'savedAsDraft',
	'content-type',
	'display-template',
	'no-template-required',
	'merge-strategy',
	'objectGroupId',
	'objectId',
	'file-name',
	'folder-name',
	'internal-name',
	'disabled',
	'createdDate',
	'createdDate_dt',
	'lastModifiedDate',
	'lastModifiedDate_dt'
];

export const systemPropMap = {
	[XmlKeys.fileName]: 'fileName',
	[XmlKeys.internalName]: 'label',
	[XmlKeys.contentTypeId]: 'contentTypeId',
	[XmlKeys.dateCreated]: 'dateCreated',
	[XmlKeys.dateCreatedDt]: 'dateCreated',
	[XmlKeys.dateModified]: 'dateModified',
	[XmlKeys.dateModifiedDt]: 'dateModified',
	disabled: 'disabled',
	orderDefault_f: 'orderInNav'
};

/**
 * doc {XMLDocument}
 * path {string}
 * contentTypesLookup {LookupTable<ContentType>}
 * instanceLookup {LookupTable<ContentInstance>}
 * unflattenedPaths {LookupTable<ContentInstance>} A lookup table directly completed/mutated by this function indexed by path of those objects that are incomplete/unflattened
 */
export function parseContentXML(
	doc: XMLDocument,
	path: string = null,
	contentTypesLookup: LookupTable<ContentType>,
	instanceLookup: LookupTable<ContentInstance>,
	unflattenedPaths?: LookupTable<ContentInstance>
): ContentInstance {
	let id = nnou(doc) ? getInnerHtml(doc.querySelector(':scope > objectId')) : null;
	if (id === null && !/^[a-f\d]{4}(?:[a-f\d]{4}-){4}[a-f\d]{12}$/i.test((id = fileNameFromPath(path)))) {
		// If the id is not a guid by now, then is simply not available at this time.
		id = null;
	}
	const contentTypeId = nnou(doc) ? getInnerHtml(doc.querySelector(':scope > content-type')) : null;
	const current: ContentInstanceBase = {
		craftercms: {
			id,
			path,
			label: null,
			dateCreated: null,
			dateModified: null,
			contentTypeId,
			disabled: false,
			sourceMap: {}
		}
	};
	// We're assuming that contentTypeId is null when the content is not flattened
	if (contentTypeId === null && unflattenedPaths) {
		unflattenedPaths[path] = current;
	}
	if (nnou(doc)) {
		const internalName = doc.querySelector(':scope > internal-name');
		const labelFromInternalName = internalName ? getInnerHtml(internalName, { applyLegacyUnescaping: true }) : null;
		current.craftercms.label = labelFromInternalName || (path ? fileNameFromPath(path) : '');
		current.craftercms.dateCreated = getInnerHtml(doc.querySelector(`:scope > ${XmlKeys.dateCreatedDt}`));
		current.craftercms.dateModified = getInnerHtml(doc.querySelector(`:scope > ${XmlKeys.dateModifiedDt}`));
		current.craftercms.disabled = getInnerHtml(doc.querySelector(':scope > disabled'), { trim: true }) === 'true';
	}
	id && (instanceLookup[id] = current);
	if (nnou(doc)) {
		Array.from(doc.documentElement.children).forEach((element: Element) => {
			const tagName = element.tagName;
			if (!systemPropsList.includes(tagName)) {
				let sourceContentTypeId;
				const source = element.getAttribute('crafter-source');
				if (source) {
					current.craftercms.sourceMap[tagName] = source;
					sourceContentTypeId = element.getAttribute('crafter-source-content-type-id');
					if (!sourceContentTypeId) {
						console.error(
							`[parseContentXML] No "crafter-source-content-type-id" attribute found together with "crafter-source".`
						);
					}
				}
				const field = contentTypesLookup[sourceContentTypeId ?? contentTypeId]?.fields?.[tagName];
				if (!field) {
					// date-time control handles the timezone field using {controlName}_tz format. So if the field without `tz` is
					// found in the content type, we can ignore the `tz` field (and don't log an error).
					let isTimezoneField = false;
					if (tagName.endsWith('_tz')) {
						const withoutTz = tagName.replace(/_tz$/, '');
						isTimezoneField = Boolean(contentTypesLookup[sourceContentTypeId ?? contentTypeId]?.fields?.[withoutTz]);
					}
					if (!isTimezoneField) {
						console.error(
							`[parseContentXML] Field "${tagName}" was not found on "${
								sourceContentTypeId ?? contentTypeId
							}" content type. "${source ?? path}" may have stale/outdated content properties.`
						);
					}
				}
				current[tagName] = parseElementByContentType(
					element,
					field,
					contentTypesLookup,
					instanceLookup,
					unflattenedPaths
				);
			}
		});
	}
	return current;
}

/**
 * element {Element}
 * field {ContentTypeField}
 * contentTypesLookup {LookupTable<ContentType>}
 * instanceLookup {LookupTable<ContentInstance>}
 * unflattenedPaths {LookupTable<ContentInstance>} A lookup table directly completed/mutated by this function indexed by path of those objects that are incomplete/unflattened
 */
export function parseElementByContentType(
	element: Element,
	field: ContentTypeField,
	contentTypesLookup: LookupTable<ContentType>,
	instanceLookup: LookupTable<ContentInstance>,
	unflattenedPaths?: LookupTable<ContentInstance>
) {
	if (!field) {
		return getInnerHtml(element) ?? '';
	}
	const type = field.type;
	// Some of this parsing (e.g. converting to booleans & numbers) is great but
	// the delivery side APIs don't have this intelligence. Could this cause any issues?
	// In any case, in the future we should go rather by a data-type instead of id of
	// the control as, various controls may produce same data type and the list
	// needn't be updated when new controls are added with a sound list of data types.
	switch (type) {
		case 'repeat': {
			const array = [];
			element.querySelectorAll(':scope > item').forEach((item) => {
				const repeatItem = {};
				item.querySelectorAll(':scope > *').forEach((fieldTag) => {
					let fieldTagName = fieldTag.tagName;
					repeatItem[fieldTagName] = parseElementByContentType(
						fieldTag,
						field.fields[fieldTagName],
						contentTypesLookup,
						instanceLookup,
						unflattenedPaths
					);
				});
				array.push(repeatItem);
			});
			return array;
		}
		case 'node-selector': {
			const array = [];
			const items = element.querySelectorAll(':scope > item');
			if (field.id === pageControllersFieldId || field.id === pageControllersLegacyFieldId) {
				items.forEach((item) => {
					array.push({
						key: getInnerHtml(item.querySelector(':scope > key')),
						value: getInnerHtml(item.querySelector(':scope > value'))
					});
				});
			} else {
				items.forEach((item) => {
					const key = getInnerHtml(item.querySelector(':scope > key'));
					if (key) {
						// Note: as it stands, taxonomies would be considered as "files" and not expanded/parsed as components.
						const isFile =
							// If the `key` tag value is not a path rooted at `/site/website` or `/site/components`
							// or not an `xml` would mean is something other than content (asset, template, script, etc).
							key.match(/^\/site\/(website|components)\/.+\.xml$/) === null &&
							// Embedded components don't have a path as the value of `key` (the guid is the value),
							// but/and they have an `inline` attribute.
							item.getAttribute('inline') !== 'true';
						if (isFile) {
							array.push({
								key,
								value: getInnerHtml(item.querySelector(':scope > value'))
							});
						} else {
							const component = item.querySelector(':scope > component');
							const path = getInnerHtml(item.querySelector(':scope > include')) || (!component ? key : null);
							const instance = parseContentXML(
								component ? wrapElementInAuxDocument(component) : null,
								path,
								contentTypesLookup,
								instanceLookup,
								unflattenedPaths
							);
							array.push(instance);
						}
					} else {
						// Not sure if there can be a case without a `key`. Leaving this case based on the previous code checking for it.
						array.push(item);
					}
				});
			}
			return array;
		}
		case 'rte':
			return unescapeHTML(getInnerHtml(element));
		case 'checkbox-group': {
			const deserialized = deserialize(element);
			const extract = deserialized[element.tagName].item;
			return nou(extract) ? [] : Array.isArray(extract) ? extract : [extract];
		}
		case 'input':
		case 'textarea':
			return getInnerHtml(element, { applyLegacyUnescaping: true });
		case 'image-picker':
		case 'date-time':
		case 'time':
			return getInnerHtml(element);
		case 'dropdown':
			if (field.id.endsWith('_i') || field.id.endsWith('_f')) {
				return getInnerHtmlNumber(element, parseFloat);
			} else {
				return getInnerHtml(element);
			}
		case 'checkbox':
		case 'page-nav-order': // FE2 TODO: This seems wrong, check
			return getInnerHtml(element) === 'true';
		case 'numeric-input':
			return getInnerHtmlNumber(element, parseFloat);
		default:
			!['transcoded-video', 'transcoded-video-picker', 'taxonomy-selector', 'video-picker'].includes(type) &&
				console.log(
					`%c[parseElementByContentType] Missing type "${type}" on switch statement for field "${field.id}".`,
					'color: blue',
					element
				);
			try {
				const extract: any = deserialize(element)?.[element.tagName] ?? '';
				return extract.item ? (Array.isArray(extract.item) ? extract.item : [extract.item]) : extract;
			} catch (e) {
				console.error('[parseElementByContentType] Error deserializing element', element, e);
				return getInnerHtml(element);
			}
	}
}

export interface ModelHierarchyDescriptor {
	modelId: string;
	parentId: string;
	parentContainerFieldPath: string;
	parentContainerFieldIndex: string | number;
	children: Array<string>;
}

export type ModelHierarchyMap = LookupTable<ModelHierarchyDescriptor>;

// region export function createModelHierarchyDescriptor() { ... }
export const createModelHierarchyDescriptor: (
	modelId?: ModelHierarchyDescriptor['modelId'],
	parentId?: ModelHierarchyDescriptor['parentId'],
	parentContainerFieldPath?: ModelHierarchyDescriptor['parentContainerFieldPath'],
	parentContainerFieldIndex?: ModelHierarchyDescriptor['parentContainerFieldIndex'],
	children?: ModelHierarchyDescriptor['children']
) => ModelHierarchyDescriptor = (
	modelId = null,
	parentId = null,
	parentContainerFieldPath = null,
	parentContainerFieldIndex = null,
	children = []
) => ({
	modelId,
	parentId,
	parentContainerFieldPath,
	parentContainerFieldIndex,
	children
});
// endregion

let contentTypeMissingWarningQueue = [];
let contentTypeMissingWarningTimeout: NodeJS.Timeout;

export function createModelHierarchyDescriptorMap(
	normalizedModels: LookupTable<ContentInstance>,
	contentTypes: LookupTable<ContentType>
): ModelHierarchyMap {
	const lookup: ModelHierarchyMap = {};
	// region Internal utils
	const getFields = (contentTypeId) =>
		contentTypes[contentTypeId]?.fields ? Object.values(contentTypes[contentTypeId]?.fields) : null;
	const cleanCarryOver = (carryOver: string) => carryOver.replace(/(^\.+)|(\.+$)/g, '').replace(/\.{2,}/g, '.');
	const contentTypeMissingWarning = (model: ContentInstance) => {
		// Show this warning only if the model has a content type id defined (not null),
		// but it's not present in the content type lookup table.
		if (model.craftercms.contentTypeId && !contentTypes[model.craftercms.contentTypeId]) {
			contentTypeMissingWarningQueue.push(
				`Content type with id "${model.craftercms.contentTypeId}" was not found. ` +
					`Unable to fully process model at "${model.craftercms.path}" with id "${model.craftercms.id}"`
			);
			clearTimeout(contentTypeMissingWarningTimeout);
			contentTypeMissingWarningTimeout = setTimeout(() => {
				console.log(
					`%c[createModelHierarchyDescriptorMap]: \n- ${contentTypeMissingWarningQueue.join('\n- ')}`,
					'color: #f00'
				);
				contentTypeMissingWarningQueue = [];
			}, 200);
		}
	};
	// endregion
	// region Process function
	function process(
		model: ContentInstance,
		source: ContentInstance,
		fields: ContentTypeField[],
		fieldCarryOver = '',
		indexCarryOver = ''
	) {
		const currentModelId = model.craftercms.id;
		if (!lookup[currentModelId]) {
			lookup[currentModelId] = createModelHierarchyDescriptor(currentModelId);
		}
		fields?.forEach((field) => {
			if (
				// Check the field in the model isn't null in case the field isn't required and isn't present on current model.
				source[field.id] &&
				// Only care for these field types: those that can hold components.
				(field.type === 'node-selector' || field.type === 'repeat')
			) {
				if (field.type === 'node-selector') {
					field.id !== pageControllersFieldId &&
						field.id !== pageControllersLegacyFieldId &&
						source[field.id]
							// Just as controllers are not included in HierarchyDescriptor, files inside a node-selector are not included either.
							// (files and controllers are stored as a key/value object)
							.filter((componentId) => typeof componentId === 'string')
							.forEach((componentId, index) => {
								lookup[currentModelId].children.push(componentId);
								if (!lookup[componentId]) {
									// This assignment it's to avoid having to optionally chain multiple times
									// the access to `lookup[component]` below.
									lookup[componentId] = lookup[componentId] ?? ({} as any);
								}
								// Because there's no real warranty that the parent of a model will be processed first
								lookup[componentId] = createModelHierarchyDescriptor(
									componentId,
									lookup[componentId].parentId ?? model.craftercms.id,
									lookup[componentId].parentContainerFieldPath ?? cleanCarryOver(`${fieldCarryOver}.${field.id}`),
									lookup[componentId].parentContainerFieldIndex ?? cleanCarryOver(`${indexCarryOver}.${index}`),
									lookup[componentId].children
								);
							});
				} else if (field.type === 'repeat') {
					source[field.id].forEach((repeatItem: ContentInstance, index) => {
						process(
							model,
							repeatItem,
							Object.values(field.fields),
							cleanCarryOver(`${fieldCarryOver}.${field.id}`),
							cleanCarryOver(`${indexCarryOver}.${index}`)
						);
					});
				}
			}
		});
	}

	// endregion
	Object.values(normalizedModels).forEach((model) => {
		process(model, model, getFields(model.craftercms.contentTypeId));
		contentTypeMissingWarning(model);
	});
	return lookup;
}

/**
 * Returns an array with the ids of the direct descendants of a given model
 */
export function createChildModelIdList(model: ContentInstance, contentTypes: LookupTable<ContentType>): string[] {
	const children = [];

	if (contentTypes) {
		const processFields = (model: ContentInstance, fields: ContentTypeField[], children: string[]) =>
			fields.forEach((field) => {
				// Check the field in the model isn't null in case the field isn't required and isn't present on current model.
				if (model[field.id]) {
					if (field.type === 'node-selector') {
						model[field.id].forEach((mdl: ContentInstance) => children.push(mdl.craftercms.id));
					} else if (field.type === 'repeat') {
						model[field.id].forEach((mdl: ContentInstance) => {
							processFields(mdl, Object.values(field.fields), children);
						});
					}
				}
			});
		if (contentTypes[model.craftercms.contentTypeId]) {
			processFields(model, Object.values(contentTypes[model.craftercms.contentTypeId].fields), children);
		}
	} else {
		Object.entries(model).forEach(([prop, value]) => {
			if (prop.endsWith('_o') && Array.isArray(value)) {
				const collection: ContentInstance[] = value;
				forEach(collection, (item) => {
					if ('craftercms' in item && item.craftercms.id !== null) {
						// Node selector
						children.push(item.craftercms.id);
					} else {
						// Repeating group item
						forEach(Object.entries(item), ([_prop, _value]) => {
							if (_prop.endsWith('_o') && Array.isArray(_value)) {
								const _collection: ContentInstance[] = _value;
								forEach(_collection, (_item) => {
									if ('craftercms' in _item && _item.craftercms.id !== null) {
										children.push(_item.craftercms.id);
									} else {
										// Not a node selector, no point to continue iterating
										// Subsequent levels are calculated by calling this function
										// with that model as the argument
										return 'break';
									}
								});
							}
						});
					}
				});
			}
		});
	}

	return children;
}

/**
 * Returns a lookup table as `{ [modelId]: [childModelId1, childModelId2, ...], ... }`
 */
export function createChildModelLookup(
	models: LookupTable<ContentInstance>,
	contentTypes: LookupTable<ContentType>
): LookupTable<string[]> {
	const lookup = {};
	Object.values(models).forEach((model) => {
		lookup[model.craftercms.id] = createChildModelIdList(model, contentTypes);
	});
	return lookup;
}

export function normalizeModelsLookup(models: LookupTable<ContentInstance>): LookupTable<ContentInstance> {
	const lookup = {};
	Object.entries(models).forEach(([id, model]) => {
		lookup[id] = normalizeModel(model);
	});
	return lookup;
}

export function normalizeModel(model: ContentInstance): ContentInstance {
	const normalized = { ...model };
	Object.entries(model).forEach(([prop, value]) => {
		if (prop === pageControllersFieldId) {
			normalized[prop] = value;
		} else if (
			// Using `prop.endsWith('_o')` causes issues with old sites which might not be using the post fix.
			Array.isArray(value) &&
			value.length
		) {
			const collection: ContentInstance[] = value;
			const isComponentsNodeSelector = collection.every((item) => Boolean(item.craftercms?.id));
			if (isComponentsNodeSelector) {
				normalized[prop] = collection.map((item) => item.craftercms.id);
			} else {
				normalized[prop] = collection.map((item) => normalizeModel(item));
			}
		}
	});
	return normalized;
}

export function denormalizeModel(
	normalized: ContentInstance,
	modelLookup: LookupTable<ContentInstance>
): ContentInstance {
	const model = { ...normalized };
	Object.entries(model).forEach(([prop, value]) => {
		if (prop.endsWith('_o')) {
			const collection: unknown = value;
			// Cover cases (collection?.length) where the xml has an empty tag corresponding to the `someField_o` without content.
			if (Array.isArray(collection) && collection.length) {
				const isNodeSelector = typeof collection[0] === 'string';
				if (isNodeSelector) {
					model[prop] = collection.map((item) => denormalizeModel(modelLookup[item], modelLookup));
				} else {
					model[prop] = collection.map((item) => denormalizeModel(item, modelLookup));
				}
			}
		}
	});
	return model;
}

export function getNumOfMenuOptionsForItem(item: ContentItem): number {
	if (isNavigable(item)) {
		return isRootPath(item.path) ? 11 : 16;
	} else if (isFolder(item)) {
		return isRootPath(item.path)
			? item.path.startsWith('/templates') || item.path.startsWith('/scripts')
				? 4
				: 3
			: item.path.startsWith('/templates') || item.path.startsWith('/scripts')
				? 7
				: 6;
	} else if (isPreviewable(item)) {
		return item.systemType === 'component' || item.systemType === 'taxonomy' ? 11 : 10;
	}
}

// region State checker functions
export const isNewState = (value: number) => Boolean(value & STATE_NEW_MASK);
export const isModifiedState = (value: number) => Boolean(value & STATE_MODIFIED_MASK);
export const isDeletedState = (value: number) => Boolean(value & STATE_DELETED_MASK);
export const isLockedState = (value: number) => Boolean(value & STATE_LOCKED_MASK);
export const isSystemProcessingState = (value: number) => Boolean(value & STATE_SYSTEM_PROCESSING_MASK);
export const isSubmittedState = (value: number) => Boolean(value & STATE_SUBMITTED_MASK);
export const isScheduledState = (value: number) => Boolean(value & STATE_SCHEDULED_MASK);
export const isPublishingState = (value: number) => Boolean(value & STATE_PUBLISHING_MASK);
export const isSubmittedToStaging = (value: number) =>
	(isSubmittedState(value) || isScheduledState(value) || isPublishingState(value)) &&
	!Boolean(value & PUBLISHING_DESTINATION_MASK);
export const isSubmittedToLive = (value: number) =>
	(isSubmittedState(value) || isScheduledState(value) || isPublishingState(value)) &&
	Boolean(value & PUBLISHING_DESTINATION_MASK);
export const isStaged = (value: number) => Boolean(value & PUBLISHING_STAGED_MASK);
export const isLive = (value: number) => Boolean(value & PUBLISHING_LIVE_MASK);
export const isDisabled = (value: number) => Boolean(value & STATE_DISABLED_MASK);
export const isTranslationUpToDateState = (value: number) => Boolean(value & STATE_TRANSLATION_UP_TO_DATE_MASK);
export const isTranslationPendingState = (value: number) => Boolean(value & STATE_TRANSLATION_PENDING_MASK);
export const isTranslationInProgressState = (value: number) => Boolean(value & STATE_TRANSLATION_IN_PROGRESS_MASK);
// endregion

export const createItemStateMap: (status: number) => ItemStateMap = (status: number) => ({
	new: isNewState(status),
	modified: isModifiedState(status),
	deleted: isDeletedState(status),
	locked: isLockedState(status),
	systemProcessing: isSystemProcessingState(status),
	submitted: isSubmittedState(status),
	scheduled: isScheduledState(status),
	publishing: isPublishingState(status),
	submittedToStaging: isSubmittedToStaging(status),
	submittedToLive: isSubmittedToLive(status),
	staged: isStaged(status),
	live: isLive(status),
	disabled: isDisabled(status),
	translationUpToDate: isTranslationUpToDateState(status),
	translationPending: isTranslationPendingState(status),
	translationInProgress: isTranslationInProgressState(status)
});

// region Item Action presence checker functions
export const hasReadAction = (value: number) => Boolean(value & READ_MASK);
export const hasCopyAction = (value: number) => Boolean(value & CONTENT_COPY_MASK);
export const hasReadHistoryAction = (value: number) => Boolean(value & CONTENT_READ_VERSION_HISTORY_MASK);
export const hasGetDependenciesAction = (value: number) => Boolean(value & CONTENT_GET_DEPENDENCIES_ACTION_MASK);
export const hasPublishRequestAction = (value: number) => Boolean(value & PUBLISH_REQUEST_MASK);
export const hasCreateAction = (value: number) => Boolean(value & CONTENT_CREATE_MASK);
export const hasPasteAction = (value: number) => Boolean(value & CONTENT_PASTE_MASK);
export const hasEditAction = (value: number) => Boolean(value & CONTENT_EDIT_MASK);
export const hasRenameAction = (value: number) => Boolean(value & CONTENT_RENAME_MASK);
export const hasCutAction = (value: number) => Boolean(value & CONTENT_CUT_MASK);
export const hasUploadAction = (value: number) => Boolean(value & CONTENT_UPLOAD_MASK);
export const hasDuplicateAction = (value: number) => Boolean(value & CONTENT_DUPLICATE_MASK);
export const hasChangeTypeAction = (value: number) => Boolean(value & CONTENT_CHANGE_TYPE_MASK);
export const hasRevertAction = (value: number) => Boolean(value & CONTENT_REVERT_MASK);
export const hasEditControllerAction = (value: number) => Boolean(value & CONTENT_EDIT_CONTROLLER_MASK);
export const hasEditTemplateAction = (value: number) => Boolean(value & CONTENT_EDIT_TEMPLATE_MASK);
export const hasCreateFolderAction = (value: number) => Boolean(value & FOLDER_CREATE_MASK);
export const hasContentDeleteAction = (value: number) => Boolean(value & CONTENT_DELETE_MASK);
export const hasDeleteControllerAction = (value: number) => Boolean(value & CONTENT_DELETE_CONTROLLER_MASK);
export const hasDeleteTemplateAction = (value: number) => Boolean(value & CONTENT_DELETE_TEMPLATE_MASK);
export const hasPublishAction = (value: number) => Boolean(value & PUBLISH_MASK);
export const hasApprovePublishAction = (value: number) => Boolean(value & PUBLISH_APPROVE_MASK);
export const hasSchedulePublishAction = (value: number) => Boolean(value & PUBLISH_SCHEDULE_MASK);
export const hasPublishRejectAction = (value: number) => Boolean(value & PUBLISH_REJECT_MASK);
export const hasUnlockAction = (value: number) => Boolean(value & CONTENT_ITEM_UNLOCK);
// endregion

export const createItemActionMap: (availableActions: number) => ItemActionsMap = (value: number) => ({
	view: hasReadAction(value),
	copy: hasCopyAction(value),
	history: hasReadHistoryAction(value),
	dependencies: hasGetDependenciesAction(value),
	requestPublish: hasPublishRequestAction(value),
	createContent: hasCreateAction(value),
	paste: hasPasteAction(value),
	edit: hasEditAction(value),
	unlock: hasUnlockAction(value),
	rename: hasRenameAction(value),
	cut: hasCutAction(value),
	upload: hasUploadAction(value),
	duplicate: hasDuplicateAction(value),
	changeContentType: hasChangeTypeAction(value),
	revert: hasRevertAction(value),
	editController: hasEditControllerAction(value),
	editTemplate: hasEditTemplateAction(value),
	createFolder: hasCreateFolderAction(value),
	delete: hasContentDeleteAction(value),
	deleteController: hasDeleteControllerAction(value),
	deleteTemplate: hasDeleteTemplateAction(value),
	publish: hasPublishAction(value),
	schedulePublish: hasSchedulePublishAction(value)
});

/**
 * Given an item lookup table, tries to find the path with and without the "/index.xml" portion of the path.
 * This reconciles path differences when working with pages between folder and index (i.e. /site/website vs /site/website/index.xml),
 * which refer to the same item in most contexts.
 * path {string} The path to look for
 * lookupTable {Record<string, T>} The map-like object containing all items in which to look the path up
 * @returns {T} The item if found, undefined otherwise
 **/
export function lookupItemByPath<T = ContentItem>(path: string, lookupTable: LookupTable<T>): T {
	return lookupTable[withIndex(path)] ?? lookupTable[withoutIndex(path)];
}

export function modelsToLookup(models: ContentInstance[]): LookupTable<ContentInstance> {
	const lookup = {};
	models.forEach((model) => {
		modelsToLookupModelParser(model, lookup);
	});
	return lookup;
}

function modelsToLookupModelParser(model: ContentInstance, lookup: LookupTable<ContentInstance>) {
	if ('craftercms' in model) {
		if (model.craftercms.id === null) {
			// e.g. In editorial, related-articles-widget (some
			// items can use key/value without being "includes")
			// it may simply be a key/value pair. This is an issue
			// of the parseDescriptor function of the @craftercms/content package
			//   <scripts_o item-list="true">
			//     <item>
			//       <key>/scripts/components/related-articles.groovy</key>
			//       <value>related-articles.groovy</value>
			//     </item>
			//   </scripts_o>
			return;
		}
		lookup[model.craftercms.id] = model;
	}
	Object.entries(model).forEach(([prop, value]) => {
		if (prop.endsWith('_o')) {
			const collection: ContentInstance[] = value;
			forEach(collection, (item) => {
				if ('craftercms' in item) {
					if (item.craftercms.id === null) {
						return 'continue';
					}
					// Add model to lookup table
					lookup[item.craftercms.id] = item;
				}
				modelsToLookupModelParser(item, lookup);
			});
		}
	});
}

export function createPathIdMap(models: LookupTable<ContentInstance>): LookupTable<string> {
	const map = {};
	Object.entries(models).forEach(([id, model]) => {
		if (model.craftercms.path) {
			map[model.craftercms.path] = id;
		}
	});
	return map;
}

export function getEditorMode(mimeType: string): 'ftl' | 'groovy' | 'javascript' | 'css' | 'text' {
	switch (mimeType) {
		case 'text/x-freemarker':
			return 'ftl';
		case 'text/x-groovy':
			return 'groovy';
		case 'application/javascript':
			return 'javascript';
		case 'text/css':
			return 'css';
		default:
			return 'text';
	}
}

export function prepareVirtualItemProps(item: ContentItem): ContentItem {
	return {
		...item,
		stateMap: createItemStateMap(item.state),
		availableActionsMap: createItemActionMap(item.availableActions)
	};
}

export function getDateScheduled(item: ContentItem): string {
	return item.live?.dateScheduled ?? item.staging?.dateScheduled ?? null;
}

export function getDatePublished(item: ContentItem): string {
	return item.live?.dateLastPublished ?? item.staging?.dateLastPublished ?? null;
}

export function getComputedPublishingTarget(item: ContentItem): PublishingTargets | null {
	// prettier-ignore
	return item.stateMap.submittedToLive
		? 'live'
		: item.stateMap.submittedToStaging
			? 'staging'
			: null;
}

export function applyFolderNameRules(name: string, options?: { allowBraces: boolean }): string {
	return (
		// Replace accented vowels with their non-accented counterpart
		replaceAccentedVowels(name)
			// replace spaces with dashes
			.replace(/\s+/g, '-')
			// replace multiple consecutive dashes with a single dash
			.replace(/-+/g, '-')
			// remove any character that is not a letter, number, dash or underscore, and allow braces if specified
			.replace(options?.allowBraces ? /[^a-zA-Z0-9-_{}]/g : /[^a-zA-Z0-9-_]/g, '')
	);
}

export function applyAssetNameRules(name: string, options?: { allowBraces: boolean }): string {
	return name.replace(options?.allowBraces ? /[^a-zA-Z0-9-_{}.]/g : /[^a-zA-Z0-9-_.]/g, '').replace(/\.{1,}/g, '.');
}

/**
 * Utility to clean up a content name (pages/components/taxonomies). It removes any character that is not a lowercase
 * letter, number, dash or underscore.
 */
export function applyContentNameRules(name: string): string {
	return slugify(name, {
		lower: true,
		// Setting `strict: true` would disallow `_`, which we don't want.
		strict: false,
		// Because of the moment where the library trims, `trim: true` caused undesired replacement of `-`
		// at the beginning or end of the slug.
		trim: false
	}).replace(/[^a-z0-9-_]/g, '');
}

export const openItemEditor = (
	item: ContentItem,
	authoringBase: string,
	siteId: string,
	dispatch: Dispatch<AnyAction>,
	onSaveSuccess?: () => void
) => {
	let type = 'controller';

	if (item.systemType === 'component' || item.systemType === 'page') {
		type = 'form';
	} else if (item.contentTypeId === 'renderingTemplate') {
		type = 'template';
	}

	if (type === 'form') {
		dispatch(
			pickShowContentFormAction({
				path: item.path,
				authoringBase,
				site: siteId,
				onSaveSuccess: () => onSaveSuccess?.()
			})
		);
	} else {
		const dialogId = nanoid();
		dispatch(
			pushDialog({
				id: dialogId,
				component: createComponentId('CodeEditorDialog'),
				props: {
					site: siteId,
					authoringBase,
					path: item.path,
					type,
					mode: getEditorMode(item.mimeType),
					onSuccess: () => onSaveSuccess?.(),
					onClose: () => dispatch(popCodeEditorDialog({ id: dialogId }))
				}
			})
		);
	}
};

export function generateComponentBasePath(contentType: string) {
	return `/site/components/${contentType.replace('/component/', '')}s/`.replace(/\/{1,}$/m, '');
}

export function generateComponentPath(modelId: string, contentType: string) {
	return `${generateComponentBasePath(contentType)}/${modelId}.xml`;
}

/**
 * If the field is inherited, swaps the modelId and parentModelId with
 * the inheritance parent's. */
export function getInheritanceParentIdsForField(
	fieldId: string,
	modelLookup: LookupTable<ContentInstance>,
	modelId: string,
	parentModelId: string,
	modelIdByPath: LookupTable<string>,
	hierarchyMap: ModelHierarchyMap
): { modelId: string; parentModelId: string } {
	const ids = { modelId, parentModelId };
	if (isInheritedField(modelLookup[modelId], fieldId)) {
		ids.modelId = getModelIdFromInheritedField(modelLookup[modelId], fieldId, modelIdByPath);
		ids.parentModelId = findParentModelId(modelId, hierarchyMap, modelLookup);
	}
	return ids;
}

export interface GeneratePlaceholderImageDataUrlArgs {
	width: number;
	height: number;
	fillStyle: string;
	textFillStyle: string;
	text: string;
	textPositionX: number;
	textPositionY: number;
	font: string;
	textAlign: CanvasTextAlign;
	textBaseline: CanvasTextBaseline;
}

export function generatePlaceholderImageDataUrl(attributes?: Partial<GeneratePlaceholderImageDataUrlArgs>): string {
	let attrs: GeneratePlaceholderImageDataUrlArgs = Object.assign(
		{
			width: 300,
			height: 150,
			fillStyle: '#f0f0f0',
			text: 'Sample Image',
			textPositionX: 150,
			textPositionY: 88.24,
			textFillStyle: 'black',
			font: '30px Arial',
			textAlign: 'center',
			textBaseline: 'middle'
		},
		attributes
	);

	const canvas = document.createElement('canvas');
	const context = canvas.getContext('2d');
	canvas.width = attrs.width;
	canvas.height = attrs.height;

	// Set background color
	context.fillStyle = attrs.fillStyle;
	context.fillRect(0, 0, attrs.width, attrs.height);

	// Render text
	context.font = attrs.font;
	context.fillStyle = attrs.textFillStyle;
	context.textAlign = attrs.textAlign;
	context.textBaseline = attrs.textBaseline;
	context.fillText(attrs.text, attrs.textPositionX, attrs.textPositionY);

	return canvas.toDataURL();
}

/**
 * Retrieves the value of a property from a content instance model, considering system properties.
 *
 * @param model - The content instance model to retrieve the value from.
 * @param prop - The property to retrieve the value from.
 * @returns The value of the property from the model.
 * */
export function getContentInstanceValueFromProp(model: ContentInstance, prop: string) {
	const systemProp = systemPropMap[prop];
	if (systemProp) {
		if (systemProp === 'fileName') {
			return getContentInstanceFileName(model);
		} else {
			return model.craftercms[systemProp];
		}
	} else {
		return model[prop];
	}
}

export function getContentInstanceXmlValueFromProp(xml: string, prop: string): string {
	const selectionProp = XmlKeys[prop] ?? prop;
	const doc = fromString(xml).querySelector(selectionProp);
	return doc ? serialize(doc) : '';
}

export function getContentFileNameFromPath(path: string): string {
	let fileName = path.replace('/site/website', '');

	if (path.endsWith('/index.xml')) {
		fileName = fileName.replace('/index.xml', '');
		return fileName.substring(fileName.lastIndexOf('/')) || '/';
	}

	if (path.includes('.xml')) {
		return fileName.substring(fileName.lastIndexOf('/') + 1).replace('.xml', '');
	}
	return fileName;
}

/**
 * Retrieves the file name from the given content instance model.
 *
 * @param model - The content instance model containing the path.
 * @returns The file name extracted from the model's path, or null if the path is not defined.
 */
export function getContentInstanceFileName(model: ContentInstance) {
	const path = model.craftercms.path;
	if (!path) return null;

	return getContentFileNameFromPath(path);
}

export const getMockContentInstance = () => {
	return {
		craftercms: {
			id: null,
			path: null,
			label: null,
			dateCreated: null,
			dateModified: null,
			contentTypeId: null,
			disabled: false
		}
	};
};

export const isComparableAsset = (item) => {
	return (
		item?.systemType === 'asset' &&
		(isEditableAsset(item.path) || isImage(item.path) || isVideo(item) || isPdfDocument(item.mimeType))
	);
};

// region Package presence checker functions
export const hasApproveAction = (value: number) => Boolean(value & PACKAGE_APPROVE_MASK);
export const hasRejectAction = (value: number) => Boolean(value & PACKAGE_REJECT_MASK);
export const hasCancelAction = (value: number) => Boolean(value & PACKAGE_CANCEL_MASK);
export const hasResubmitAction = (value: number) => Boolean(value & PACKAGE_RESUBMIT_MASK);

export function isVideo(item: Pick<ContentItem, 'mimeType'>): boolean {
	return item?.mimeType.startsWith('video/');
}

export function isAudio(item: Pick<ContentItem, 'mimeType'>): boolean {
	return item?.mimeType.startsWith('audio/');
}

export function isPdfDocument(mimeType: string): boolean {
	// Using `startsWith` to cover possible mime types like `application/pdf; charset=UTF-8`
	return mimeType.toLowerCase().startsWith('application/pdf');
}

/** Validates if an HTMLImageElement meets the given size restrictions. The restrictions may be a range (min/max) or an
 * exact value (width/height). If no restrictions are provided, the image is considered valid.
 *
 * @param file - The HTMLImageElement to validate.
 * @param restrictions - Optional image size restrictions (width, height, minWidth, minHeight, maxWidth, maxHeight).
 * @returns True if the image meets the restrictions or if no restrictions are provided, false otherwise.
 */
function doesImageMeetSizeRestrictions(file: HTMLImageElement, restrictions?: ImageRestrictions): boolean {
	let meetRestrictions = true;
	if (restrictions) {
		const { width, height, minWidth, minHeight, maxWidth, maxHeight } = restrictions;
		if (
			(width && file.width !== width) ||
			(height && file.height !== height) ||
			(minWidth && file.width < minWidth) ||
			(minHeight && file.height < minHeight) ||
			(maxWidth && file.width > maxWidth) ||
			(maxHeight && file.height > maxHeight)
		) {
			meetRestrictions = false;
		}
	}
	return meetRestrictions;
}

/** Loads an image from the given path and validates it against the provided size restrictions.
 *
 * @param path - The image path or URL to load.
 * @param restrictions - Optional size restrictions to validate the image against.
 * @returns Promise that resolves to true if the image meets the restrictions or no restrictions are provided, false otherwise.
 * */
export function validateImageRestrictions(path: string, restrictions?: ImageRestrictions): Promise<boolean> {
	if (!restrictions || (!isImage(path) && !isBlobUrl(path) && !path.startsWith('data:image/'))) {
		return Promise.resolve(true);
	}
	return new Promise((resolve) => {
		const img = new window.Image();
		const done = (result: boolean) => resolve(result);
		const timeout = window.setTimeout(() => done(true), 5000);
		img.onload = () => {
			window.clearTimeout(timeout);
			done(doesImageMeetSizeRestrictions(img, restrictions));
		};
		img.onerror = img.onabort = () => {
			window.clearTimeout(timeout);
			done(true);
		};
		img.src = path;
	});
}
