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

import type { ContentTypeField, ContentTypeFieldValidation } from '../../../models/ContentType';
import { readNumericLimit } from '../../../utils/countLimits';

/**
 * Retrieves the value of a specific validation property from a field's validations.
 *
 * @param validations {ContentTypeField['validations']} - The validations object containing various validation properties.
 * @param property {string} - The name of the validation property to retrieve.
 * @param [defaultValue=undefined] {ContentTypeFieldValidation['value'] | undefined} - The default value to return if the property is not found.
 * @returns {ContentTypeFieldValidation['value']} - The value of the specified validation property, or the default value if the property is not found.
 */
export function getValidationValue(
	validations: ContentTypeField['validations'],
	property: string,
	defaultValue: ContentTypeFieldValidation['value'] | undefined = undefined
): ContentTypeFieldValidation['value'] {
	return validations?.[property]?.value ?? defaultValue;
}

/**
 * Positive integer limit from a field validation (e.g. `maxLength`), or `undefined` when
 * missing, zero, blank, or non-numeric. Invalid values are treated as no limit so consumers
 * never compare lengths against a string (e.g. hand-edited `maxlength: abc`).
 */
export function getNumericValidationValue(
	validations: ContentTypeField['validations'],
	property: string
): number | undefined {
	return readNumericLimit(validations?.[property]?.value);
}

/**
 * Retrieves the value of a specific property from a field's properties.
 *
 * @param properties {ContentTypeField['properties']} - The properties object containing various property definitions.
 * @param property {string} - The name of the property to retrieve.
 * @param [defaultValue=undefined] {ContentTypeField['properties'][string]['value'] | undefined} - The default value to return if the property is not found.
 * @returns {ContentTypeField['properties'][string]['value']} - The value of the specified property, or the default value if the property is not found.
 */
export function getPropertyValue(
	properties: ContentTypeField['properties'],
	property: string,
	defaultValue: ContentTypeField['properties'][string]['value'] | undefined = undefined
): ContentTypeField['properties'][string]['value'] {
	return properties?.[property]?.value ?? defaultValue;
}
