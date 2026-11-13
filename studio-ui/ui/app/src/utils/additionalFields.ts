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

/** Replaces every `{id}` in an additionalFields template with the parent field id. Text without `{id}` is kept verbatim. */
export function processAdditionalFieldMacro(parentFieldId: string, fieldId: string): string {
	return fieldId.replaceAll('{id}', parentFieldId);
}

/** Expands descriptor `metadata.additionalFields` templates for one field id. */
export function expandAdditionalFieldTemplates(
	fieldId: string,
	templates: readonly string[] | null | undefined
): string[] {
	if (!templates?.length) return [];
	return templates.map((template) => processAdditionalFieldMacro(fieldId, template));
}

/**
 * Form-definition ids are authoritative. Descriptor templates only backfill ids that were never
 * persisted; an empty descriptor does not clear stored ids, and a persisted id that differs from
 * the descriptor is kept.
 */
export function mergeAdditionalFieldIds(
	fieldId: string,
	persisted: readonly string[] | null | undefined,
	templates: readonly string[] | null | undefined
): string[] {
	const persistedAdditionalFields = persisted ?? [];
	const expandedAdditionalFields = expandAdditionalFieldTemplates(fieldId, templates);
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
