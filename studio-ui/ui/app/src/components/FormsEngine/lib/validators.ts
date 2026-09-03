/*
 * Copyright (C) 2007-2025 Crafter Software Corporation. All Rights Reserved.
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

import ContentType, { type ContentTypeField } from '../../../models/ContentType';
import type { BuiltInControlType } from './controlMap';
import LookupTable from '../../../models/LookupTable';
import { XmlKeys } from './formConsts';
import { defineMessage, type MessageDescriptor } from 'react-intl';
import type { FormatXMLElementFn, PrimitiveType } from 'intl-messageformat';
import { nnou, nou } from '../../../utils/object';
import { checkPathExistence } from '../../../services/content';
import { computePathFromFileName, getBasePath, getPropertyValue } from './formUtils';
import { firstValueFrom } from 'rxjs';
import { isPagePath, withIndex } from '../../../utils/path';
import { FormsEngineItemMetaContextProps } from './formsEngineContext';
import { validateDatePopulateExpression } from './controlHelpers';
import type { DescriptorControlType } from '../../ContentTypeManagement/controlMap';
import type { RepeatItem } from '../controls/Repeat';
import { getValidationValue } from './formUtils';
import type { NodeSelectorItem } from '../controls/NodeSelector';
import type { CheckboxGroupProps } from '../controls/CheckboxGroup';
import { macroCreatorLookupTable } from '../../ContentTypeManagement/controls/PathWithMacroCreator';

interface ValidatorMetaData {
	siteId: string;
	fileName: string;
	itemMeta: FormsEngineItemMetaContextProps;
	contentTypesById?: LookupTable<ContentType>;
}
type ValidatorFunctionDef = (
	field: ContentTypeField,
	currentValue: unknown,
	messages: FieldValidityState['messages'],
	meta: ValidatorMetaData
) => Promise<boolean> | boolean;
export const validatorsMap: Partial<Record<BuiltInControlType | DescriptorControlType, ValidatorFunctionDef>> = {
	repeat: (field, currentValue, messages, meta) =>
		repeatGroupValidator(field, currentValue as Array<RepeatItem>, messages, meta),
	'auto-filename': undefined,
	'aws-file-upload': undefined,
	'checkbox-group': (field, currentValue, messages) =>
		checkboxGroupValidator(field, currentValue as CheckboxGroupProps['value'], messages),
	checkbox: (field, currentValue, messages) => checkboxValidator(field, currentValue as boolean, messages),
	'date-time': (field, currentValue, messages) => dateTimeValidator(field, currentValue as string, messages),
	disabled: undefined,
	dropdown: undefined,
	'file-name': (field, currentValue, messages, meta) =>
		fileNameValidator(field, currentValue as string, messages, meta),
	forcehttps: undefined,
	'image-picker': undefined,
	input: (field, currentValue, messages) => inputValidator(field, currentValue as string, messages),
	'internal-name': undefined,
	label: undefined,
	'locale-selector': undefined,
	'node-selector': (field, currentValue, messages, meta) =>
		nodeSelectorValidator(field, currentValue as NodeSelectorItem[], messages, meta),
	'numeric-input': (field, currentValue, messages) => numericInputValidator(field, currentValue as number, messages),
	'page-nav-order': undefined,
	rte: (field, currentValue, messages) => rteValidator(field, currentValue as string, messages),
	textarea: (field, currentValue, messages) => inputValidator(field, currentValue as string, messages),
	time: undefined,
	'transcoded-video-picker': undefined,
	uuid: undefined,
	'video-picker': undefined,
	colorPicker: undefined,
	'date-time-expression-input': (field, currentValue, messages) =>
		dateTimeExpressionInputValidator(field, currentValue as string, messages),
	'input-email': (field, currentValue, messages) => inputEmailValidator(field, currentValue as string, messages),
	'input-link': (field, currentValue, messages) => inputLinkValidator(field, currentValue as string, messages),
	'input-phone': (field, currentValue, messages) => inputPhoneValidator(field, currentValue as string, messages),
	'path-with-macro-creator': (field, currentValue, messages) =>
		pathWithMacroValidator(field, currentValue as string, messages)
};

// TODO: Fix FormatXMLElementFn generics
export type FieldValidityMessage =
	| string
	| MessageDescriptor
	| [MessageDescriptor, values?: Record<string, PrimitiveType | FormatXMLElementFn<any, any>>];

export interface FieldValidityState {
	isValid: boolean;
	messages: FieldValidityMessage[];
}

/**
 * Validates the uniqueness of a file name within a specific site and path.
 *
 * @param {ContentTypeField} field - The field metadata for the file name being validated.
 * @param {string} _ - Unused parameter, representing the current value of the field.
 * @param {FieldValidityState['messages']} messages - An array to store validation messages.
 * @param {ValidatorMetaData} meta - Metadata containing site ID, file name, and item context.
 * @returns {Promise<boolean> | boolean} - A promise resolving to `true` if the file name is valid,
 * or `false` if it is invalid.
 *
 */
export async function fileNameValidator(
	field: ContentTypeField,
	_: string,
	messages: FieldValidityState['messages'],
	meta: ValidatorMetaData
): Promise<boolean> {
	const siteId: string = meta.siteId;
	const currentValue = meta.fileName;

	if (nou(currentValue)) return false;

	const initialPath = meta.itemMeta.path ?? meta.itemMeta.pathInSite;
	const isPage = isPagePath(withIndex(initialPath));
	const basePath = nnou(meta.itemMeta.path) ? getBasePath(initialPath, isPage) : meta.itemMeta.pathInSite;
	const newPath = computePathFromFileName(currentValue, isPage, basePath);

	if (initialPath === newPath || nou(siteId)) return true;

	try {
		const exists = await firstValueFrom(checkPathExistence(siteId, newPath));
		if (exists) {
			messages?.push([defineMessage({ defaultMessage: 'An item with that name already exists.' })]);
		}
		return !exists;
	} catch {
		return false;
	}
}

/**
 * Validates the value of a field based on its type, requirements, and metadata.
 *
 * @param {ContentTypeField} field - The field metadata, including its type and validation rules.
 * @param {unknown} currentValue - The current value of the field to be validated.
 * @param {ValidatorMetaData} meta - Metadata containing additional context such as site ID and file name.
 * @returns {Promise<FieldValidityState>} - A promise resolving to the validity state of the field,
 * including whether it is valid and any associated validation messages.
 *
 */
export async function validateFieldValue(
	field: ContentTypeField,
	currentValue: unknown,
	meta: ValidatorMetaData
): Promise<FieldValidityState> {
	const validateValue = field.id === 'file-name' ? meta.fileName : currentValue;
	const messages: FieldValidityState['messages'] = [];
	const isRequired = isFieldRequired(field);
	const isEmpty = isEmptyValue(field, validateValue);

	// If it's required, and the value is empty, then it's invalid. For file-name, if path is root it's ok to be empty.
	if ((isRequired || (field.id === 'file-name' && meta.itemMeta.path !== '/site/website/index.xml')) && isEmpty) {
		messages.push(defineMessage({ defaultMessage: 'This field is required.' }));
		return Promise.resolve({ isValid: false, messages });
	}
	const validator = validatorsMap[field.type as BuiltInControlType | DescriptorControlType];
	// If there's a validator, run it. If not, it's valid.
	const isValid = nnou(validator) ? await validator(field, validateValue, messages, meta) : true;
	return Promise.resolve({ isValid, messages });
}

/**
 * Checks if the given value for a field is considered empty.
 *
 * @param {ContentTypeField} field - The metadata of the field being validated.
 * @param {unknown} currentValue - The current value of the field to check.
 * @returns {boolean} - Returns `true` if the value is null, undefined, an empty string,
 * or an empty array; otherwise, returns `false`.
 *
 */
export function isEmptyValue(field: ContentTypeField, currentValue: unknown): boolean {
	return (
		currentValue == null ||
		(typeof currentValue === 'string' && currentValue.trim() === '') ||
		(Array.isArray(currentValue) && currentValue.length === 0)
	);
}

/**
 * Determines if a field is required based on its validation metadata.
 *
 * @param {ContentTypeField} field - The metadata of the field, including validation rules.
 * @returns {boolean} - Returns `true` if the field is marked as required; otherwise, `false`.
 *
 */
export function isFieldRequired(field: ContentTypeField): boolean {
	return Boolean(field.validations?.required?.value);
}

/**
 * Checks if the minimum save requirements are fulfilled.
 *
 * @param {Promise<FieldValidityState>} fileNameValidation - A promise resolving to the validity state of the file name.
 * @param {LookupTable<unknown>} values - A lookup table containing field values, including the internal name.
 * @returns {Promise<boolean>} - A promise resolving to `true` if the file name is valid and the internal name requirements are fulfilled; otherwise, `false`.
 *
 */
export async function checkMinimumSaveRequirementsFulfilled(
	fileNameValidation: Promise<FieldValidityState>,
	values: LookupTable<unknown>
): Promise<boolean> {
	const { isValid: isFileNameValid } = await fileNameValidation;
	return isFileNameValid && isInternalNameValid(values);
}

/**
 * Checks if the internal name is valid.
 *
 * @param {LookupTable<unknown>} values - A lookup table containing field values, including the internal name.
 * @returns {boolean} - Returns `true` if the internal name is not empty or consists only of whitespace; otherwise, `false`.
 *
 */
export function isInternalNameValid(values: LookupTable<unknown>): boolean {
	return (values[XmlKeys.internalName]?.toString() ?? '').trim() !== '';
}

export function dateTimeValidator(
	field: ContentTypeField,
	currentValue: string,
	messages: FieldValidityMessage[]
): boolean {
	let isValid = true;
	const allowPastDate: boolean = getPropertyValue(field.properties, 'allowPastDate') as boolean;
	const fieldDate = new Date(currentValue as string);
	const currentDate = new Date();
	if (!allowPastDate && !isNaN(fieldDate.valueOf()) && fieldDate < currentDate) {
		messages.push(defineMessage({ defaultMessage: 'The date cannot be in the past.' }));
		isValid = false;
	}
	return isValid;
}

export function dateTimeExpressionInputValidator(field, currentValue: string, messages) {
	const isValid = validateDatePopulateExpression(currentValue);
	if (!isValid) {
		messages.push(defineMessage({ defaultMessage: 'The expression is not valid.' }));
	}
	return isValid;
}

export async function repeatGroupValidator(
	field: ContentTypeField,
	currentValue: Array<RepeatItem>,
	messages: FieldValidityState['messages'],
	meta: ValidatorMetaData
): Promise<boolean> {
	let isValid = true;
	const minOccurs: number = getValidationValue(field.validations, 'minOccurs') as number;
	const maxOccurs: number = getValidationValue(field.validations, 'maxOccurs') as number;

	// Validate repeat group restrictions (min/max occurrences)
	if (nnou(minOccurs) && currentValue.length < minOccurs) {
		messages?.push([
			defineMessage({ defaultMessage: 'At least {minOccurs} occurrence(s) are required.' }),
			{ minOccurs }
		]);
		isValid = false;
	}
	if (nnou(maxOccurs) && currentValue.length > maxOccurs) {
		messages?.push([
			defineMessage({ defaultMessage: 'No more than {maxOccurs} occurrence(s) are allowed.' }),
			{ maxOccurs }
		]);
		isValid = false;
	}

	// If there are no items, return validation result (items validation is not needed if there are no items)
	if (currentValue.length === 0) return isValid;

	const fields = field.fields;
	if (!fields) return isValid;

	const validationPromises: Promise<FieldValidityState>[] = [];

	// Validate fields of each repeat group item
	currentValue?.forEach((item) => {
		Object.values(fields).forEach((subField) => {
			const id = subField.id;
			const value = item[id];
			const validationPromise = validateFieldValue(subField, value, meta);
			validationPromises.push(validationPromise);
		});
	});

	const results = await Promise.all(validationPromises);
	results.forEach((result) => {
		if (!result.isValid) {
			isValid = false;
		}
	});
	return isValid;
}

/**
 * Validates the input value of a field based on its pattern and maximum length.
 *
 * @param {ContentTypeField} field - The metadata of the field being validated, including its validation rules.
 * @param {string} currentValue - The current value of the field to validate.
 * @param {FieldValidityMessage[]} [messages] - An optional array to store validation messages if the value is invalid.
 * @returns {boolean} - Returns `true` if the input value is valid; otherwise, `false`.
 * @param customValidationMessages - An optional lookup table of custom validation messages for specific validation rules.
 *
 */
export function inputValidator(
	field: ContentTypeField,
	currentValue: string,
	messages?: FieldValidityMessage[],
	customValidationMessages?: LookupTable<MessageDescriptor>
): boolean {
	let isValid = true;
	// Skip validation if value is empty and field is not required
	if (currentValue == null || (typeof currentValue === 'string' && currentValue.trim() === '')) {
		return isValid;
	}
	const pattern = field.validations.pattern?.value as string;
	const maxLength: number | undefined = getValidationValue(field.validations, 'maxlength');
	// If there's a pattern and it doesn't match, it's invalid.
	if (pattern && !String(currentValue).match(pattern)) {
		messages?.push([
			customValidationMessages?.['pattern'] ??
				defineMessage({ defaultMessage: 'The value does not match the required pattern.' })
		]);
		isValid = false;
	}

	if (nnou(maxLength) && currentValue.length > maxLength) {
		messages?.push([
			defineMessage({ defaultMessage: `The value is greater than the allowed maximum ({maxLength}).` }),
			{ maxLength }
		]);
		isValid = false;
	}
	return isValid;
}

/**
 * Validates a numeric input value based on its pattern, maximum value, and minimum value.
 *
 * @param {ContentTypeField} field - The metadata of the field being validated, including its validation rules.
 * @param {number} currentValue - The current numeric value of the field to validate.
 * @param {FieldValidityMessage[]} messages - An array to store validation messages if the value is invalid.
 * @returns {boolean} - Returns `true` if the numeric value is valid; otherwise, `false`.
 *
 */
export function numericInputValidator(
	field: ContentTypeField,
	currentValue: number,
	messages: FieldValidityMessage[]
): boolean {
	let isValid = true;
	const pattern: string = getValidationValue(field.validations, 'pattern');
	const maxValue: number = getValidationValue(field.validations, 'maxValue');
	const minValue: number = getValidationValue(field.validations, 'minValue');
	const lastUnderscore = field.id.lastIndexOf('_');
	const numType = lastUnderscore !== -1 ? field.id.substring(lastUnderscore) : '_i';

	if (nou(currentValue)) {
		return isValid;
	}
	if (Number.isNaN(Number(currentValue))) {
		messages.push([defineMessage({ defaultMessage: 'Please enter a valid number.' })]);
		return false;
	}

	let numTypeRegex;
	if (numType === '_f' || numType === '_d') {
		// with decimals
		numTypeRegex = /^[+-]?\d+(\.\d+)?$/;
		if (!String(currentValue).match(numTypeRegex)) {
			isValid = false;
			messages.push([defineMessage({ defaultMessage: 'Please enter a valid decimal number.' })]);
		}
	} else {
		numTypeRegex = /^([+-]?[1-9]\d*|0)$/;
		if (!String(currentValue).match(numTypeRegex)) {
			isValid = false;
			messages.push([defineMessage({ defaultMessage: "Decimals aren't allowed on this input." })]);
		}
	}

	// If there's a pattern and it doesn't match
	if (pattern && !String(currentValue).match(pattern)) {
		messages.push([defineMessage({ defaultMessage: 'The value does not match the required pattern.' })]);
		isValid = false;
	}
	// If there's a max and the value is greater than the max
	if (maxValue != null && Number(currentValue) > Number(maxValue)) {
		messages.push([
			defineMessage({ defaultMessage: `The value is greater than the allowed maximum ({maxValue}).` }),
			{ maxValue }
		]);
		isValid = false;
	}
	// If there's a min and the value is less than the min
	if (minValue != null && Number(currentValue) < Number(minValue)) {
		messages.push([
			defineMessage({ defaultMessage: 'The value is less than the minimum ({minValue}).' }),
			{ minValue }
		]);
		isValid = false;
	}
	return isValid;
}

export async function nodeSelectorValidator(
	field: ContentTypeField,
	currentValue: Array<NodeSelectorItem>,
	messages: FieldValidityState['messages'],
	meta: ValidatorMetaData
): Promise<boolean> {
	let isValid = true;
	if (!Array.isArray(currentValue)) return isValid;
	// This set is used to keep track of visited content items during validation to prevent infinite loops in case of circular references.
	const visited = new Set<string>();
	const minSize: number = getPropertyValue(field.properties, 'minSize') as number;
	const maxSize: number = getPropertyValue(field.properties, 'maxSize') as number;
	const embeddedContent = currentValue.filter((item) => nnou(item.component));

	// Validate node selector restrictions (min/max occurrences)
	if (nnou(minSize) && currentValue.length < minSize) {
		messages?.push([defineMessage({ defaultMessage: 'At least {minSize} item(s) are required.' }), { minSize }]);
		isValid = false;
	}
	if (nnou(maxSize) && currentValue.length > maxSize) {
		messages?.push([defineMessage({ defaultMessage: 'No more than {maxSize} item(s) are allowed.' }), { maxSize }]);
		isValid = false;
	}

	// If there are no embedded items, return validation result (items validation is not needed if there are no items)
	if (embeddedContent.length === 0) return isValid;
	if (!meta.contentTypesById) return isValid;

	const validationPromises: Promise<FieldValidityState>[] = [];

	// Validate fields of each embedded item
	embeddedContent.forEach(({ component }) => {
		const contentTypeId = component['content-type'] as string;
		const objectId = component['objectId'] as string;
		if (visited.has(objectId)) return; // prevent circular validation
		visited.add(objectId);
		const contentType = meta.contentTypesById[contentTypeId];
		if (!contentType) return;
		const fields = contentType.fields;
		if (!fields) return;
		Object.values(fields).forEach((embeddedField) => {
			const value = component[embeddedField.id];
			const validationPromise = validateFieldValue(embeddedField, value, meta);
			validationPromises.push(validationPromise);
		});
	});

	const results = await Promise.all(validationPromises);
	let invalidEmbedded = false;
	results.forEach((result) => {
		if (!result.isValid) {
			invalidEmbedded = true;
			isValid = false;
		}
	});
	if (invalidEmbedded) {
		messages.push(defineMessage({ defaultMessage: 'One or more embedded content items are invalid.' }));
	}
	return isValid;
}

export function checkboxGroupValidator(
	field: ContentTypeField,
	currentValue: CheckboxGroupProps['value'],
	messages: FieldValidityMessage[]
) {
	const minSelected = Number(field.validations?.minSize?.value ?? 0);
	const selectedCount = Array.isArray(currentValue) ? currentValue.length : 0;
	const isValid = selectedCount >= minSelected;
	if (!isValid)
		messages.push([
			defineMessage({ defaultMessage: 'Please select at least the minimum required items ({minSelected}).' }),
			{ minSelected }
		]);
	return isValid;
}

export function checkboxValidator(field: ContentTypeField, currentValue: boolean, messages: FieldValidityMessage[]) {
	const isRequired = isFieldRequired(field);
	let isValid = true;
	// For checkboxes, being required means it must be checked (true)
	if (isRequired && !currentValue) {
		isValid = false;
		messages.push(defineMessage({ defaultMessage: 'This checkbox must be checked.' }));
	}
	return isValid;
}

/**
 * Validates an email input field using a predefined email pattern message.
 *
 * @param {ContentTypeField} field - The metadata of the field being validated.
 * @param {string} currentValue - The current value of the field to validate.
 * @param {FieldValidityMessage[]} [messages] - Optional array to store validation messages if the value is invalid.
 * @returns {boolean} - Returns true if the input value is a valid email address or empty (when not required), otherwise false.
 */
const inputEmailValidator = (
	field: ContentTypeField,
	currentValue: string,
	messages?: FieldValidityMessage[]
): boolean => {
	return inputValidator(field, currentValue, messages, {
		pattern: defineMessage({ defaultMessage: 'Please enter a valid email address.' })
	});
};

/**
 * Validates a link (URL) input field using a predefined URL pattern message.
 *
 * @param {ContentTypeField} field - The metadata of the field being validated.
 * @param {string} currentValue - The current value of the field to validate.
 * @param {FieldValidityMessage[]} [messages] - Optional array to store validation messages if the value is invalid.
 * @returns {boolean} - Returns true if the input value is a valid URL or empty (when not required), otherwise false.
 */
const inputLinkValidator = (
	field: ContentTypeField,
	currentValue: string,
	messages?: FieldValidityMessage[]
): boolean => {
	return inputValidator(field, currentValue, messages, {
		pattern: defineMessage({ defaultMessage: 'Please enter a valid URL.' })
	});
};

/**
 * Validates a phone number input field using a predefined phone number pattern message.
 *
 * @param {ContentTypeField} field - The metadata of the field being validated.
 * @param {string} currentValue - The current value of the field to validate.
 * @param {FieldValidityMessage[]} [messages] - Optional array to store validation messages if the value is invalid.
 * @returns {boolean} - Returns true if the input value is a valid phone number or empty (when not required), otherwise false.
 */
const inputPhoneValidator = (
	field: ContentTypeField,
	currentValue: string,
	messages?: FieldValidityMessage[]
): boolean => {
	return inputValidator(field, currentValue, messages, {
		pattern: defineMessage({ defaultMessage: 'Please enter a valid phone number.' })
	});
};

const rteValidator = (field: ContentTypeField, currentValue: string, messages?: FieldValidityMessage[]): boolean => {
	if (nou(field)) return true;
	const isRequired = isFieldRequired(field);
	let isValid = true;
	const safeValue = typeof currentValue === 'string' ? currentValue : '';

	const maxLength: number | undefined = getValidationValue(field.validations, 'maxLength');
	const aux = document.createElement('div');
	aux.innerHTML = safeValue;
	const trimmedContent = aux.innerText.trim(); // Get only the text and remove white space

	if (isRequired) {
		isValid = trimmedContent !== '';
		if (!isValid) {
			messages?.push(defineMessage({ defaultMessage: 'This field is required.' }));
		}
	}
	if (nnou(maxLength) && trimmedContent.length > maxLength) {
		messages?.push([
			defineMessage({
				defaultMessage: `The value is greater than the allowed maximum ({maxLength}).`
			}),
			{ maxLength }
		]);
		isValid = false;
	}

	return isValid;
};

const pathWithMacroValidator = (
	field: ContentTypeField,
	currentValue: string,
	messages: FieldValidityMessage[]
): boolean => {
	if (currentValue.trim() === '') {
		return true;
	}
	const validMacros = Object.values(macroCreatorLookupTable).map(({ macro }) => macro);
	// Find all macros in the currentValue (e.g., {macroName})
	const macroRegex = /(\{[a-zA-Z0-9_]+\})/g;
	const foundMacros = Array.from(currentValue.matchAll(macroRegex)).map((match) => match[1]);

	// Find macros not in the whitelist
	const invalidMacros = foundMacros.filter((macro) => !validMacros.includes(macro));

	if (invalidMacros.length > 0) {
		messages.push([
			defineMessage({ defaultMessage: 'The following are invalid macros: {invalidMacros}.' }),
			{ invalidMacros: invalidMacros.join(', ') }
		]);
		return false;
	}

	return true;
};

export default validateFieldValue;
