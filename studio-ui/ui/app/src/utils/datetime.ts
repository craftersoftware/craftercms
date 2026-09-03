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

import moment, { Moment } from 'moment-timezone';
import { defineMessages } from 'react-intl';
import { getCurrentIntl } from './i18n';
import GlobalState from '../models/GlobalState';

const translations = defineMessages({
	ordinals: {
		id: 'dateTime.ordinals',
		defaultMessage: '{day, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}'
	}
});

export interface TimezoneDescriptor {
	name: string;
	offset: string;
}

export const getTimezones = ((zoneNames) => {
	let timeZones: TimezoneDescriptor[] = [];
	zoneNames.forEach((name, i) => {
		timeZones.push({
			name,
			offset: `${moment.tz(zoneNames[i]).format('Z')}`
		});
	});
	const sorted = timeZones.sort((a, b) => (parseInt(a.offset) > parseInt(b.offset) ? 1 : -1));
	return () => sorted;
})(moment.tz.names());

export function asDayMonthDateTime(date: string): string {
	const parts = getCurrentIntl().formatDateToParts(date, {
		month: 'long',
		day: 'numeric',
		weekday: 'long',
		year: 'numeric'
	});
	return `${parts[0].value} ${parts[2].value} ${getCurrentIntl().formatMessage(translations.ordinals, {
		day: parts[4].value
	})} ${parts[6].value} @ ${getCurrentIntl().formatTime(date)}`;
}

export function asLocalizedDateTime(
	date: string | number | Date,
	localeCode: string,
	dateTimeFormatOptions?: GlobalState['uiConfig']['locale']['dateTimeFormatOptions']
): string {
	return new Intl.DateTimeFormat(localeCode, dateTimeFormatOptions).format(new Date(date));
}

export function getUserTimeZone(): string {
	return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function getUserLocaleCode(): string {
	return Intl.DateTimeFormat().resolvedOptions().locale;
}

/**
 * Create ISO 8601 string
 **/
export const create8601String = (date: string, time: string, offset: string) => `${date}T${time}${offset}`;

/**
 * Returns an array as ['yyyy-mm-dd', 'hh:mm:ss', '+/-nn:nn'] out of a ISO 8601 date string
 **/
export const get8601Pieces = (date: string | Date | number | Moment) => {
	const format = moment(date).format();
	// Trying to match either:
	//  - 2024-10-31T10:30:00+01:00
	//  - 2024-10-31T09:30:00Z
	const pieces = format.match(/(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(.{6}|.)/);
	return [pieces[1], pieces[2], pieces[3]];
};

export function isSameDay(date1: Date, date2: Date) {
	return (
		date1.getFullYear() === date2.getFullYear() &&
		date1.getMonth() === date2.getMonth() &&
		date1.getDate() === date2.getDate()
	);
}

/**
 * Returns the Z offset (e.g. +01:00) from the offset number that represents the difference,
 * in minutes, between this date as evaluated in the UTC time zone, and the same date as evaluated
 * in the local time zone
 **/
export function getFormattedGmtOffsetFromTimezoneOffset(timezoneOffset: number): string {
	const offsetHours = Math.floor(Math.abs(timezoneOffset) / 60);
	const offsetMinutes = Math.abs(timezoneOffset) % 60;
	const sign = timezoneOffset <= 0 ? '+' : '-';
	return `${sign}${String(offsetHours).padStart(2, '0')}:${String(offsetMinutes).padStart(2, '0')}`; // e.g., "+02:00"
}

/**
 * Returns true if the date object is a valid date, false otherwise
 **/
export function isValidDate(date: Date): boolean {
	return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Returns the Z offset (e.g. +01:00) of a timezone name, considering daylight savings of the date.
 **/
export function getZDateOffset(date: Date | Moment, timezone: string): string {
	return timezone ? moment(date).clone().tz(timezone).format('Z') : '';
}

/**
 * Creates a Date object that's the same moment in time as the original date but expressed in the target timezone
 **/
export function createTransposedToTimezoneDate(date: Date | Moment, targetTimezone: string): Date {
	const pieces = get8601Pieces(date);
	const targetOffset = getZDateOffset(date, targetTimezone);
	const dateString = create8601String(pieces[0], pieces[1], targetOffset);
	return new Date(dateString);
}

/**
 * Creates a date that's at least half hour from now.
 **/
export function createAtLeastHalfHourInFutureDate(): Date {
	const reference = new Date();
	const date = new Date();
	date.setHours(date.getHours() + 1);
	date.setMinutes(0, 0, 0);
	const diffMs = date.getTime() - reference.getTime();
	if (diffMs < 1800000) {
		date.setMinutes(date.getMinutes() + 30);
	}
	return date;
}

/**
 * Convert a time string from UTC to a custom timezone.
 * @param utcTime {string} The time string in HH:MM:SS format.
 * @param targetTimezone {string} The target timezone.
 * @returns {string} The time string in the target timezone.
 */
export function convertUtcTimeToTimezone(utcTime: string, targetTimezone: string = getUserTimeZone()): string {
	// Parse the time string in UTC
	const timeInUTC = moment.utc(utcTime, 'HH:mm:ss');

	// Convert the time to the desired timezone
	const timeInTargetZone = timeInUTC.tz(targetTimezone);

	// Format the time in the desired timezone
	return timeInTargetZone.format('HH:mm:ss');
}
