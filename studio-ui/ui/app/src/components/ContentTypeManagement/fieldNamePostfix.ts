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

import type { ContentType, ContentTypeField } from '../../models/ContentType';

/**
 * Result of checking a field variable name against site-config postfix rules.
 * - `ignored`: the whole name is listed in ignore-postfix-fields (exact match).
 * - `ok`: no suffixes are required, or the name ends with one of them.
 * - `missing`: suffixes are required and none of them ends the name.
 */
export type FieldNamePostfixCheck = 'ignored' | 'ok' | 'missing';

export interface FieldNamePostfixViolation {
	title: string;
	suffixes: string[];
}

/**
 * Exact ignore-list match, then require one of `suffixes` at the end of `name`.
 *
 * Postfixes (e.g. `_s`, `_dt`) tell search how to type the field; `ignore-postfix-fields` exempts
 * names that skip that rule. TB1 used `includes` on the parsed config: several `<field>`s → array
 * (exact match), one `<field>` → string (accidental substring). It also accepted the postfix
 * anywhere via `indexOf` (`is_sold` passed for `_s`). TB2 always matches exemptions on the whole
 * name (the one-entry substring was a parser artefact) and uses `endsWith` so the typing hint stays
 * at the end. Longer suffixes such as `_dt` are not confused with shorter ones such as `_d`.
 * An empty `suffixes` list is always `ok` (controls with no declared postfixes are not errors).
 */
export function checkFieldNamePostfix(
	name: string,
	ignoreFields: readonly string[],
	suffixes: readonly string[]
): FieldNamePostfixCheck {
	if (ignoreFields.includes(name)) {
		return 'ignored';
	}
	if (!suffixes.length) {
		return 'ok';
	}
	return suffixes.some((suffix) => name.endsWith(suffix)) ? 'ok' : 'missing';
}

/**
 * While typing a variable name, keep the raw input (including hyphens) when some ignore-postfix-fields
 * entry starts with the current value. That lets names like `internal-name` be entered without the
 * usual `-` → `_` cleaning. Exact ignore matching for save/validation is separate ({@link checkFieldNamePostfix}).
 */
export function shouldPreserveVariableInput(input: string, ignoreFields: readonly string[]): boolean {
	if (!input || !ignoreFields.length) {
		return false;
	}
	return ignoreFields.some((field) => field.startsWith(input));
}

/** Formats suffixes for “must end with one of” messages: `_s`, `_s or _t`, `_s, _t or _i`. */
export function formatPostfixList(suffixes: readonly string[]): string {
	if (suffixes.length <= 1) {
		return suffixes[0] ?? '';
	}
	if (suffixes.length === 2) {
		return `${suffixes[0]} or ${suffixes[1]}`;
	}
	return `${suffixes.slice(0, -1).join(', ')} or ${suffixes[suffixes.length - 1]}`;
}

/**
 * Top-level fields only (section members). Nested fields inside repeats are not checked; the repeat itself is.
 * Skips fields without both an id and a title, matching Type Builder 1.
 */
export function collectTopLevelFieldNamePostfixViolations(
	type: Pick<ContentType, 'sections' | 'fields'>,
	ignoreFields: readonly string[],
	getSuffixes: (field: ContentTypeField) => readonly string[] | undefined
): FieldNamePostfixViolation[] {
	const violations: FieldNamePostfixViolation[] = [];
	for (const section of type.sections ?? []) {
		for (const fieldId of section.fields ?? []) {
			const field = type.fields?.[fieldId];
			if (!field?.id || !field.name) continue;
			const suffixes = [...(getSuffixes(field) ?? [])];
			if (checkFieldNamePostfix(field.id, ignoreFields, suffixes) === 'missing') {
				violations.push({ title: field.name, suffixes });
			}
		}
	}
	return violations;
}
