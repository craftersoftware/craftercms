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

/**
 * Checks if the populate time expression is valid.
 *
 * @param expr {string} The populate time expression to validate.
 * @returns true if the expression is valid, false otherwise.
 */
export function validateTimePopulateExpression(expr: string): boolean {
	const trimmed = (expr ?? '').replace(/ /g, '').toLowerCase();
	if (trimmed === 'now') return true;
	return /^(now)?[+-]\d+(hours|minutes)$/i.test(trimmed);
}

/**
 * Checks if the populate date expression is valid.
 * @param expr {string} The populate date expression to validate.
 * @returns true if the expression is valid, false otherwise.
 *
 * Supports: now, now+/-N[days|weeks|years|hours|minutes], day-of-week names, and {macro} with optional HH:mm[:ss].
 * A static time suffix is only valid on the {macro} form (e.g. "{friday} 09:00"), not on plain expressions
 * (e.g. "monday 09:00" or "now+2d 09:00").
 */
export function validateDatePopulateExpression(expr: string): boolean {
	if (!expr) return false;
	const trimmed = expr.trim();
	const days = [
		'sunday',
		'monday',
		'tuesday',
		'wednesday',
		'thursday',
		'friday',
		'saturday',
		'sun',
		'mon',
		'tue',
		'wed',
		'thu',
		'fri',
		'sat'
	];

	// 1. Check for {macro} or {macro} time
	const macroMatch = trimmed.match(/^\{([^}]+)\}(?:\s+([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?))?$/i);
	if (macroMatch) {
		const macro = macroMatch[1].trim().toLowerCase();
		const staticTime = macroMatch[2] ? macroMatch[2].trim() : null;

		// Validate macro (day-of-week or now/now+/-N...)
		if (
			days.includes(macro) ||
			/^(now|((now)?[+-]\d+(d|days|w|weeks|y|years|h|hours|m|minutes)))$/i.test(macro.replace(/ /g, ''))
		) {
			// If static time is present, validate format HH:mm or HH:mm:ss
			if (staticTime) {
				if (/^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(staticTime)) {
					return true;
				} else {
					return false;
				}
			}
			return true;
		}
		return false;
	}

	const lowered = trimmed.toLowerCase();
	// 2. Day of week macro (plain)
	if (days.includes(lowered)) return true;

	// 3. now, now+2d, now-3weeks, now+1years, now-4hours, now+30minutes (plain)
	if (/^(now|((now)?[+-]\d+(d|days|w|weeks|y|years|h|hours|m|minutes)))$/i.test(lowered.replace(/ /g, ''))) return true;

	return false;
}

/**
 * Returns a new Date object representing the next occurrence of the specified day of the week after the given date.
 *
 * @param date - The reference date from which to calculate the next day of the week.
 * @param dayOfWeek - The target day of the week as a number (0 = Sunday, 1 = Monday, ..., 6 = Saturday).
 * @returns A new Date object set to the next occurrence of the specified day of the week.
 *
 */
function getNextDayOfWeek(date: Date, dayOfWeek: number): Date {
	const result = new Date(date);
	const current = result.getDay();
	let delta = dayOfWeek - current;
	if (delta <= 0) delta += 7;
	result.setDate(result.getDate() + delta);
	return result;
}

/**
 * Sets the time (hours, minutes, seconds) on a given Date object based on a time string.
 *
 * @param date - The Date object to modify.
 * @param timeStr - The time string in the format "HH:mm" or "HH:mm:ss".
 * @returns The modified Date object with the specified time set.
 *
 */
function setTimeOnDate(date: Date, timeStr: string) {
	const parts = timeStr.split(':').map(Number);
	if (parts.length >= 2) {
		date.setHours(parts[0], parts[1], parts[2] || 0, 0);
	}
	return date;
}

/**
 * Evaluates a populate date/time expression and returns the resulting Date.
 * If the expression is invalid, returns the current date.
 *
 * Supported forms include plain offsets ("now", "now+5days", "+2d"), day-of-week names ("monday"),
 * and braced macros with an optional static time ("{friday} 09:00", "{now+2days} 09:30:15").
 *
 * @param params {Object} - The parameters for processing the date expression.
 * @param params.expression {string} - The populate expression to evaluate.
 * @param params.validatePopulateExpression {Function} - Validates the expression; invalid expressions fall back to now.
 * @param [params.allowPastDate=false] {boolean} - When `false` (the default), avoids populating a datetime in the past:
 *   - Plain `now` sets seconds to :59 on the current minute.
 *   - `{macro} HH:mm[:ss]` applies the static time first; if the result is already in the past, falls back to
 *     the current time with seconds set to :59 (e.g. `{now} 00:00` does not stay at midnight for most of the day).
 *   - Other past-producing expressions (e.g. "now-5days") are not clamped here; the field control validates those.
 *   When `true`, the computed datetime is returned as-is, including past static-time results.
 *
 * @returns {Date} The calculated date based on the expression.
 */

export function processPopulateExpression({
	expression,
	validatePopulateExpression,
	allowPastDate = false
}: {
	expression: string;
	validatePopulateExpression(expr: string): boolean;
	allowPastDate?: boolean;
}): Date {
	const trimmed = expression?.trim() ?? '';
	const macroMatch = trimmed.match(/^\{([^}]+)\}(?:\s+([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?))?$/i);
	const macro = (macroMatch ? macroMatch[1] : trimmed).trim();
	const staticTime = macroMatch?.[2]?.trim() ?? null;

	if (!validatePopulateExpression(trimmed)) {
		const fallback = new Date();
		if (!allowPastDate) fallback.setSeconds(59, 0);
		return fallback;
	}

	let date = new Date();

	// Day-of-week mapping
	const dayOfWeekMap: Record<string, number> = {
		sunday: 0,
		sun: 0,
		monday: 1,
		mon: 1,
		tuesday: 2,
		tue: 2,
		wednesday: 3,
		wed: 3,
		thursday: 4,
		thu: 4,
		friday: 5,
		fri: 5,
		saturday: 6,
		sat: 6
	};
	const macroLower = macro.toLowerCase();
	if (macroLower in dayOfWeekMap) {
		date = getNextDayOfWeek(date, dayOfWeekMap[macroLower]);
	} else if (validatePopulateExpression(macro)) {
		const normalized = macro.replace(/ /g, '').toLowerCase();
		if (normalized === 'now') {
			if (!allowPastDate) date.setSeconds(59, 0);
		} else {
			const match = normalized.match(/^(?:now)?([+-])(\d+)(d|days|w|weeks|y|years|h|hours|m|minutes)$/);
			if (match) {
				const [, sign, value, unit] = match;
				const n = parseInt(value, 10) * (sign === '-' ? -1 : 1);
				switch (unit) {
					case 'y':
					case 'years':
						date.setFullYear(date.getFullYear() + n);
						break;
					case 'w':
					case 'weeks':
						date.setDate(date.getDate() + n * 7);
						break;
					case 'd':
					case 'days':
						date.setDate(date.getDate() + n);
						break;
					case 'h':
					case 'hours':
						date.setTime(date.getTime() + n * 3600000);
						break;
					case 'm':
					case 'minutes':
						date.setTime(date.getTime() + n * 60000);
						break;
				}
			}
		}
	}

	if (staticTime) {
		setTimeOnDate(date, staticTime);
		if (!allowPastDate && date.getTime() < Date.now()) {
			date = new Date();
			date.setSeconds(59, 0);
		}
	}
	return date;
}
