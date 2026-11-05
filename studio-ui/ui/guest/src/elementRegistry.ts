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

import * as iceRegistry from './iceRegistry';
import { findContainerRecord, getById } from './iceRegistry';
import {
	byPathFetchIfNotLoaded,
	getCachedContentType,
	getCachedModel,
	getCachedModels,
	hasCachedModel,
	isInheritedField,
	model$
} from './contentController';
import { filter, switchMap, take, takeUntil } from 'rxjs/operators';
import * as Model from '@craftercms/studio-ui/utils/model';
import {
	DropZone,
	ElementRecord,
	ElementRecordRegistration,
	HighlightData,
	ICERecord
} from './models/InContextEditing';
import type { ValidationResult } from '@craftercms/studio-ui/models/ContentType';
import { RegistryEntry } from './models/Registry';
import { LookupTable } from '@craftercms/studio-ui/models/LookupTable';
import { notNullOrUndefined, nou, nullOrUndefined } from '@craftercms/studio-ui/utils/object';
import { forEach } from '@craftercms/studio-ui/utils/array';
import { getChildArrangement, sibling } from './utils/dom';
import { isSimple, isSymmetricCombination, popPiece } from '@craftercms/studio-ui/utils/string';
import { Subject } from 'rxjs';

let seq = 0;
// Notifies React overlays when zones are registered or removed so keyboard controls stay current.
const elementRegistryChangesSubject = new Subject<void>();
export const elementRegistryChanges$ = elementRegistryChangesSubject.asObservable();
// Element record registry
let db: LookupTable<ElementRecord> = {};
// Lookup table of element record id arrays, indexed by iceId
let registry: LookupTable<number[]> = {};
// Lookup table of element record id, index by the element
const recordIdByElementLookup = new Map<Element, number>();
// Stream of ids being deregistered, used to cancel pending model fetch operations.
const deregister$ = new Subject<string>();

export function get(id: number): ElementRecord {
	const record = db[id];
	record && nullOrUndefined(record.label) && setLabel(record);
	return record;
}

// TODO: Unknown field names go by ignored. Trace the registration point to warn
//  developers about field names that aren't found in the content type
export function setLabel(record: ElementRecord): void {
	const labels = [];
	const models = getCachedModels();
	record.iceIds.forEach((iceId) => {
		const iceRecord = iceRegistry.getById(iceId);
		const { model, field, fieldId, index, contentType } = iceRegistry.getReferentialEntries(iceRecord);
		if (notNullOrUndefined(field)) {
			switch (field.type) {
				case 'node-selector': {
					if (notNullOrUndefined(index)) {
						if (isSymmetricCombination(fieldId, index)) {
							let aux = Model.extractCollectionItem(model, fieldId, index);
							let component = models[aux];
							if (component) {
								labels.push(
									`${component.craftercms.label} (${getCachedContentType(component.craftercms.contentTypeId).name})`
								);
							} else {
								// Cases where the item selector has files (not a model), we want the label to be similar to that of repeat group field items: the field name and the item position (e.g. "Features item # 1").
								labels.push(
									`${field.name} item # ${parseInt(isSimple(index) ? String(index) : popPiece(String(index))) + 1}`
								);
							}
						} else {
							labels.push(`${field.name}`);
						}
					} else {
						labels.push(`${field.name}`);
					}
					break;
				}
				case 'repeat':
					if (nou(index)) {
						labels.push(`${field.name} (Repeat Group)`);
					} else {
						if (isSymmetricCombination(fieldId, index)) {
							labels.push(
								`${field.name} item # ${parseInt(isSimple(index) ? String(index) : popPiece(String(index))) + 1}`
							);
						} else {
							labels.push(`${field.name} (Repeat Group)`);
						}
					}
					break;
				case 'text':
				case 'textarea':
					labels.push(`${field.name} (Plain Text)`);
					break;
				case 'html':
					labels.push(`${field.name} (Rich Text)`);
					break;
				default:
					labels.push(field.name);
					break;
			}
		} else {
			labels.push(`${model.craftercms.label} (${contentType.name})`);
		}
	});
	record.label = labels.join(', ');
}

export function register(payload: ElementRecordRegistration): number {
	// @ts-ignore
	if (notNullOrUndefined(payload.id)) {
		throw new Error('Record already has id. Was it pre-registered? Please deregister first.');
	}

	const { element, modelId, index, label, fieldId, path } = payload;

	if (recordIdByElementLookup.has(element)) {
		return recordIdByElementLookup.get(element);
	}

	const id = seq++;
	const iceIds = [];
	// prettier-ignore
	const fieldIds =
    fieldId == null
      ? []
      : Array.isArray(fieldId)
        ? fieldId
        : fieldId.split(',').map((str) => str.trim());
	const terminator$ = deregister$.pipe(filter((_id) => _id === String(id)));

	function create(inheritanceParentModelId?: string) {
		// Create/register the physical record
		db[id] = {
			id,
			element,
			modelId: inheritanceParentModelId ?? modelId,
			index,
			label,
			fieldId: fieldIds,
			iceIds,
			complete: false,
			inherited: fieldIds.some((fieldId) => isInheritedField(inheritanceParentModelId ?? modelId, fieldId))
		};
	}

	function completeRegistration(id) {
		const model = getCachedModel(modelId);
		// The field may be inherited (for example, from a level descriptor), so it needs to be checked, and if so, wait
		// for the model to be loaded.
		if (isInheritedField(model.craftercms.id, fieldId)) {
			byPathFetchIfNotLoaded(model.craftercms.sourceMap?.[fieldId])
				.pipe(
					switchMap((response) => model$(response.craftercms.id)),
					takeUntil(terminator$),
					take(1)
				)
				.subscribe((response) => {
					const sourceModelId = response.craftercms.id;
					create(sourceModelId);
					completeDeferredRegistration(id);
				});
		} else {
			create();
			completeDeferredRegistration(id);
		}
	}

	// If the relevant model is loaded, complete its registration, otherwise,
	// request it and complete registration when it does load.
	recordIdByElementLookup.set(element, id);
	if (hasCachedModel(modelId)) {
		completeRegistration(id);
	} else {
		byPathFetchIfNotLoaded(path)
			.pipe(
				switchMap(() => model$(modelId)),
				takeUntil(terminator$),
				take(1)
			)
			.subscribe(() => {
				completeRegistration(id);
			});
	}

	return id;
}

export function completeDeferredRegistration(id: number, inheritanceParentModelId?: string): void {
	const record = db[id];
	const { modelId, index, fieldId: fieldIds, iceIds } = record;

	if (fieldIds.length > 0) {
		fieldIds.forEach((fieldId) => {
			const iceId = iceRegistry.register({ modelId: inheritanceParentModelId ?? modelId, index, fieldId });
			if (!registry[iceId]) {
				registry[iceId] = [];
			}
			registry[iceId].push(record.id);
			!iceIds.includes(iceId) && iceIds.push(iceId);
		});
	} else {
		const iceId = iceRegistry.register({ modelId: inheritanceParentModelId ?? modelId, index });
		if (!registry[iceId]) {
			registry[iceId] = [];
		}
		registry[iceId].push(record.id);
		!iceIds.includes(iceId) && iceIds.push(iceId);
	}

	db[id].complete = true;
	elementRegistryChangesSubject.next();
}

export function getElementRecords(): ElementRecord[] {
	return Object.values(db).filter(
		(record) => record.complete && record.element && record.element.isConnected !== false
	);
}

export function deregister(id: string | number): ElementRecord {
	const record = db[id];
	deregister$.next(String(id));
	if (notNullOrUndefined(record)) {
		const { iceIds, element } = record;
		recordIdByElementLookup.delete(element);
		iceIds.forEach((iceId) => {
			if (registry[iceId].length === 1) {
				delete registry[iceId];
			} else if (registry[iceId].length > 1) {
				registry[iceId].splice(registry[iceId].indexOf(record.id), 1);
			}
			iceRegistry.deregister(iceId);
		});
		delete db[id];
		elementRegistryChangesSubject.next();
	}
	return record;
}

/**
 * Returns the ICE id of the first movable ICE record on the
 * specified element record or false if none is movable.
 * */
export function getDraggable(id: number): number | boolean {
	const record = get(id);
	return forEach(
		record.iceIds,
		function (iceId): boolean | number {
			if (iceRegistry.isMovable(iceId)) {
				return iceId;
			}
		},
		false
	);
}

export function getHoverData(id: number): HighlightData {
	const record = get(id);
	return {
		id,
		rect: record.element.getBoundingClientRect(),
		inherited: record.inherited,
		label: record.label,
		validations: {}
	};
}

export function getRect(id: number): DOMRect {
	return get(id).element.getBoundingClientRect();
}

export function createIntermediateElementRecord(record: ElementRecord, iceId: number): RegistryEntry {
	if (!record) {
		return null;
	}
	const { id, element, label, modelId, index } = record;
	return { id, element, modelId, index, label, fieldId: getById(iceId).fieldId, iceId };
}

export function fromICEId(iceId: number): RegistryEntry {
	const record = db[registry[iceId]?.[0]];
	return createIntermediateElementRecord(record, iceId);
}

export function getRecordsFromIceId(iceId: number): RegistryEntry[] {
	const recordsIds = registry[iceId];
	const records = [];

	if (!recordsIds) {
		return null;
	} else if (recordsIds.length > 1) {
		recordsIds.forEach((recordId) => {
			let record = db[recordId];
			let registry = createIntermediateElementRecord(record, iceId);
			if (registry) {
				records.push(registry);
			}
		});
		return records.length > 0 ? records : null;
	} else {
		let registry = fromICEId(iceId);
		return registry ? [registry] : null;
	}
}

function getDropZoneFromRegistryEntry(elementRecord: RegistryEntry, iceId: number): DropZone {
	const elementRecordId = elementRecord.id;
	const element = elementRecord.element;
	const children: Element[] = Array.from(element.children);
	const childrenRects = children.map((child: Element) => child.getBoundingClientRect());
	const rect = element.getBoundingClientRect();

	return {
		element,
		children,
		iceId,
		elementRecordId,
		rect,
		arrangement: getChildArrangement(children, childrenRects, rect),
		childrenRects,
		validations: {}
	};
}

export function compileDropZone(iceId: number): DropZone {
	const elementRecord = fromICEId(iceId);
	return getDropZoneFromRegistryEntry(elementRecord, iceId);
}

export function compileAllDropZones(iceId: number): DropZone[] {
	const elementRecords = getRecordsFromIceId(iceId);
	return elementRecords.map((elementRecord) => getDropZoneFromRegistryEntry(elementRecord, iceId));
}

export function getSiblingRects(id: number): LookupTable<DOMRect> {
	let //
		record = get(id),
		element = record.element,
		nextSibling,
		prevSibling,
		next,
		prev;

	nextSibling = sibling(element as HTMLElement, true);
	prevSibling = sibling(element as HTMLElement, false);

	forEach(Object.values(db), (record) => {
		if (record.element === nextSibling) {
			next = record.element.getBoundingClientRect();
		} else if (record.element === prevSibling) {
			prev = record.element.getBoundingClientRect();
		} else if (notNullOrUndefined(next) && notNullOrUndefined(prev)) {
			return 'break';
		}
	});

	return { next, prev };
}

export function fromElement(element: Element): ElementRecord {
	const id = recordIdByElementLookup.get(element);
	return db[id];
}

export function hasElement(element: Element): boolean {
	return forEach(
		Object.values(db),
		(record) => {
			if (record.element === element) {
				return true;
			}
		},
		false
	);
}

export function getHighlighted(dropZones: DropZone[]): LookupTable<HighlightData> {
	return dropZones.reduce((object, { elementRecordId: id, validations }) => {
		object[id] = getHoverData(id);
		object[id].validations = validations;
		return object;
	}, {} as LookupTable<HighlightData>);
}

export function getDragContextFromDropTargets(
	dropTargets: ICERecord[],
	validationsLookup?: LookupTable<LookupTable<ValidationResult>>,
	currentRecord?: ElementRecord
): { dropZones: DropZone[]; siblings: Element[]; players: Element[]; containers: Element[] } {
	const response = {
		dropZones: [],
		siblings: [],
		players: [],
		containers: []
	};

	dropTargets.forEach(({ id }) => {
		const dropZones = compileAllDropZones(id);
		const dropZonesFiltered = currentRecord
			? dropZones.filter((dropZone) => dropZone.children.includes(currentRecord.element))
			: null;
		(dropZonesFiltered?.length ? dropZonesFiltered : dropZones).forEach((dropZone) => {
			dropZone.origin = null;
			dropZone.origin = currentRecord ? dropZone.children.includes(currentRecord.element) : null;
			dropZone.validations = validationsLookup?.[id] ?? {};
			response.dropZones.push(dropZone);
			response.siblings = [...response.siblings, ...dropZone.children];
			response.players = [...response.players, ...dropZone.children, dropZone.element];
			response.containers.push(dropZone.element);
		});
	});
	return response;
}

export function getElementFromICEProps(modelId: string, fieldId: string, index: string | number): Element {
	const recordId = iceRegistry.exists({
		modelId: modelId,
		fieldId: fieldId,
		index: index
	});

	if (recordId !== null) {
		const registryEntry = fromICEId(recordId);
		if (registryEntry) {
			return registryEntry.element;
		} else {
			return null;
		}
	} else {
		return null;
	}
}

/**
 * Retrieves the parent node (drop target/zone) of an item
 */
export function getParentElementFromICEProps(modelId: string, fieldId: string, index: string | number): HTMLElement {
	const recordId = findContainerRecord(modelId, fieldId, index)?.id ?? null;
	return recordId === null ? null : (fromICEId(recordId).element as HTMLElement);
}

/**
 * Retrieves all the drop targets elements that host a give ice record
 */
export function getParentsElementFromICEProps(modelId: string, fieldId: string, index: string | number): Element[] {
	const recordId = findContainerRecord(modelId, fieldId, index)?.id ?? null;
	return recordId === null ? null : getRecordsFromIceId(recordId).map((registryEntry) => registryEntry.element);
}

export function flush(): void {
	db = {};
	registry = {};
	recordIdByElementLookup.clear();
	iceRegistry.flush();
}

export function getRegistry(): typeof db {
	return db;
}
