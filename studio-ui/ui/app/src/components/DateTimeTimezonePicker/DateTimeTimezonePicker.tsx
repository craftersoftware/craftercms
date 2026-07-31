/*
 * Copyright (C) 2007-2022 Crafter Software Corporation. All Rights Reserved.
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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Moment } from 'moment-timezone';
import moment from 'moment-timezone';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import { DateTimePicker, DateTimePickerProps } from '@mui/x-date-pickers/DateTimePicker';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import TextField, { type TextFieldProps } from '@mui/material/TextField';
import Autocomplete, { AutocompleteProps } from '@mui/material/Autocomplete';
import FormControl from '@mui/material/FormControl';
import useLocale from '../../hooks/useLocale';
import useUpdateRefs from '../../hooks/useUpdateRefs';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import {
	createAtLeastHalfHourInFutureDate,
	createTransposedToTimezoneDate,
	getZDateOffset
} from '../../utils/datetime';
import Box from '@mui/material/Box';
import type { PartialSxRecord } from '../../models';

export interface DateTimeTimezonePickerProps {
	id?: string;
	value: string | Date | number | null;
	timezoneValue?: string;
	disabled?: boolean;
	disablePast?: boolean;
	autoUpdatePastDate?: boolean;
	autoFocus?: boolean;
	disableTimezoneSelection?: boolean;
	localeCode?: string;
	dateTimeFormatOptions?: Intl.DateTimeFormatOptions;
	pickers?: ('date' | 'time')[];
	sxs?: PartialSxRecord<'root' | 'dateTimePicker' | 'timezoneAutocomplete'>;
	size?: TextFieldProps['size'];
	onError?: DateTimePickerProps['onError'];
	onChange?(date: Date): void;
	onTimezoneChange?(timezone: string): void;
}

export function DateTimeTimezonePicker(props: DateTimeTimezonePickerProps) {
	const locale = useLocale();
	const resolvedLocaleData = useMemo(() => Intl.DateTimeFormat().resolvedOptions(), []);
	const {
		id,
		value: dateProp,
		timezoneValue,
		disabled = false,
		disablePast = false,
		autoUpdatePastDate = false,
		autoFocus = false,
		disableTimezoneSelection = false,
		localeCode = locale.localeCode || 'en-US',
		dateTimeFormatOptions = locale.dateTimeFormatOptions ?? resolvedLocaleData,
		pickers = ['date', 'time'],
		sxs = {},
		size = 'small',
		onChange,
		onTimezoneChange,
		onError
	} = props;
	const hour12 = dateTimeFormatOptions?.hour12;
	const timeZones = useMemo(() => moment.tz.names(), []);
	const [selectedDate, setSelectedDate] = useState<Moment | null>(null);
	const [selectedTimezone, setSelectedTimezone] = useState<string | null>(
		timezoneValue ? timezoneValue : (resolvedLocaleData.timeZone ?? null)
	);
	// The control timezone lags behind selectedTimezone. It is only updated when there's a different
	// selectedTimezone to the navigator's locale, and the value (date) prop changes.
	const [controlTimezone, setControlTimezone] = useState<string | null>(resolvedLocaleData.timeZone ?? null);
	const mountedRef = useRef(false);
	const effectRefs = useUpdateRefs({
		dateProp,
		selectedDate,
		selectedTimezone,
		controlTimezone,
		disablePast,
		onChange
	});
	// Keep local timezone state aligned when the bound form value loads/changes after mount.
	useEffect(() => {
		if (timezoneValue != null) {
			setSelectedTimezone(timezoneValue);
		}
	}, [timezoneValue]);
	const handleChange = ((newValue) => {
		if (!newValue) return;
		// Only set the value change if the date is valid and different from current.
		if (newValue.isValid() && newValue.toISOString() !== moment(effectRefs.current.dateProp).toISOString()) {
			effectRefs.current.onChange?.(createTransposedToTimezoneDate(newValue, selectedTimezone));
			setSelectedDate(newValue);
		}
	}) as DateTimePickerProps['onChange'];
	const handleTimezoneChange = ((event, value) => {
		event.preventDefault();
		event.stopPropagation();
		setSelectedTimezone(value);
		onTimezoneChange?.(value);
	}) as AutocompleteProps<string, false, true, boolean>['onChange'];
	useEffect(() => {
		if (!dateProp) {
			mountedRef.current = true;
			// Date is nullish; clear the field.
			setSelectedDate(null);
		} else if (autoUpdatePastDate && disablePast && new Date(dateProp) < new Date()) {
			mountedRef.current = true;
			const future = createAtLeastHalfHourInFutureDate();
			setSelectedDate(moment(future));
			effectRefs.current.onChange?.(future);
		} else if (mountedRef.current) {
			const { selectedTimezone, controlTimezone, selectedDate } = effectRefs.current;
			if (selectedDate && moment(dateProp).toISOString() === selectedDate.toISOString()) {
				// Skip if dateProp is the same as the selected date.
				return;
			}
			// Not the first render; dateProp changed, update the date.
			let nextDate: Moment;
			if (selectedTimezone !== controlTimezone) {
				// The date prop converted to a date is always in the user's browser locale. If the selected timezone (offset) is different from the
				// user's timezone, we need to convert the date to the selected timezone to keep the internal and external date in sync.
				const dateMoment = moment(dateProp).tz(selectedTimezone);
				nextDate = dateMoment;
				setControlTimezone(selectedTimezone);
			} else {
				nextDate = dateProp ? moment(dateProp) : null;
			}
			setSelectedDate(nextDate);
		} else {
			// First render; set the initial date.
			mountedRef.current = true;
			setSelectedDate(dateProp ? moment(dateProp) : null);
		}
	}, [disablePast, dateProp, effectRefs]);
	useEffect(() => {
		const { selectedDate } = effectRefs.current;
		if (mountedRef.current && selectedDate) {
			const date = createTransposedToTimezoneDate(selectedDate, selectedTimezone);
			if (date.toISOString() !== moment(effectRefs.current.dateProp).toISOString()) {
				effectRefs.current.onChange?.(date);
			}
		}
	}, [effectRefs, selectedTimezone]);
	const Picker =
		pickers.includes('date') && pickers.includes('time')
			? DateTimePicker
			: pickers.includes('date')
				? DatePicker
				: TimePicker;
	const pickerProps = pickers.includes('time') ? { ampm: hour12 } : {};
	return (
		<FormControl id={id} fullWidth>
			<LocalizationProvider dateAdapter={AdapterMoment} adapterLocale={localeCode}>
				<Box sx={{ display: 'flex', flexDirection: 'column', ...sxs?.root }}>
					<Picker
						sx={{ mt: 1, ...sxs?.dateTimePicker }}
						value={selectedDate}
						onChange={handleChange}
						disablePast={disablePast}
						disabled={disabled}
						autoFocus={autoFocus}
						onError={onError}
						slotProps={{ textField: { size } }}
						// Not using the timezone prop since it would cause the date to get adjusted to that timezone.
						// The idea of this control is to keep the date/time value stable as you pick timezones and only
						// reflect the actual value change externally; but for the user, the date doesn't move around if
						// he/she did not manually change it.
						// timezone={selectedTimezone}
						timezone={controlTimezone}
						{...pickerProps}
					/>
					<Autocomplete
						options={timeZones}
						disabled={disabled || disableTimezoneSelection}
						getOptionLabel={(timezone) =>
							timezone + (selectedDate ? ` (GMT${getZDateOffset(selectedDate, timezone)})` : '')
						}
						value={selectedTimezone}
						onChange={handleTimezoneChange}
						popupIcon={<PublicRoundedIcon />}
						disableClearable={true}
						renderInput={(params) => <TextField {...params} size={size} variant="outlined" fullWidth />}
						sx={{ my: 1, ...sxs?.timezoneAutocomplete }}
					/>
				</Box>
			</LocalizationProvider>
		</FormControl>
	);
}

export default DateTimeTimezonePicker;
