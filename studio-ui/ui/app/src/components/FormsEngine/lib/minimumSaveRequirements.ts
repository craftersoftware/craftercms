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

import type LookupTable from '../../../models/LookupTable';
import { XmlKeys } from './formConsts';

/** A field the save refuses to write without, even as a draft. */
export type MinimumSaveRequirement = 'fileName' | 'internalName';

/**
 * What `save` needs before it writes anything, draft or not. One definition for the save guard
 * and for the button, the tooltip and the alert, so they cannot disagree.
 * A repeat item commits in memory and has no file name or internal name. An embedded form has no
 * file name. That holds for a stacked embedded form too: the save checks embedded before it hands the
 * values back to the parent. A full form needs both.
 */
export function missingMinimumSaveRequirements(args: {
	isRepeatMode: boolean;
	isEmbedded: boolean;
	fileNameValid: boolean;
	internalName: unknown;
}): MinimumSaveRequirement[] {
	if (args.isRepeatMode) return [];
	const missing: MinimumSaveRequirement[] = [];
	if (!args.isEmbedded && !args.fileNameValid) missing.push('fileName');
	if (!isInternalNameFilled(args.internalName)) missing.push('internalName');
	return missing;
}

/** Not empty and not only whitespace. */
export function isInternalNameFilled(value: unknown): boolean {
	return (value?.toString() ?? '').trim() !== '';
}

export function sameMinimumSaveRequirements(
	a: readonly MinimumSaveRequirement[],
	b: readonly MinimumSaveRequirement[]
): boolean {
	return a.length === b.length && a.every((requirement, index) => requirement === b[index]);
}

/** Which message names which fields. */
export type MinimumRequirementsCopy = 'both' | 'fileName' | 'internalName';

export function minimumRequirementsCopy(missing: readonly MinimumSaveRequirement[]): MinimumRequirementsCopy | null {
	const fileName = missing.includes('fileName');
	const internalName = missing.includes('internalName');
	if (fileName && internalName) return 'both';
	if (fileName) return 'fileName';
	if (internalName) return 'internalName';
	return null;
}

/** What the alert and the tooltip say, with the content type's own names for the fields. */
export interface MinimumRequirementsNotice {
	copy: MinimumRequirementsCopy;
	fileName: string;
	internalName: string;
}

/** Null when the minimum is met. A field the type does not define is named by its id. */
export function minimumRequirementsNotice(
	missing: readonly MinimumSaveRequirement[],
	fields: LookupTable<{ name?: string }> | null | undefined
): MinimumRequirementsNotice | null {
	const copy = minimumRequirementsCopy(missing);
	if (!copy) return null;
	return {
		copy,
		fileName: fields?.[XmlKeys.fileName]?.name || XmlKeys.fileName,
		internalName: fields?.[XmlKeys.internalName]?.name || XmlKeys.internalName
	};
}

/** The content type's name for a blocking field, for the alert's Show button. */
export function blockingFieldName(notice: MinimumRequirementsNotice, fieldId: string | undefined): string | undefined {
	if (!fieldId) return undefined;
	return fieldId === XmlKeys.fileName ? notice.fileName : notice.internalName;
}

/** The field the alert's Show button opens: the first blocking one in the form's field order. */
export function firstBlockingFieldId(
	missing: readonly MinimumSaveRequirement[],
	fieldOrder: readonly string[]
): string | undefined {
	const ids = missing.map((requirement) => (requirement === 'fileName' ? XmlKeys.fileName : XmlKeys.internalName));
	const ordered = ids
		.map((id) => ({ id, index: fieldOrder.indexOf(id) }))
		.filter(({ index }) => index !== -1)
		.sort((a, b) => a.index - b.index);
	return ordered[0]?.id ?? ids[0];
}

/** `minimumRequirements` explains a refused save. `draft` is today's wording. */
export type ValidationAlertVariant = 'minimumRequirements' | 'draft' | null;

export function validationAlertVariant(args: {
	missing: readonly MinimumSaveRequirement[];
	errorCount: number;
}): ValidationAlertVariant {
	if (args.missing.length) return 'minimumRequirements';
	return args.errorCount > 0 ? 'draft' : null;
}

/**
 * Why the save button is disabled, when it is worth saying. The minimum requirements win:
 * fixing the comment would not make the save possible. `noChanges` covers the idle form only,
 * not an edited form that is waiting on its comment.
 */
export type SaveButtonTip = 'minimumRequirements' | 'noChanges' | null;

export function saveButtonTip(args: {
	/** The minimum save requirements are not met. */
	blocked: boolean;
	disableSave: boolean;
	isSubmitting: boolean;
	hasPendingChanges: boolean;
}): SaveButtonTip {
	if (args.isSubmitting) return null;
	if (args.blocked) return 'minimumRequirements';
	return args.disableSave && !args.hasPendingChanges ? 'noChanges' : null;
}
