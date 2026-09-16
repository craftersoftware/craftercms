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

import React, { useContext, useEffect, useId, useMemo } from 'react';
import { FormsEngineField } from '../components/FormsEngineField';
import { ControlProps } from '../types';
import { DateTimeTimezonePicker, type DateTimeTimezonePickerProps } from '../../DateTimeTimezonePicker';
import SecondaryButton from '../../SecondaryButton';
import { FormattedMessage } from 'react-intl';
import Box from '@mui/material/Box';
import { StableFormContext } from '../lib/formsEngineContext';
import { processPopulateExpression, validateTimePopulateExpression } from '../lib/controlHelpers';
import { getPropertyValue, isFieldReadOnly } from '../lib/formUtils';

export interface TimeProps extends ControlProps {
	value: string | null;
}

// TODO: Timezone selector handling is pending. FE1 uses an extra `_tz` field to store the timezone value.
export function Time(props: TimeProps) {
	const { field, value: valueProp, setValue, readonly: formReadonly, autoFocus } = props;
	const htmlId = useId();
	const stableFormContext = useContext(StableFormContext);
	const isCreateMode = Boolean(stableFormContext?.props?.create);

	// region field properties/validations
	const useCustomTimezone: boolean = getPropertyValue(field.properties, 'useCustomTimezone') as boolean;
	const showClear: boolean = getPropertyValue(field.properties, 'showClear') as boolean;
	const showSetNow: boolean = getPropertyValue(field.properties, 'showNowLink') as boolean;
	const populate: boolean = getPropertyValue(field.properties, 'populate') as boolean;
	const populateDateExp: string = getPropertyValue(field.properties, 'populateDateExp', '') as string;
	const readonlyEdit: boolean = Boolean(field.properties?.readonlyEdit?.value);
	/*
		There are 3 scenarios for the field to be readonly:
			1. The form is in readonly mode (formReadonly is true)
			2. The field is set to readonly in TB (field.properties.readonly.value is true)
			3. The field is set to readonly for edit mode only, and the form is not in create mode (readonlyEdit is true and isCreateMode is false)
			* 1 and 2 are handled in isFieldReadOnly util
	*/
	const readonly = isFieldReadOnly(field, formReadonly) || (readonlyEdit && !isCreateMode);
	// endregion

	// If populate is true and there is no value, set it to the current time
	const value = useMemo(() => {
		if (populate && populateDateExp && !valueProp) {
			return parseDateToTime(
				processPopulateExpression({
					expression: populateDateExp,
					validatePopulateExpression: validateTimePopulateExpression
				})
			);
		}
		return valueProp;
	}, [valueProp, populate, populateDateExp]);
	const dateValue = parseTimeToDate(value);

	useEffect(() => {
		// If populate is true, and populateDateExp is valid, and valueProp is empty, set the value to the result of the populate expression.
		if (!readonly && populate && populateDateExp && !valueProp) {
			const computed = parseDateToTime(
				processPopulateExpression({
					expression: populateDateExp,
					validatePopulateExpression: validateTimePopulateExpression
				})
			);
			if (computed != null) setValue(computed);
		}
	}, [readonly, populate, populateDateExp, valueProp, setValue]);

	const handleChange: DateTimeTimezonePickerProps['onChange'] = (date) => {
		setValue(parseDateToTime(date));
	};
	const setNow = () => {
		// get only the time part from the current date (as a string)
		const timeString = parseDateToTime(new Date());
		setValue(timeString);
	};
	const clearValue = () => setValue(null);

	return (
        <FormsEngineField htmlFor={htmlId} field={field}>
            <DateTimeTimezonePicker
				id={htmlId}
				value={dateValue}
				disabled={readonly}
				autoFocus={autoFocus}
				onChange={handleChange}
				disableTimezoneSelection={!useCustomTimezone}
				pickers={['time']}
				size="medium"
				sxs={{
					root: { flexDirection: 'row', gap: 2 },
					dateTimePicker: { flex: 1 },
					timezoneAutocomplete: { flex: 1 }
				}}
			/>
            <Box
                sx={{
                    display: "flex",
                    gap: 2,
                    justifyContent: "flex-end"
                }}>
				{showSetNow && (
					<SecondaryButton onClick={setNow} disabled={readonly}>
						<FormattedMessage defaultMessage="Set now" />
					</SecondaryButton>
				)}
				{showClear && (
					<SecondaryButton onClick={clearValue} disabled={readonly}>
						<FormattedMessage defaultMessage="Clear value" />
					</SecondaryButton>
				)}
			</Box>
        </FormsEngineField>
    );
}

/**
 * Converts a time string in the format "HH:mm:ss" into a `Date` object.
 *
 * @param time {string} - The time string to convert, formatted as "HH:mm:ss".
 * @returns {Date | null} - A `Date` object representing the parsed time, or `null` if the input is invalid.
 */
function parseTimeToDate(time: string): Date | null {
	if (!time) return null;
	const [h, m = '0', s = '0'] = time.split(':');
	const hours = Number(h);
	const minutes = Number(m);
	const seconds = Number(s);

	// Check time ranges
	if (
		!Number.isFinite(hours) ||
		!Number.isFinite(minutes) ||
		!Number.isFinite(seconds) ||
		hours < 0 ||
		hours > 23 ||
		minutes < 0 ||
		minutes > 59 ||
		seconds < 0 ||
		seconds > 59
	) {
		return null;
	}

	const date = new Date();
	date.setHours(hours, minutes, seconds, 0);
	return date;
}

/**
 * Converts a `Date` object into a time string in the format "HH:mm:ss".
 *
 * @param date {Date | null} - The `Date` object to convert to a time string.
 * @returns {string | null} - The formatted time string or `null` if the input is invalid.
 */
function parseDateToTime(date: Date | null): string | null {
	if (!date || Number.isNaN(date.valueOf())) return null;
	return date.toLocaleTimeString('en-US', { hour12: false });
}

export default Time;
