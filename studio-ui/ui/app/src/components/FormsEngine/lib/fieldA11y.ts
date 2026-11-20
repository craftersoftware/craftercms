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

import { createContext } from 'react';
import type { ContentTypeField } from '../../../models/ContentType';
import { isFieldRequired } from './validators';
import { useStableFormContext } from './formsEngineContext';
import useLoadableAtom from './useLoadableAtom';

/** Form-level polite live region. The default is a no-op so fields can render outside a form shell. */
export const FormValidationAnnouncerContext = createContext<(message: string) => void>(() => {});

/**
 * The id description and error suffixes hang off. A label id is the group name. A control rendered
 * without one uses its own id, which is what `useFieldControlA11y` is given.
 */
export function fieldDescribedById(labelId: string | undefined, controlId: string): string {
	return labelId || controlId;
}

/** Id of the field description that `FormsEngineField` renders for the control with `controlId`. */
export function fieldDescriptionId(controlId: string): string {
	return `${controlId}-description`;
}

/** Id of the element that holds the field's validation messages while the field is invalid. */
export function fieldErrorId(controlId: string): string {
	return `${controlId}-error`;
}

export interface FieldControlA11y {
	'aria-describedby'?: string;
	'aria-invalid'?: true;
	'aria-required'?: true;
}

/**
 * The attributes a field's control carries. The ids match the helper text `FormsEngineField` renders for the
 * same `controlId`. MUI inputs inside the field already get `aria-invalid` and `required` from the FormControl,
 * so those controls only need `aria-describedby`. Others (switch, radio group, the TinyMCE iframe) pick what applies.
 */
export function fieldControlA11y(args: {
	controlId: string;
	hasDescription: boolean;
	invalid: boolean;
	required: boolean;
}): FieldControlA11y {
	const { controlId, hasDescription, invalid, required } = args;
	const describedBy = [hasDescription && fieldDescriptionId(controlId), invalid && fieldErrorId(controlId)]
		.filter(Boolean)
		.join(' ');
	return {
		'aria-describedby': describedBy || undefined,
		'aria-invalid': invalid || undefined,
		'aria-required': required || undefined
	};
}

/** The field's validity, unless the control decides it (`isValid`). Same rule `FormsEngineField` uses. */
export function useFieldIsValid(fieldId: string, isValid?: boolean): boolean {
	const { atoms } = useStableFormContext();
	const validity = useLoadableAtom(atoms.validationByFieldId[fieldId]);
	return isValid ?? (validity.state === 'hasData' ? validity.data.isValid : true);
}

/**
 * Per-field hook for a control to spread onto its input. Pass the same id the control gives
 * `FormsEngineField` as `htmlFor` (or `controlId`), and the same `isValid` if it passes one.
 */
export function useFieldControlA11y(field: ContentTypeField, controlId: string, isValid?: boolean): FieldControlA11y {
	const valid = useFieldIsValid(field.id, isValid);
	return fieldControlA11y({
		controlId,
		hasDescription: Boolean(field.description),
		invalid: !valid,
		required: isFieldRequired(field)
	});
}
