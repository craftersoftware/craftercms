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

import ContentType, { ContentTypeField } from '../../../models/ContentType';
import LookupTable from '../../../models/LookupTable';
import { asArray } from '../../../utils/array';
import { countLimitValue } from '../../../utils/countLimits';
import { isTypeAcceptedAsByField } from '../../../utils/contentType';
import { XmlKeys } from './formConsts';
import { isFieldReadOnly } from './formUtils';
import type { NodeSelectorItem } from '../controls/NodeSelector';

/** Why a type-compatible destination cannot accept the move right now. */
export type NodeSelectorMoveTargetReason = 'maxCount' | 'duplicate' | 'readonly';

export interface NodeSelectorMoveSource {
	/** Model that owns the source field (`objectId` of the root or embedded component). */
	modelId: string;
	fieldId: string;
	index: number;
}

export interface NodeSelectorMoveTarget {
	modelId: string;
	fieldId: string;
	/** Field names from the document root to this field, for the destination dialog. */
	labelPath: string;
	/** Current items in the destination field (for the position picker). */
	items: NodeSelectorItem[];
	currentCount: number;
	maxCount: number | null;
	disabled: boolean;
	reason?: NodeSelectorMoveTargetReason;
}

export interface EnumerateNodeSelectorMoveTargetsArgs {
	/** The item being moved (shared or embedded). */
	item: NodeSelectorItem;
	/** Content type id of the item. Required for shared items; embedded can fall back to `component['content-type']`. */
	itemContentTypeId: string;
	source: NodeSelectorMoveSource;
	/** Root document model id (`objectId`). */
	rootModelId: string;
	/** Root field values for the document being edited. */
	rootValues: LookupTable<unknown>;
	rootContentType: ContentType;
	contentTypesById: LookupTable<ContentType>;
	/** When true, every destination is readonly-disabled. */
	formReadonly?: boolean;
}

/**
 * Content type id stored on an embedded node-selector item, or undefined for shared/asset items.
 */
export function embeddedItemContentTypeId(item: NodeSelectorItem): string | undefined {
	const typeId = item.component?.[XmlKeys.contentTypeId];
	return typeof typeId === 'string' ? typeId : undefined;
}

/**
 * Collects the moved embedded item's model id and every embedded descendant id under it.
 * Shared items have no in-document descendants.
 */
export function collectEmbeddedSelfAndDescendantIds(
	item: NodeSelectorItem,
	contentTypesById: LookupTable<ContentType>
): Set<string> {
	const ids = new Set<string>();
	if (!item.component) return ids;

	const collect = (node: NodeSelectorItem) => {
		if (!node.component) return;
		ids.add(node.key);
		const typeId = embeddedItemContentTypeId(node);
		const type = typeId ? contentTypesById[typeId] : undefined;
		if (!type?.fields) return;
		for (const field of Object.values(type.fields)) {
			if (field.type !== 'node-selector') continue;
			const children = node.component[field.id];
			if (!Array.isArray(children)) continue;
			for (const child of children as unknown as NodeSelectorItem[]) {
				collect(child);
			}
		}
	};

	collect(item);
	return ids;
}

/**
 * Decides whether one node-selector field should appear as a Move to field destination.
 *
 * Returns `null` when the field must not be listed at all: the source field itself, a field owned by
 * the moved item or one of its embedded descendants, or a field that does not accept the item's
 * content type. Returns a target (optionally `disabled` with a {@link NodeSelectorMoveTargetReason})
 * when the field is type-compatible but currently blocked by readonly, duplicates, or maxCount.
 */
function evaluateTarget(args: {
	field: ContentTypeField;
	modelId: string;
	items: NodeSelectorItem[];
	labelPath: string;
	itemKey: string;
	itemContentTypeId: string;
	source: NodeSelectorMoveSource;
	formReadonly: boolean;
	blockedModelIds: Set<string>;
}): NodeSelectorMoveTarget | null {
	const { field, modelId, items, labelPath, itemKey, itemContentTypeId, source, formReadonly, blockedModelIds } = args;

	// Own field: reorder stays on Move up/down, not Move to field.
	if (modelId === source.modelId && field.id === source.fieldId) {
		return null;
	}

	// Cannot move an embedded item into a field owned by itself or a descendant (XB parity).
	if (blockedModelIds.has(modelId)) {
		return null;
	}

	// Type-incompatible fields are omitted (XB getContentTypeDropTargets); situational limits are disabled below.
	if (!isTypeAcceptedAsByField(field, itemContentTypeId)) {
		return null;
	}

	const maxCount = countLimitValue(field.validations?.maxCount?.value);
	const allowDuplicates = Boolean(field.validations?.allowDuplicates?.value);
	const currentCount = items.length;

	let reason: NodeSelectorMoveTargetReason | undefined;
	if (isFieldReadOnly(field, formReadonly)) {
		reason = 'readonly';
	} else if (!allowDuplicates && items.some((entry, index) => entry.key === itemKey)) {
		// Source slot is a different field, so any matching key is a real duplicate.
		reason = 'duplicate';
	} else if (maxCount != null && currentCount >= maxCount) {
		reason = 'maxCount';
	}

	return {
		modelId,
		fieldId: field.id,
		labelPath,
		items,
		currentCount,
		maxCount,
		disabled: reason != null,
		reason
	};
}

/**
 * Lists node-selector fields in the edited document that can receive `item`, mirroring XB move rules:
 * type acceptance without createMode, no self/descendant nesting, duplicates and maxCount as disabled
 * reasons. Ancestor and sibling-embed fields are included when present in the model tree.
 * Shared includes are not walked (their fields are not part of this document).
 */
export function enumerateNodeSelectorMoveTargets(args: EnumerateNodeSelectorMoveTargetsArgs): NodeSelectorMoveTarget[] {
	const {
		item,
		itemContentTypeId,
		source,
		rootModelId,
		rootValues,
		rootContentType,
		contentTypesById,
		formReadonly = false
	} = args;

	/** Model ids that cannot receive the moved item (due to embedded nesting). */
	const blockedModelIds = collectEmbeddedSelfAndDescendantIds(item, contentTypesById);
	const targets: NodeSelectorMoveTarget[] = [];

	/** `inheritedReadonly` is true when an ancestor node-selector field is readonly; it applies to every descendant. */
	const walk = (
		modelId: string,
		contentType: ContentType,
		values: LookupTable<unknown>,
		pathLabels: string[],
		inheritedReadonly: boolean
	) => {
		if (!contentType?.fields) return;
		for (const field of Object.values(contentType.fields)) {
			if (field.type !== 'node-selector') continue;
			const items = asArray(values[field.id] as NodeSelectorItem | NodeSelectorItem[]);
			const labelPath = [...pathLabels, field.name || field.id].join(' / ');
			const target = evaluateTarget({
				field,
				modelId,
				items,
				labelPath,
				itemKey: item.key,
				itemContentTypeId,
				source,
				formReadonly: inheritedReadonly,
				blockedModelIds
			});
			if (target) targets.push(target);

			// Embedded children live under this field, so they inherit its readonly state too.
			const childReadonly = isFieldReadOnly(field, inheritedReadonly);
			for (const child of items) {
				if (!child?.component) continue;
				const childTypeId = embeddedItemContentTypeId(child);
				const childType = childTypeId ? contentTypesById[childTypeId] : undefined;
				if (!childType) continue;
				const childLabel = child.value || child.key;
				walk(child.key, childType, child.component as LookupTable<unknown>, [...pathLabels, childLabel], childReadonly);
			}
		}
	};

	walk(rootModelId, rootContentType, rootValues, [], formReadonly);
	return targets;
}
