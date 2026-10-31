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

import ContentType, { type ContentTypeField } from '../../../models/ContentType';
import type { BuiltInControlType } from './controlMap';
import LookupTable from '../../../models/LookupTable';
import { XmlKeys } from './formConsts';
import { defineMessage, type MessageDescriptor } from 'react-intl';
import type { FormatXMLElementFn, PrimitiveType } from 'intl-messageformat';
import { nnou, nou } from '../../../utils/object';
import { checkPathExistence } from '../../../services/content';
import {
	computePathFromFileName,
	getBasePath,
	getPropertyValue,
	getValidationValue,
	processAdditionalFieldMacro,
	rootPagePath
} from './formUtils';
import { firstValueFrom } from 'rxjs';
import { isPagePath, withIndex } from '../../../utils/path';
import { FormsEngineItemMetaContextProps } from './formsEngineContext';
import { validateDatePopulateExpression } from './controlHelpers';
import type { DescriptorControlType } from '../../ContentTypeManagement/controlMap';
import type { AnyValue } from '../types';
import type { RepeatItem } from '../controls/Repeat';
import type { NodeSelectorItem } from '../controls/NodeSelector';
import type { CheckboxGroupProps } from '../controls/CheckboxGroup';
import { macroCreatorLookupTable } from '../../ContentTypeManagement/controls/PathWithMacroCreator';
import { getPluginControlValidator } from '../controls/registry';
import { isFieldPathIrrelevant } from './formVisibility';
import {
	countLimitValue,
	getRepeatOccurrenceViolations,
	isItemCountMaxEditorValue,
	isItemCountMinEditorValue,
	isItemCountRangeValid,
	readItemCountEditorSpec
} from '../../../utils/countLimits';
import { evaluateRteConstraints, measureRteValue } from './rtePlainText';
import { asArray } from '../../../utils/array';

/**
 * Everything the host knows when it validates a field. Internal: built-in validators read it through
 * {@link BuiltInValidatorContext.meta}. Plugin validators never see it, only {@link ValidatorContext}.
 */
export interface ValidatorMetaData {
	siteId: string;
	fileName: string;
	itemMeta: FormsEngineItemMetaContextProps;
	contentTypesById?: LookupTable<ContentType>;
	/** IDs at the same level as the field/data source being edited (for variable name uniqueness). */
	siblingIds?: string[];
	/** IDs belonging to the field/data source being edited; excluded from duplicate checks. */
	currentIds?: string[];
	/** `additionalFields` templates from the field's descriptor; expands the candidate variable name. */
	additionalFields?: string[];
	/** Qualified field paths the owning form's controller rejected. `null`/absent means no filtering. */
	irrelevantFieldPaths?: Set<string> | null;
	/**
	 * Resolves the deny-list for an embedded component's own content type, using that type's
	 * form controller. Returns `null` when the type has no controller or no relevance hook.
	 * `path` is the containing item's path, the same one the component's form reports when opened.
	 */
	resolveEmbeddedRelevance?(
		contentType: ContentType,
		component: Record<string, unknown>,
		path?: string
	): Promise<Set<string> | null>;
	/**
	 * Current value of a field at the level being validated: the form's top-level fields at the root, the item's
	 * fields inside a repeat item, the component's fields inside an embedded component. See {@link scopeGetValue}.
	 * Item-count editors use it for min ≤ max.
	 */
	getValue?(fieldId: string): unknown;
	/** Aborted when the value being validated is superseded. Created per run when the caller has none. */
	signal?: AbortSignal;
}

/**
 * A message a validator reports for display under the field.
 * Contract for plugin validators. A plain string is shown as is. A `MessageDescriptor` is translated.
 * A tuple is a `MessageDescriptor` plus the values to format it with.
 */
// TODO: Fix FormatXMLElementFn generics
export type FieldValidityMessage =
	| string
	| MessageDescriptor
	| [MessageDescriptor, values?: Record<string, PrimitiveType | FormatXMLElementFn<any, any>>];

/** Internal validity state of a field, as kept in the validation atoms. */
export interface FieldValidityState {
	isValid: boolean;
	messages: FieldValidityMessage[];
}

/** What a validator returns. A validator is valid only when `valid` is `true`. */
export interface ValidatorResult {
	valid: boolean;
	/** Shown under the field when invalid. Messages are listed in the order given. */
	messages?: readonly FieldValidityMessage[];
}

/**
 * Second argument of a plugin {@link Validator}. These members are the whole contract.
 * New members may be added; existing ones are stable.
 */
export interface ValidatorContext {
	readonly field: Readonly<ContentTypeField>;
	/**
	 * Aborted when this validation run is superseded before it settles: any re-run, such as the value changing,
	 * a field read through `getValue` changing, or the form's relevance changing.
	 * Pass it to `fetch` and similar.
	 */
	readonly signal: AbortSignal;
	readonly siteId: string;
	/**
	 * Current value of a field that lives next to the one being validated, by field id.
	 * For a top-level field that is the open form's own fields. For a field inside a repeat item it is that item's
	 * fields. For a field inside an embedded component it is that component's fields. It never reaches the page
	 * from inside a repeat item or an embedded component, so the same data gets the same verdict wherever it is
	 * validated. Returns `undefined` for an id that level does not have.
	 * Reading a field makes this field validate again when that field changes.
	 */
	getValue(fieldId: string): unknown;
}

/**
 * Type-specific validation. Value first, then one context object. May be async.
 * Required/empty checks stay host-owned and run before the validator.
 */
export type Validator<V = unknown> = (value: V, ctx: ValidatorContext) => ValidatorResult | Promise<ValidatorResult>;

/** What built-in validators receive: the public context plus the host's internal metadata. */
interface BuiltInValidatorContext extends ValidatorContext {
	readonly meta: ValidatorMetaData;
}

type BuiltInValidator = (value: AnyValue, ctx: BuiltInValidatorContext) => ValidatorResult | Promise<ValidatorResult>;

const validatorsMap: Partial<Record<BuiltInControlType | DescriptorControlType, BuiltInValidator>> = {
	repeat: repeatGroupValidator,
	'auto-filename': undefined,
	'aws-file-upload': undefined,
	'checkbox-group': checkboxGroupValidator,
	checkbox: checkboxValidator,
	'date-time': dateTimeValidator,
	disabled: undefined,
	dropdown: undefined,
	'file-name': fileNameValidator,
	forcehttps: undefined,
	'image-picker': undefined,
	input: inputValidator,
	'internal-name': undefined,
	label: undefined,
	'locale-selector': undefined,
	'node-selector': nodeSelectorValidator,
	'numeric-input': numericInputValidator,
	'page-nav-order': undefined,
	rte: rteValidator,
	textarea: inputValidator,
	time: undefined,
	'transcoded-video-picker': undefined,
	uuid: undefined,
	'video-picker': undefined,
	colorPicker: undefined,
	'date-time-expression-input': dateTimeExpressionInputValidator,
	'input-email': inputEmailValidator,
	'input-link': inputLinkValidator,
	'input-phone': inputPhoneValidator,
	'path-with-macro-creator': pathWithMacroValidator,
	variable: variableValidator
};

/**
 * Control types whose validator applies the required constraint itself.
 * {@link validateFieldValue} does not add a required message for these. The validator emits that message.
 */
const validatorsOwningRequired = new Set<BuiltInControlType | DescriptorControlType>(['file-name']);

/**
 * Validators selected by a validation key on the field, not by its control type.
 * A key runs only when that validation is present. `required` is applied the same way in
 * {@link validateFieldValue}. `minValue`, `maxValue` and pattern/regex stay with the controls
 * that already read those keys. See utils/countLimits.ts for the item-count spec.
 */
const validationValidators: Partial<Record<string, BuiltInValidator>> = {
	itemCount: itemCountEditorValidator
};

function isMessageDescriptor(value: unknown): value is MessageDescriptor {
	if (value == null || typeof value !== 'object' || Array.isArray(value)) return false;
	const { id, defaultMessage } = value as Record<string, unknown>;
	return typeof id === 'string' || typeof defaultMessage === 'string';
}

/** A string, a `MessageDescriptor`, or a `[MessageDescriptor, values?]` tuple. See {@link FieldValidityMessage}. */
function isValidMessage(message: unknown): boolean {
	if (typeof message === 'string') return true;
	if (Array.isArray(message)) {
		const [descriptor, values] = message;
		return (
			message.length <= 2 &&
			isMessageDescriptor(descriptor) &&
			(values === undefined || (values !== null && typeof values === 'object'))
		);
	}
	return isMessageDescriptor(message);
}

function isValidMessageList(messages: unknown): boolean {
	return Array.isArray(messages) && messages.every(isValidMessage);
}

/**
 * Wraps a plugin validator for the host. The plugin gets a fresh context with only the public members,
 * so host internals cannot leak. A result that is not `{ valid: true }` is invalid, and a malformed one is reported.
 * A validator that throws or rejects is invalid too, so a failed request never rejects the field's validation.
 * It is logged, unless it is an `AbortError` and the host's own signal aborted: that run was superseded and its
 * outcome is discarded. A plugin aborting its own controller is still logged.
 */
function adaptPluginValidator(validator: Validator): BuiltInValidator {
	return async (value, ctx) => {
		const pluginCtx: ValidatorContext = {
			field: ctx.field,
			signal: ctx.signal,
			siteId: ctx.siteId,
			getValue: ctx.getValue
		};
		let result: ValidatorResult;
		try {
			result = await validator(value, pluginCtx);
		} catch (error) {
			if (!(pluginCtx.signal.aborted && (error as Error | undefined)?.name === 'AbortError')) {
				console.error(
					`The validator for control type "${ctx.field.type}" threw. The field is treated as invalid.`,
					error
				);
			}
			return { valid: false, messages: [] };
		}
		if (
			result == null ||
			typeof result !== 'object' ||
			typeof result.valid !== 'boolean' ||
			(result.messages !== undefined && !isValidMessageList(result.messages))
		) {
			console.error(
				`The validator for control type "${ctx.field.type}" must return { valid: boolean, messages?: [] }. ` +
					`The field is treated as invalid.`,
				result
			);
			return { valid: false, messages: [] };
		}
		return { valid: result.valid, messages: result.messages ?? [] };
	};
}

/**
 * Built-in map first (including explicit `undefined` = no type validator).
 * Plugin contributions only for types absent from the built-in map.
 * Required stays in {@link validateFieldValue}, except for types in {@link validatorsOwningRequired}.
 */
function getFieldValidator(fieldType: string): BuiltInValidator | undefined {
	if (Object.hasOwn(validatorsMap, fieldType)) {
		return validatorsMap[fieldType as BuiltInControlType | DescriptorControlType];
	}
	const pluginValidator = getPluginControlValidator(fieldType);
	return pluginValidator ? adaptPluginValidator(pluginValidator) : undefined;
}

/** True when a built-in or plugin type validator is registered for `fieldType`. */
export function hasFieldValidator(fieldType: string): boolean {
	return nnou(getFieldValidator(fieldType));
}

/** True when the field carries a validation key that has its own validator, such as `itemCount`. */
export function hasValidationKeyValidator(field: ContentTypeField): boolean {
	const validations = field.validations;
	if (!validations) return false;
	return Object.keys(validations).some((key) => Object.hasOwn(validationValidators, key));
}

/**
 * `getValue` for a nested run: reads `values`, the item or component being validated, never the root form.
 * `values` is already part of the enclosing field's own value, so a change to it re-runs that field's validation.
 */
function scopeGetValue(values: unknown): (fieldId: string) => unknown {
	return (fieldId) =>
		values != null && typeof values === 'object' && Object.hasOwn(values, fieldId)
			? (values as Record<string, unknown>)[fieldId]
			: undefined;
}

function createBuiltInContext(field: ContentTypeField, meta: ValidatorMetaData): BuiltInValidatorContext {
	return {
		field,
		signal: meta.signal ?? new AbortController().signal,
		siteId: meta.siteId,
		getValue: (fieldId) => meta.getValue?.(fieldId),
		meta
	};
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
	const messages: FieldValidityState['messages'] = [];
	const isEmpty = isEmptyValue(field, currentValue);
	const requiredByConstraint = Boolean(field.validations?.required?.value);
	// A positive minCount is reported by the occurrence check. Don't add a second "required" message.
	const minimum = countLimitValue(field.validations?.minCount?.value);
	// This control's validator applies required itself, against the value it actually edits.
	const ownsRequired = validatorsOwningRequired.has(field.type as BuiltInControlType | DescriptorControlType);

	// A required constraint with an empty value is invalid. Types that own required decide that themselves.
	if (!ownsRequired && requiredByConstraint && isEmpty && minimum == null) {
		messages.push(defineMessage({ defaultMessage: 'This field is required.' }));
		return Promise.resolve({ isValid: false, messages });
	}
	const validator = getFieldValidator(field.type);
	const ctx = createBuiltInContext(field, meta);
	let isValid = true;
	// The type validator runs for the control. Validation-key validators run only for keys this field has.
	if (nnou(validator)) {
		const result = await validator(currentValue, ctx);
		isValid = result.valid;
		messages.push(...(result.messages ?? []));
	}
	for (const key of Object.keys(field.validations ?? {})) {
		// Own keys only, same as hasValidationKeyValidator. A prototype name is not a validator.
		if (!Object.hasOwn(validationValidators, key)) continue;
		const keyed = await validationValidators[key](currentValue, ctx);
		if (!keyed.valid) isValid = false;
		messages.push(...(keyed.messages ?? []));
	}
	return Promise.resolve({ isValid, messages });
}

const minItemsMessage = defineMessage({
	defaultMessage: 'At least {minCount, plural, one {# item is} other {# items are}} required.'
});
const maxItemsMessage = defineMessage({
	defaultMessage: 'No more than {maxCount, plural, one {# item is} other {# items are}} allowed.'
});

/** Same occurrence errors for every item-count control. See utils/countLimits.ts. Empty when the count is allowed. */
function itemCountViolationMessages(count: number, field: ContentTypeField): FieldValidityMessage[] {
	const minCount = countLimitValue(getValidationValue(field.validations, 'minCount'));
	const maxCount = countLimitValue(getValidationValue(field.validations, 'maxCount'));
	return getRepeatOccurrenceViolations(count, minCount, maxCount).map((violation): FieldValidityMessage =>
		violation.kind === 'min'
			? [minItemsMessage, { minCount: violation.limit }]
			: [maxItemsMessage, { maxCount: violation.limit }]
	);
}

/** Type Builder min/max. Blank and '*' are unlimited. 0 is not a maximum. See utils/countLimits.ts. */
function itemCountEditorValidator(currentValue: unknown, ctx: ValidatorContext): ValidatorResult {
	const { field } = ctx;
	const spec = readItemCountEditorSpec(getValidationValue(field.validations, 'itemCount'));
	if (!spec) return { valid: true };
	const { role } = spec;
	const partner = spec.partner ? ctx.getValue(spec.partner) : undefined;
	const formatValid =
		role === 'max' ? isItemCountMaxEditorValue(currentValue) : isItemCountMinEditorValue(currentValue);
	if (!formatValid) {
		return {
			valid: false,
			messages: [
				role === 'max'
					? field.type === 'string'
						? defineMessage({
								defaultMessage: "Enter '*' or an integer of 1 or more. Leave blank for no maximum."
							})
						: defineMessage({
								defaultMessage: 'Enter an integer of 1 or more, or leave blank for no maximum.'
							})
					: defineMessage({ defaultMessage: 'Enter a non-negative integer, or leave blank for no minimum.' })
			]
		};
	}
	const minValue = role === 'min' ? currentValue : partner;
	const maxValue = role === 'max' ? currentValue : partner;
	if (!isItemCountRangeValid(minValue, maxValue)) {
		return { valid: false, messages: [defineMessage({ defaultMessage: 'Minimum cannot be greater than maximum.' })] };
	}
	return { valid: true };
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
	// The marker is the required constraint, or a positive minimum. See utils/countLimits.ts.
	return Boolean(field.validations?.required?.value) || countLimitValue(field.validations?.minCount?.value) != null;
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

/**
 * File-name rules: required, then uniqueness.
 * The name is {@link ValidatorMetaData.fileName}, the atom this control edits. The raw field value is not read.
 * A blank name is invalid except on the home page, where it is allowed unless the stored required constraint says so.
 *
 * @param {string} _value - Unused. This control does not validate the raw field value.
 * @param {BuiltInValidatorContext} ctx - The field, and metadata containing site ID, the file-name atom, and item context.
 * @returns {Promise<ValidatorResult>} - Valid when the file name is allowed, otherwise invalid with the reason.
 *
 */
export async function fileNameValidator(_value: string, ctx: BuiltInValidatorContext): Promise<ValidatorResult> {
	const { field, meta } = ctx;
	const siteId: string = meta.siteId;
	// Single source: the file-name atom. createFileNameAtom derives it from the path. The raw field value is ignored.
	const currentValue = meta.fileName;
	const blank = isEmptyValue(field, currentValue);
	const storedRequired = Boolean(field.validations?.required?.value);
	// Blank is invalid, except on the home page, where it is allowed unless the stored constraint requires it.
	if (blank && (meta.itemMeta?.path !== rootPagePath || storedRequired)) {
		return { valid: false, messages: [defineMessage({ defaultMessage: 'This field is required.' })] };
	}
	if (blank) return { valid: true };

	const initialPath = meta.itemMeta.path ?? meta.itemMeta.pathInSite;
	const isPage = isPagePath(withIndex(initialPath));
	const basePath = nnou(meta.itemMeta.path) ? getBasePath(initialPath, isPage) : meta.itemMeta.pathInSite;
	const newPath = computePathFromFileName(currentValue, isPage, basePath);

	if (initialPath === newPath || nou(siteId)) return { valid: true };

	try {
		const exists = await firstValueFrom(checkPathExistence(siteId, newPath));
		return exists
			? { valid: false, messages: [[defineMessage({ defaultMessage: 'An item with that name already exists.' })]] }
			: { valid: true };
	} catch {
		return { valid: false };
	}
}

export function dateTimeValidator(currentValue: string, ctx: ValidatorContext): ValidatorResult {
	const allowPastDate: boolean = getPropertyValue(ctx.field.properties, 'allowPastDate') as boolean;
	const fieldDate = new Date(currentValue as string);
	const currentDate = new Date();
	if (!allowPastDate && !isNaN(fieldDate.valueOf()) && fieldDate < currentDate) {
		return { valid: false, messages: [defineMessage({ defaultMessage: 'The date cannot be in the past.' })] };
	}
	return { valid: true };
}

export function dateTimeExpressionInputValidator(currentValue: string): ValidatorResult {
	return validateDatePopulateExpression(currentValue)
		? { valid: true }
		: { valid: false, messages: [defineMessage({ defaultMessage: 'The expression is not valid.' })] };
}

/**
 * Validates a repeat group's size against minCount/maxCount, then each item's fields.
 * The minimum comes only from minOccurs. A count equal to either bound is valid.
 */
export async function repeatGroupValidator(
	currentValue: Array<RepeatItem>,
	ctx: BuiltInValidatorContext
): Promise<ValidatorResult> {
	const { field, meta } = ctx;
	const items = Array.isArray(currentValue) ? currentValue : [];
	// minCount/maxCount are the mapped limits. See utils/countLimits.ts.
	const messages = itemCountViolationMessages(items.length, field);
	let valid = messages.length === 0;

	// If there are no items, return validation result (items validation is not needed if there are no items)
	if (items.length === 0) return { valid, messages };

	const fields = field.fields;
	if (!fields) return { valid, messages };

	const validationPromises: Promise<FieldValidityState>[] = [];

	// Validate fields of each repeat group item. Min/max occurrence checks above still apply.
	items.forEach((item) => {
		// Sub-fields see their own item, not the page. See ValidatorContext.getValue.
		const childMeta: ValidatorMetaData = { ...meta, signal: ctx.signal, getValue: scopeGetValue(item) };
		Object.values(fields).forEach((subField) => {
			if (isFieldPathIrrelevant(meta.irrelevantFieldPaths, subField.id, field.id)) return;
			const id = subField.id;
			const value = item[id];
			const validationPromise = validateFieldValue(subField, value, childMeta);
			validationPromises.push(validationPromise);
		});
	});

	const results = await Promise.all(validationPromises);
	results.forEach((result) => {
		if (!result.isValid) {
			valid = false;
		}
	});
	return { valid, messages };
}

/**
 * Validates the input value of a field based on its pattern and maximum length.
 *
 * @param {string} currentValue - The current value of the field to validate.
 * @param {ValidatorContext} ctx - The field being validated, including its validation rules.
 * @param customValidationMessages - An optional lookup table of custom validation messages for specific validation rules.
 * @returns {ValidatorResult} - Valid when the input value is valid; otherwise invalid with the reasons.
 *
 */
export function inputValidator(
	currentValue: string,
	ctx: ValidatorContext,
	customValidationMessages?: LookupTable<MessageDescriptor>
): ValidatorResult {
	const { field } = ctx;
	const messages: FieldValidityMessage[] = [];
	// Skip validation if value is empty and field is not required
	if (currentValue == null || (typeof currentValue === 'string' && currentValue.trim() === '')) {
		return { valid: true };
	}
	const pattern = field.validations.pattern?.value as string;
	const maxLength: number | undefined = getValidationValue(field.validations, 'maxlength');
	// If there's a pattern and it doesn't match, it's invalid.
	if (pattern && !String(currentValue).match(pattern)) {
		messages.push([
			customValidationMessages?.['pattern'] ??
				defineMessage({ defaultMessage: 'The value does not match the required pattern.' })
		]);
	}

	if (nnou(maxLength) && currentValue.length > maxLength) {
		messages.push([
			defineMessage({ defaultMessage: `The value is greater than the allowed maximum ({maxLength}).` }),
			{ maxLength }
		]);
	}
	return { valid: messages.length === 0, messages };
}

/**
 * Validates a numeric input value based on its pattern, maximum value, and minimum value.
 *
 * @param {number} currentValue - The current numeric value of the field to validate.
 * @param {ValidatorContext} ctx - The field being validated, including its validation rules.
 * @returns {ValidatorResult} - Valid when the numeric value is valid; otherwise invalid with the reasons.
 *
 */
export function numericInputValidator(currentValue: number, ctx: ValidatorContext): ValidatorResult {
	const { field } = ctx;
	const messages: FieldValidityMessage[] = [];
	const pattern: string = getValidationValue(field.validations, 'pattern');
	const maxValue: number = getValidationValue(field.validations, 'maxValue');
	const minValue: number = getValidationValue(field.validations, 'minValue');
	const lastUnderscore = field.id.lastIndexOf('_');
	const numType = lastUnderscore !== -1 ? field.id.substring(lastUnderscore) : '_i';

	if (nou(currentValue)) {
		return { valid: true };
	}
	if (Number.isNaN(Number(currentValue))) {
		return { valid: false, messages: [[defineMessage({ defaultMessage: 'Please enter a valid number.' })]] };
	}

	let numTypeRegex;
	if (numType === '_f' || numType === '_d') {
		// with decimals
		numTypeRegex = /^[+-]?\d+(\.\d+)?$/;
		if (!String(currentValue).match(numTypeRegex)) {
			messages.push([defineMessage({ defaultMessage: 'Please enter a valid decimal number.' })]);
		}
	} else {
		numTypeRegex = /^([+-]?[1-9]\d*|0)$/;
		if (!String(currentValue).match(numTypeRegex)) {
			messages.push([defineMessage({ defaultMessage: "Decimals aren't allowed on this input." })]);
		}
	}

	// If there's a pattern and it doesn't match
	if (pattern && !String(currentValue).match(pattern)) {
		messages.push([defineMessage({ defaultMessage: 'The value does not match the required pattern.' })]);
	}
	// If there's a max and the value is greater than the max
	if (maxValue != null && Number(currentValue) > Number(maxValue)) {
		messages.push([
			defineMessage({ defaultMessage: `The value is greater than the allowed maximum ({maxValue}).` }),
			{ maxValue }
		]);
	}
	// If there's a min and the value is less than the min
	if (minValue != null && Number(currentValue) < Number(minValue)) {
		messages.push([
			defineMessage({ defaultMessage: 'The value is less than the minimum ({minValue}).' }),
			{ minValue }
		]);
	}
	return { valid: messages.length === 0, messages };
}

export async function nodeSelectorValidator(
	currentValue: Array<NodeSelectorItem>,
	ctx: BuiltInValidatorContext
): Promise<ValidatorResult> {
	const { field, meta } = ctx;
	const items = Array.isArray(currentValue) ? currentValue : [];
	// This set is used to keep track of visited content items during validation to prevent infinite loops in case of circular references.
	const visited = new Set<string>();
	// minCount/maxCount are the mapped limits. 0 is unlimited. See utils/countLimits.ts.
	const messages = itemCountViolationMessages(items.length, field);
	let valid = messages.length === 0;
	const embeddedContent = items.filter((item) => nnou(item.component));

	// If there are no embedded items, return validation result (items validation is not needed if there are no items)
	if (embeddedContent.length === 0) return { valid, messages };
	if (!meta.contentTypesById) return { valid, messages };

	const validationPromises: Promise<FieldValidityState>[] = [];

	// Validate fields of each embedded item. Min/max size checks above still apply.
	// `for...of` so each child's deny-list is resolved before its field promises are collected.
	for (const { component } of embeddedContent) {
		const contentTypeId = component['content-type'] as string;
		const objectId = component['objectId'] as string;
		if (visited.has(objectId)) continue; // prevent circular validation
		visited.add(objectId);
		const contentType = meta.contentTypesById[contentTypeId];
		if (!contentType) continue;
		const fields = contentType.fields;
		if (!fields) continue;
		const denyList =
			(await meta.resolveEmbeddedRelevance?.(contentType, component as Record<string, unknown>, meta.itemMeta?.path)) ??
			null;
		const childMeta: ValidatorMetaData = {
			...meta,
			irrelevantFieldPaths: denyList,
			signal: ctx.signal,
			getValue: scopeGetValue(component)
		};
		Object.values(fields).forEach((embeddedField) => {
			if (isFieldPathIrrelevant(denyList, embeddedField.id)) return;
			const value = component[embeddedField.id];
			const validationPromise = validateFieldValue(embeddedField, value, childMeta);
			validationPromises.push(validationPromise);
		});
	}

	const results = await Promise.all(validationPromises);
	let invalidEmbedded = false;
	results.forEach((result) => {
		if (!result.isValid) {
			invalidEmbedded = true;
			valid = false;
		}
	});
	if (invalidEmbedded) {
		messages.push(defineMessage({ defaultMessage: 'One or more embedded content items are invalid.' }));
	}
	return { valid, messages };
}

export function checkboxGroupValidator(
	currentValue: CheckboxGroupProps['value'],
	ctx: ValidatorContext
): ValidatorResult {
	// minCount is the mapped limit. 0 and blank are no minimum. There is no maximum. See utils/countLimits.ts.
	const selectedCount = Array.isArray(currentValue) ? currentValue.length : 0;
	const messages = itemCountViolationMessages(selectedCount, ctx.field);
	return { valid: messages.length === 0, messages };
}

export function checkboxValidator(currentValue: boolean, ctx: ValidatorContext): ValidatorResult {
	const isRequired = isFieldRequired(ctx.field);
	// For checkboxes, being required means it must be checked (true)
	if (isRequired && !currentValue) {
		return { valid: false, messages: [defineMessage({ defaultMessage: 'This checkbox must be checked.' })] };
	}
	return { valid: true };
}

/** Validates an email input field using a predefined email pattern message. */
function inputEmailValidator(currentValue: string, ctx: ValidatorContext): ValidatorResult {
	return inputValidator(currentValue, ctx, {
		pattern: defineMessage({ defaultMessage: 'Please enter a valid email address.' })
	});
}

/** Validates a link (URL) input field using a predefined URL pattern message. */
function inputLinkValidator(currentValue: string, ctx: ValidatorContext): ValidatorResult {
	return inputValidator(currentValue, ctx, {
		pattern: defineMessage({ defaultMessage: 'Please enter a valid URL.' })
	});
}

/** Validates a phone number input field using a predefined phone number pattern message. */
function inputPhoneValidator(currentValue: string, ctx: ValidatorContext): ValidatorResult {
	return inputValidator(currentValue, ctx, {
		pattern: defineMessage({ defaultMessage: 'Please enter a valid phone number.' })
	});
}

function rteValidator(currentValue: string, ctx: ValidatorContext): ValidatorResult {
	const { field } = ctx;
	if (nou(field)) return { valid: true };
	const messages: FieldValidityMessage[] = [];
	const isRequired = isFieldRequired(field);
	const maxLength: number | undefined = getValidationValue(field.validations, 'maxLength');
	const trimmedContent = measureRteValue(currentValue); // Get only the text and remove white space
	const { isValid, requiredFailed, maxLengthExceeded } = evaluateRteConstraints(trimmedContent, isRequired, maxLength);

	if (requiredFailed) {
		messages.push(defineMessage({ defaultMessage: 'This field is required.' }));
	}
	if (maxLengthExceeded) {
		messages.push([
			defineMessage({
				defaultMessage: `The value is greater than the allowed maximum ({maxLength}).`
			}),
			{ maxLength }
		]);
	}

	return { valid: isValid, messages };
}

function pathWithMacroValidator(currentValue: string): ValidatorResult {
	if (currentValue.trim() === '') {
		return { valid: true };
	}
	const validMacros = Object.values(macroCreatorLookupTable).map(({ macro }) => macro);
	// Find all macros in the currentValue (e.g., {macroName})
	const macroRegex = /(\{[a-zA-Z0-9_]+\})/g;
	const foundMacros = Array.from(currentValue.matchAll(macroRegex)).map((match) => match[1]);

	// Find macros not in the whitelist
	const invalidMacros = foundMacros.filter((macro) => !validMacros.includes(macro));

	if (invalidMacros.length > 0) {
		return {
			valid: false,
			messages: [
				[
					defineMessage({ defaultMessage: 'The following are invalid macros: {invalidMacros}.' }),
					{ invalidMacros: invalidMacros.join(', ') }
				]
			]
		};
	}

	return { valid: true };
}

function variableValidator(currentValue: string, ctx: BuiltInValidatorContext): ValidatorResult {
	const { meta } = ctx;
	if (!currentValue?.trim() || !meta.siblingIds?.length) {
		return { valid: true };
	}
	const ownIds = new Set(meta.currentIds ?? []);
	const candidateIds = [
		currentValue,
		...asArray(meta.additionalFields).map((pattern) => processAdditionalFieldMacro(currentValue, pattern))
	];
	const isDuplicate = candidateIds.some((id) => meta.siblingIds!.includes(id) && !ownIds.has(id));
	if (isDuplicate) {
		return { valid: false, messages: [defineMessage({ defaultMessage: 'That variable name is already in use.' })] };
	}
	return { valid: true };
}

export default validateFieldValue;
