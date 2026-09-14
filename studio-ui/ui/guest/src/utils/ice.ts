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

import { LookupTable } from '@craftercms/studio-ui/models/LookupTable';
import { ContentType, ContentTypeField } from '@craftercms/studio-ui/models/ContentType';
import { ContentInstance } from '@craftercms/studio-ui/models/ContentInstance';
import { nullOrUndefined, notNullOrUndefined, nou } from '@craftercms/studio-ui/utils/object';
import * as Model from '@craftercms/studio-ui/utils/model';
import { forEach, mergeArraysAlternatively } from '@craftercms/studio-ui/utils/array';
import { isSimple, isSymmetricCombination, popPiece } from '@craftercms/studio-ui/utils/string';
import { ModelHierarchyDescriptor, ModelHierarchyMap } from '@craftercms/studio-ui/utils/content';
import { pageControllersFieldId, pageControllersLegacyFieldId } from '@craftercms/studio-ui/utils/constants';
import { RecordTypes, ReferentialEntries } from '../models/InContextEditing';

export type ComponentPlacement = Pick<
	ModelHierarchyDescriptor,
	'parentId' | 'parentContainerFieldPath' | 'parentContainerFieldIndex'
>;

export function findComponentContainerFields(
	fields: LookupTable<ContentTypeField> | ContentTypeField[]
): ContentTypeField[] {
	if (!Array.isArray(fields)) {
		fields = Object.values(fields);
	}
	return fields.filter((field) => {
		if (field.type === 'node-selector') {
			return true;
		} else if (field.type === 'repeat') {
			// TODO Should repeats be considered containers?
			return false;
		} else {
			return false;
		}
	});
}

export function getParentModelId(
	modelId: string,
	models: LookupTable<ContentInstance>,
	children: ModelHierarchyMap
): string {
	return nullOrUndefined(Model.prop(models[modelId], 'path')) ? findParentModelId(modelId, children, models) : null;
}

/**
 * Finds every node-selector (or node-selector nested in a repeat) reference to `modelId`.
 * Shared components can appear in multiple fields/parents; `modelHierarchyMap` only keeps one.
 */
export function findComponentPlacements(
	modelId: string,
	models: LookupTable<ContentInstance>,
	contentTypes: LookupTable<ContentType>
): ComponentPlacement[] {
	const placements: ComponentPlacement[] = [];
	const cleanCarryOver = (carryOver: string) => carryOver.replace(/(^\.+)|(\.+$)/g, '').replace(/\.{2,}/g, '.');
	const getFields = (contentTypeId: string) =>
		contentTypes[contentTypeId]?.fields ? Object.values(contentTypes[contentTypeId].fields) : null;

	function process(
		model: ContentInstance,
		source: ContentInstance,
		fields: ContentTypeField[],
		fieldCarryOver = '',
		indexCarryOver = ''
	) {
		fields?.forEach((field) => {
			if (!source[field.id]) return;
			if (field.type === 'node-selector') {
				if (field.id === pageControllersFieldId || field.id === pageControllersLegacyFieldId) return;
				source[field.id]
					.filter((componentId) => typeof componentId === 'string')
					.forEach((componentId, index) => {
						if (componentId === modelId) {
							placements.push({
								parentId: model.craftercms.id,
								parentContainerFieldPath: cleanCarryOver(`${fieldCarryOver}.${field.id}`),
								parentContainerFieldIndex: cleanCarryOver(`${indexCarryOver}.${index}`)
							});
						}
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
		});
	}

	Object.values(models).forEach((model) => {
		process(model, model, getFields(model.craftercms.contentTypeId));
	});
	return placements;
}

function placementFromHierarchyMap(modelId: string, hierarchyMap?: ModelHierarchyMap): ComponentPlacement | null {
	const entry = hierarchyMap?.[modelId];
	if (entry?.parentId) {
		return {
			parentId: entry.parentId,
			parentContainerFieldPath: entry.parentContainerFieldPath,
			parentContainerFieldIndex: entry.parentContainerFieldIndex
		};
	}
	return null;
}

function placementsMatch(a: ComponentPlacement, b: ComponentPlacement): boolean {
	return (
		a.parentId === b.parentId &&
		a.parentContainerFieldPath === b.parentContainerFieldPath &&
		String(a.parentContainerFieldIndex) === String(b.parentContainerFieldIndex)
	);
}

/**
 * Picks the placement that owns the given zone instance.
 * When a component is referenced from multiple fields, uses DOM ancestry
 * (`data-craftercms-*` attrs) to disambiguate; falls back to hierarchy map / first match.
 */
export function resolvePlacementForZone(
	modelId: string,
	contextElement: Element | null | undefined,
	models: LookupTable<ContentInstance>,
	contentTypes: LookupTable<ContentType>,
	hierarchyMap?: ModelHierarchyMap
): ComponentPlacement | null {
	const placements = findComponentPlacements(modelId, models, contentTypes);
	if (placements.length === 0) {
		return placementFromHierarchyMap(modelId, hierarchyMap);
	}
	if (placements.length === 1) {
		return placements[0];
	}

	if (contextElement) {
		let el: Element | null = contextElement;
		while (el) {
			const elModelId = el.getAttribute('data-craftercms-model-id');
			const elFieldId = el.getAttribute('data-craftercms-field-id');
			const elIndex = el.getAttribute('data-craftercms-index');

			if (elModelId && elFieldId != null && elIndex != null) {
				const exact = placements.find(
					(p) =>
						p.parentId === elModelId &&
						p.parentContainerFieldPath === elFieldId &&
						String(p.parentContainerFieldIndex) === String(elIndex)
				);
				if (exact) return exact;
			}

			// Collection field wrapper (no index): narrow by parent + field, then by which item contains the zone.
			if (elModelId && elFieldId != null && elIndex == null) {
				const fieldPlacements = placements.filter(
					(p) => p.parentId === elModelId && p.parentContainerFieldPath === elFieldId
				);
				if (fieldPlacements.length === 1) {
					return fieldPlacements[0];
				}
				if (fieldPlacements.length > 1) {
					for (const placement of fieldPlacements) {
						const itemSelector = `[data-craftercms-model-id="${placement.parentId}"][data-craftercms-field-id="${placement.parentContainerFieldPath}"][data-craftercms-index="${placement.parentContainerFieldIndex}"]`;
						const itemEl = el.querySelector(itemSelector);
						if (itemEl?.contains(contextElement) || itemEl === contextElement) {
							return placement;
						}
					}
					// Items may be the component roots themselves (model-id = component).
					const componentItems = el.querySelectorAll(`[data-craftercms-model-id="${modelId}"]`);
					for (let i = 0; i < componentItems.length; i++) {
						if (componentItems[i] === contextElement || componentItems[i].contains(contextElement)) {
							const byOrder = fieldPlacements[i];
							if (byOrder) return byOrder;
						}
					}
				}
			}

			el = el.parentElement;
		}
	}

	const fromMap = placementFromHierarchyMap(modelId, hierarchyMap);
	if (fromMap) {
		const matched = placements.find((p) => placementsMatch(p, fromMap));
		if (matched) return matched;
	}
	return placements[0];
}

function findParentModelId(
	modelId: string,
	hierarchyDescriptorLookup: ModelHierarchyMap,
	models: LookupTable<ContentInstance>
): string {
	const parentId = forEach(
		Object.entries(hierarchyDescriptorLookup),
		([id, children]) => {
			if (notNullOrUndefined(children) && id !== modelId && children.children.includes(modelId)) {
				return id;
			}
		},
		null
	);
	return notNullOrUndefined(parentId)
		? // If it has a path, it is not embedded and hence the parent
			// Otherwise, need to keep looking.
			notNullOrUndefined(Model.prop(models[parentId], 'path'))
			? parentId
			: findParentModelId(parentId, hierarchyDescriptorLookup, models)
		: // No parent found for this model
			null;
}

export function getCollectionWithoutItemAtIndex(collection: string[], index: string | number): string[] {
	const parsedIndex = parseInt(popPiece(`${index}`), 10);
	return collection.slice(0, parsedIndex).concat(collection.slice(parsedIndex + 1));
}

export function getCollection(model: ContentInstance, fieldId: string, index: string | number): string[] {
	const isStringIndex = typeof index === 'string';
	return isStringIndex ? Model.extractCollection(model, fieldId, index) : Model.value(model, fieldId);
}

export function setCollection(model: ContentInstance, fieldId: string, index: number | string, collection: string[]) {
	if (!isSimple(fieldId)) {
		const concatFieldId = mergeArraysAlternatively(fieldId.split('.'), index.toString().split('.')).join('.');
		const fieldNames = concatFieldId.split('.');
		const { length } = fieldNames;

		const _model = { ...model };

		fieldNames.reduce((acc, _fieldId, i) => {
			if (i === length - 1) {
				acc[_fieldId] = collection;
			}
			return (acc[_fieldId] = Array.isArray(acc[_fieldId]) ? [...acc[_fieldId]] : { ...acc[_fieldId] });
		}, _model);
		return _model;
	} else {
		return { ...model, [fieldId]: collection };
	}
}

export function determineRecordType(
	entities: Pick<ReferentialEntries, 'fieldId' | 'contentType' | 'index' | 'field'>
): RecordTypes {
	let recordType: RecordTypes;
	if (nou(entities.fieldId)) {
		// It's a model
		recordType = entities.contentType.type as RecordTypes;
	} else if (nou(entities.index)) {
		// It's a ${entities.field.type} field
		recordType = 'field';
	} else {
		if (
			isSimple(entities.fieldId) ||
			// By this point, it's been determined that it is a compound field
			isSymmetricCombination(entities.fieldId, entities.index)
		) {
			// It's an item of a ${entities.field.type}
			recordType = entities.field.type === 'node-selector' ? 'node-selector-item' : 'repeat-item';
		} else {
			// It's a ${entities.field.type} field of a repeat group item
			recordType = 'field';
		}
	}
	return recordType;
}
