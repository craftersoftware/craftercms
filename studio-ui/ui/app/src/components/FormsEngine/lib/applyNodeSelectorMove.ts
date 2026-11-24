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

import ContentType from '../../../models/ContentType';
import LookupTable from '../../../models/LookupTable';
import { asArray } from '../../../utils/array';
import type { NodeSelectorItem } from '../controls/NodeSelector';
import type { JotaiStore } from '../types';
import { embeddedItemContentTypeId, type NodeSelectorMoveSource } from './nodeSelectorMoveTargets';
import { extractAtomValues } from './formUtils';
import type { StableFormContextProps } from './formsEngineContext';
import { Primitive } from '../../../models';

export interface ApplyNodeSelectorMoveToValuesArgs {
	rootValues: LookupTable<unknown>;
	rootModelId: string;
	rootContentType: ContentType;
	contentTypesById: LookupTable<ContentType>;
	/** The item being moved (caller already has it). */
	item: NodeSelectorItem;
	source: NodeSelectorMoveSource;
	target: {
		modelId: string;
		fieldId: string;
	};
	/** Splice index into the destination array (`InsertPositionPicker` value). */
	targetIndex: number;
}

export interface ApplyNodeSelectorMoveToValuesResult {
	rootValues: LookupTable<unknown>;
	/** Root-level field ids whose atoms must be written. */
	changedRootFieldIds: string[];
	item: NodeSelectorItem;
	/** Index of the item in the destination field after the move. */
	insertedIndex: number;
	/** Post-move source and target field arrays (for syncing open stacked form atoms). */
	sourceItems: NodeSelectorItem[];
	targetItems: NodeSelectorItem[];
}

export interface ApplyNodeSelectorMoveArgs extends Omit<ApplyNodeSelectorMoveToValuesArgs, 'rootValues'> {
	store: JotaiStore;
	/** Root form (usually `formsStackData[0]`). */
	rootForm: StableFormContextProps;
	/** Used to sync open stacked forms when source/target fields live on them. */
	formsStackData?: StableFormContextProps[];
}

type FieldUpdater = (items: NodeSelectorItem[]) => NodeSelectorItem[];

interface UpdateModelFieldResult {
	values: LookupTable<unknown>;
	/** Root NS field that owns this change in the values map. */
	rootFieldId: string;
}

function nodeSelectorItems(value: unknown): NodeSelectorItem[] {
	return asArray(value as NodeSelectorItem | NodeSelectorItem[]);
}

/**
 * Immutably runs `updater` on `fieldId` of the model identified by `modelId`.
 * Returns null when that model is not present under this values object.
 */
function updateModelFieldInValues(
	values: LookupTable<unknown>,
	contentType: ContentType,
	contentTypesById: LookupTable<ContentType>,
	modelId: string,
	fieldId: string,
	updater: FieldUpdater,
	/** Root NS field that owns this path; set on the first hop, then threaded through recursion. */
	rootFieldId?: string
): UpdateModelFieldResult | null {
	if (!contentType?.fields) return null;

	for (const field of Object.values(contentType.fields)) {
		if (field.type !== 'node-selector') continue;
		const items = nodeSelectorItems(values[field.id]);
		const pathRootFieldId = rootFieldId ?? field.id;

		for (let index = 0; index < items.length; index++) {
			const entry = items[index];
			if (!entry?.component) continue;

			if (entry.key === modelId) {
				const nextItems = items.slice();
				nextItems[index] = {
					...entry,
					component: {
						...entry.component,
						[fieldId]: updater(nodeSelectorItems(entry.component[fieldId])) as unknown as Record<string, Primitive>
					}
				};
				return {
					values: { ...values, [field.id]: nextItems },
					rootFieldId: pathRootFieldId
				};
			}

			const childTypeId = embeddedItemContentTypeId(entry);
			const childType = childTypeId ? contentTypesById[childTypeId] : undefined;
			if (!childType) continue;

			const nested = updateModelFieldInValues(
				entry.component as LookupTable<unknown>,
				childType,
				contentTypesById,
				modelId,
				fieldId,
				updater,
				pathRootFieldId
			);
			if (!nested) continue;

			const nextItems = items.slice();
			nextItems[index] = { ...entry, component: nested.values as unknown as Record<string, Primitive> };
			return {
				values: { ...values, [field.id]: nextItems },
				rootFieldId: nested.rootFieldId
			};
		}
	}

	return null;
}

/** Applies `updater` to a node-selector on `modelId`, starting from the root form. */
function updateModelFieldFromRoot(
	rootValues: LookupTable<unknown>,
	rootModelId: string,
	rootContentType: ContentType,
	contentTypesById: LookupTable<ContentType>,
	modelId: string,
	fieldId: string,
	updater: FieldUpdater
): UpdateModelFieldResult | null {
	if (modelId === rootModelId) {
		if (rootContentType.fields?.[fieldId]?.type !== 'node-selector') return null;
		return {
			values: { ...rootValues, [fieldId]: updater(nodeSelectorItems(rootValues[fieldId])) },
			rootFieldId: fieldId
		};
	}

	// Recursive embed walk: look for `modelId` in the values map, then descend into embedded items.
	return updateModelFieldInValues(rootValues, rootContentType, contentTypesById, modelId, fieldId, updater);
}

/**
 * Pure values move: splices `item` out of `source` and into `target` at `targetIndex`.
 * Source and target must be different fields (Move to field never retargets the origin).
 * Returns null when the source index is out of range or a model/field cannot be resolved.
 */
export function applyNodeSelectorMoveToValues(
	args: ApplyNodeSelectorMoveToValuesArgs
): ApplyNodeSelectorMoveToValuesResult | null {
	const { rootValues, rootModelId, rootContentType, contentTypesById, item, source, target, targetIndex } = args;

	let sourceItems: NodeSelectorItem[] | null = null;
	const removed = updateModelFieldFromRoot(
		rootValues,
		rootModelId,
		rootContentType,
		contentTypesById,
		source.modelId,
		source.fieldId,
		(items) => {
			if (items[source.index]?.key !== item.key) return items;
			const next = items.slice();
			next.splice(source.index, 1);
			sourceItems = next;
			return next;
		}
	);
	if (!removed || !sourceItems) return null;

	let insertedIndex = Math.max(0, targetIndex);
	let targetItems: NodeSelectorItem[] | null = null;
	const inserted = updateModelFieldFromRoot(
		removed.values,
		rootModelId,
		rootContentType,
		contentTypesById,
		target.modelId,
		target.fieldId,
		(items) => {
			const next = items.slice();
			insertedIndex = Math.min(insertedIndex, next.length);
			next.splice(insertedIndex, 0, item);
			targetItems = next;
			return next;
		}
	);
	if (!inserted || !targetItems) return null;

	return {
		rootValues: inserted.values,
		changedRootFieldIds: [...new Set([removed.rootFieldId, inserted.rootFieldId])],
		item,
		insertedIndex,
		sourceItems,
		targetItems
	};
}

/** Value atom for `fieldId` on an open stacked form whose model is `modelId`, if any. */
function stackedFormFieldAtom(formsStackData: StableFormContextProps[], modelId: string, fieldId: string) {
	for (const entry of formsStackData) {
		const entryModelId = entry.itemMeta?.id ?? entry.props?.update?.modelId;
		if (entryModelId == null || String(entryModelId) !== modelId) continue;
		return entry.atoms?.valueByFieldId?.[fieldId];
	}
}

/**
 * Applies a move to the root form atoms. Does not call `content.moveItem`; persistence waits for
 * the normal form save.
 *
 * When a stacked embed form is open, its field atoms can have unsaved items the root embed copy
 * lacks. Those live lists are merged into the values tree before the splice, then written back
 * after. Root-only stacks (`formsStackData.length === 1`) skip that path.
 */
export function applyNodeSelectorMove(args: ApplyNodeSelectorMoveArgs): ApplyNodeSelectorMoveToValuesResult | null {
	const { store, rootForm, formsStackData, ...valueArgs } = args;
	const valueAtoms = rootForm.atoms?.valueByFieldId;
	if (!valueAtoms) return null;

	const sides = [valueArgs.source, valueArgs.target];
	const stack = formsStackData && formsStackData.length > 1 ? formsStackData : null;
	let rootValues = extractAtomValues(store, valueAtoms);

	// Merge live NS lists from open stacked forms into the values tree before splicing.
	if (stack) {
		for (const { modelId, fieldId } of sides) {
			if (modelId === valueArgs.rootModelId) continue;
			const atom = stackedFormFieldAtom(stack, modelId, fieldId);
			if (!atom) continue;
			const patched = updateModelFieldFromRoot(
				rootValues,
				valueArgs.rootModelId,
				valueArgs.rootContentType,
				valueArgs.contentTypesById,
				modelId,
				fieldId,
				() => nodeSelectorItems(store.get(atom))
			);
			if (patched) rootValues = patched.values;
		}
	}

	const applied = applyNodeSelectorMoveToValues({ ...valueArgs, rootValues });
	if (!applied) return null;

	for (const fieldId of applied.changedRootFieldIds) {
		const atom = valueAtoms[fieldId];
		if (atom) store.set(atom, applied.rootValues[fieldId]);
	}

	// Write post-move lists back onto open stacked forms (skip root — already committed above).
	if (stack) {
		for (const [side, items] of [
			[valueArgs.source, applied.sourceItems],
			[valueArgs.target, applied.targetItems]
		] as const) {
			if (side.modelId === valueArgs.rootModelId) continue;
			const atom = stackedFormFieldAtom(stack, side.modelId, side.fieldId);
			if (atom) store.set(atom, items);
		}
	}

	return applied;
}
