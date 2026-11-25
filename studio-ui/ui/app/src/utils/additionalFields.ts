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

import LookupTable from '../models/LookupTable';
import { ContentTypeField } from '../models/ContentType';

/** Control descriptors that may declare `metadata.additionalFields` (built-ins and ui.xml plugins). */
export type AdditionalFieldsControlLookup = LookupTable<{
	metadata?: { additionalFields?: readonly string[] | null };
}>;

/** Replaces every `{id}` in an additionalFields template with the parent field id. Text without `{id}` is kept verbatim. */
export function processAdditionalFieldMacro(parentFieldId: string, fieldId: string): string {
	return fieldId.replaceAll('{id}', parentFieldId);
}

/** Expands descriptor `metadata.additionalFields` values for one field id. */
export function expandAdditionalFieldTemplates(
	fieldId: string,
	descriptorAdditionalFields: readonly string[] | null | undefined
): string[] {
	if (!descriptorAdditionalFields?.length) return [];
	return descriptorAdditionalFields.map((additionalField) => processAdditionalFieldMacro(fieldId, additionalField));
}

/**
 * Form-definition ids are authoritative. Descriptor additionalFields only backfill ids that were never
 * persisted; an empty descriptor does not clear stored ids, and a persisted id that differs from
 * the descriptor is kept.
 */
export function mergeAdditionalFieldIds(
	fieldId: string,
	persisted: readonly string[] | null | undefined,
	descriptorAdditionalFields: readonly string[] | null | undefined
): string[] {
	const persistedAdditionalFields = persisted ?? [];
	const expandedAdditionalFields = expandAdditionalFieldTemplates(fieldId, descriptorAdditionalFields);
	if (expandedAdditionalFields.length === 0) return [...persistedAdditionalFields];
	const seen = new Set(persistedAdditionalFields);
	const missingAdditionalFields: string[] = [];
	for (const additionalFieldId of expandedAdditionalFields) {
		if (seen.has(additionalFieldId)) continue;
		seen.add(additionalFieldId);
		missingAdditionalFields.push(additionalFieldId);
	}
	if (missingAdditionalFields.length === 0) return [...persistedAdditionalFields];
	return [...persistedAdditionalFields, ...missingAdditionalFields];
}

/**
 * True when `tagName` is a companion of a sibling field (not a content-type field itself).
 * Checks persisted `field.additionalFields`, then expands control-descriptor templates when
 * `controls` is provided. Also accepts legacy `{id}_tz` when a sibling `{id}` exists so date-time
 * stays quiet before UI config loads.
 * Until UI config loads, `controls` is empty, so form definitions saved before this fix (no persisted
 * `additionalFields`) may still log a plugin companion once; re-saving in Type Builder persists the ids.
 */
export function isCompanionFieldTag(
	tagName: string,
	fields: LookupTable<ContentTypeField> | undefined,
	controls?: AdditionalFieldsControlLookup | null
): boolean {
	if (!fields) return false;
	for (const field of Object.values(fields)) {
		if (field.additionalFields?.includes(tagName)) return true;
		const templates = controls?.[field.type]?.metadata?.additionalFields;
		if (templates?.length && expandAdditionalFieldTemplates(field.id, templates).includes(tagName)) {
			return true;
		}
	}
	return tagName.endsWith('_tz') && Boolean(fields[tagName.replace(/_tz$/, '')]);
}
