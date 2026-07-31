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
import { StableFormContext, useStableFormContext } from '../lib/formsEngineContext';
import { processPopulateExpression, validateDatePopulateExpression } from '../lib/controlHelpers';
import { getPropertyValue, isFieldReadOnly } from '../lib/formUtils';
import { PrimitiveAtom, useAtom } from 'jotai';

export interface DateTimeProps extends ControlProps {
	value: string;
}

export function DateTime(props: DateTimeProps) {
	const { field, value: valueProp, setValue, readonly: formReadonly, autoFocus } = props;
	const htmlId = useId();
	const stableFormContext = useContext(StableFormContext);
	const isCreateMode = Boolean(stableFormContext?.props?.create);

	const formContext = useStableFormContext();
	const timezoneAtom = formContext.atoms.valueByFieldId[`${field.id}_tz`] as PrimitiveAtom<string> | undefined;
	if (!timezoneAtom) {
		throw new Error(
			`Missing timezone atom for field "${field.id}_tz". Additional fields must be created during form bootstrap.`
		);
	}
	const [timezoneValue, setTimezoneValue] = useAtom(timezoneAtom);

	// region field properties/validations

	const allowPastDate: boolean = getPropertyValue(field.properties, 'allowPastDate') as boolean;
	const useCustomTimezone: boolean = getPropertyValue(field.properties, 'useCustomTimezone') as boolean;
	const showDate = getPropertyValue(field.properties, 'showDate') as boolean;
	const showTime = getPropertyValue(field.properties, 'showTime') as boolean;
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

	const value = useMemo(() => {
		if (populate && populateDateExp && !valueProp) {
			return processPopulateExpression({
				expression: populateDateExp,
				allowPastDate,
				validatePopulateExpression: validateDatePopulateExpression
			}).toISOString();
		}
		return valueProp;
	}, [valueProp, populate, populateDateExp, allowPastDate]);

	useEffect(() => {
		// If populate is true, and populateDateExp is valid, and valueProp is empty, set the value to the result of the populate expression.
		if (!readonly && populate && populateDateExp && !valueProp) {
			const populatedDate = processPopulateExpression({
				expression: populateDateExp,
				allowPastDate,
				validatePopulateExpression: validateDatePopulateExpression
			});
			setValue(populatedDate.toISOString());
		}
	}, [readonly, populate, populateDateExp, valueProp, allowPastDate, setValue]);

	const handleChange: DateTimeTimezonePickerProps['onChange'] = (value) => setValue(value.toISOString());
	const setNow = () => {
		const date = new Date();
		// If allowPastDate is false, set it to the end of the current minute to avoid setting it to a past date.
		if (!allowPastDate) date.setSeconds(59, 0);
		setValue(date.toISOString());
	};
	const clearValue = () => setValue(null);
	const pickers: DateTimeTimezonePickerProps['pickers'] = useMemo(() => {
		const p: DateTimeTimezonePickerProps['pickers'] = [];
		if (showDate) p.push('date');
		if (showTime) p.push('time');
		// Fallback to 'date' if both toggles are false.
		return p.length ? p : (['date'] as DateTimeTimezonePickerProps['pickers']);
	}, [showDate, showTime]);

	return (
		<>
			<FormsEngineField htmlFor={htmlId} field={field}>
				<DateTimeTimezonePicker
					id={htmlId}
					value={value}
					timezoneValue={timezoneValue}
					disablePast={!allowPastDate}
					disabled={readonly}
					autoFocus={autoFocus}
					onChange={handleChange}
					onTimezoneChange={(tz) => setTimezoneValue(tz)}
					disableTimezoneSelection={!useCustomTimezone}
					pickers={pickers}
					size="medium"
					sxs={{
						root: { flexDirection: 'row', gap: 2 },
						dateTimePicker: { flex: 1 },
						timezoneAutocomplete: { flex: 1 }
					}}
				/>
				<Box display="flex" gap={2} justifyContent="flex-end">
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
		</>
	);
}

export default DateTime;
