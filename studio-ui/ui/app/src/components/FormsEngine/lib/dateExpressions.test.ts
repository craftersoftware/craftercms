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
 * Date and time populate expressions. `dateExpressions.ts` is pure (no React, no other FE2 modules), so it is imported
 * directly and the clock is pinned with `mock.timers`.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { fileURLToPath } from 'node:url';
import '../../../../test/registerTsLoader.mjs';

const dateExpressions = await import('./dateExpressions.ts');
const { processPopulateExpression, validateDatePopulateExpression, validateTimePopulateExpression } = dateExpressions;

// Wednesday, 4 Nov 2026 10:30:15.250 local time. Every assertion below builds its expected value in local time too.
const NOW = new Date(2026, 10, 4, 10, 30, 15, 250);

const local = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0, ms = 0) => new Date(y, mo - 1, d, h, mi, s, ms);

describe('dateExpressions module', () => {
	it('stays pure: it has no imports of any kind', () => {
		const source = readFileSync(fileURLToPath(new URL('./dateExpressions.ts', import.meta.url)), 'utf8');
		assert.doesNotMatch(source, /^\s*import[\s{*'"]/m);
		assert.doesNotMatch(source, /\brequire\s*\(|\bimport\s*\(/);
	});

	it('exports exactly the three expression functions', () => {
		assert.deepEqual(Object.keys(dateExpressions).sort(), [
			'processPopulateExpression',
			'validateDatePopulateExpression',
			'validateTimePopulateExpression'
		]);
	});
});

describe('validateTimePopulateExpression', () => {
	it('accepts now, with or without an hours or minutes offset', () => {
		for (const expr of ['now', 'NOW', 'now+2hours', 'now-30minutes', '+1hours', '-15minutes', ' now + 2 Hours ']) {
			assert.equal(validateTimePopulateExpression(expr), true, expr);
		}
	});

	it('rejects empty values, abbreviated or date units and anything else', () => {
		for (const expr of ['', 'now+2h', 'now+5m', 'now+2days', 'now+1weeks', '2hours', 'now+hours', 'monday', '09:00']) {
			assert.equal(validateTimePopulateExpression(expr), false, expr);
		}
		assert.equal(validateTimePopulateExpression(undefined as unknown as string), false);
		assert.equal(validateTimePopulateExpression(null as unknown as string), false);
	});
});

describe('validateDatePopulateExpression', () => {
	it('accepts now and now with an offset in every unit', () => {
		for (const expr of [
			'now',
			'NOW',
			'now+2d',
			'now-3weeks',
			'now+1years',
			'now-4hours',
			'now+30minutes',
			'+2d',
			'-1y',
			'+5h',
			'now+10m',
			' now + 2 days '
		]) {
			assert.equal(validateDatePopulateExpression(expr), true, expr);
		}
	});

	it('accepts day-of-week names, full or abbreviated, in any case', () => {
		for (const expr of ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']) {
			assert.equal(validateDatePopulateExpression(expr), true, expr);
			assert.equal(validateDatePopulateExpression(expr.toUpperCase()), true, expr.toUpperCase());
			assert.equal(validateDatePopulateExpression(expr.slice(0, 3)), true, expr.slice(0, 3));
		}
	});

	it('accepts {macro} forms with an optional static time', () => {
		for (const expr of [
			'{now}',
			'{friday}',
			'{now+2days}',
			'{ now + 2 days }',
			'{friday} 09:00',
			'{friday} 9:00',
			'{friday} 23:59:59',
			'{now+2days} 09:30:15',
			'{now} 00:00'
		]) {
			assert.equal(validateDatePopulateExpression(expr), true, expr);
		}
	});

	it('rejects empty values, unknown names and malformed offsets', () => {
		for (const expr of ['', '   ', 'tomorrow', 'noww', 'now+d', 'now+2', 'now+2x', 'now*2d', 'someday']) {
			assert.equal(validateDatePopulateExpression(expr), false, expr);
		}
		assert.equal(validateDatePopulateExpression(undefined as unknown as string), false);
		assert.equal(validateDatePopulateExpression(null as unknown as string), false);
	});

	it('rejects a static time outside the {macro} form or with an out of range value', () => {
		for (const expr of [
			'monday 09:00',
			'now+2d 09:00',
			'{friday} 24:00',
			'{friday} 25:00',
			'{friday} 09:60',
			'{friday} 09:00:60',
			'{friday} 9',
			'{friday}09:00',
			'{bogus}',
			'{bogus} 09:00',
			'{}'
		]) {
			assert.equal(validateDatePopulateExpression(expr), false, expr);
		}
	});
});

describe('processPopulateExpression', () => {
	beforeEach(() => {
		mock.timers.enable({ apis: ['Date'], now: NOW });
	});

	afterEach(() => {
		mock.timers.reset();
	});

	const run = (
		expression: string,
		allowPastDate?: boolean,
		validatePopulateExpression = validateDatePopulateExpression
	) => processPopulateExpression({ expression, validatePopulateExpression, allowPastDate });

	describe('now', () => {
		it('sets the seconds to :59 on the current minute by default', () => {
			assert.equal(run('now').getTime(), local(2026, 11, 4, 10, 30, 59).getTime());
			assert.equal(run('{now}').getTime(), local(2026, 11, 4, 10, 30, 59).getTime());
		});

		it('returns the current instant when past dates are allowed', () => {
			assert.equal(run('now', true).getTime(), NOW.getTime());
		});

		it('returns a new Date on every call', () => {
			assert.notEqual(run('now'), run('now'));
		});
	});

	describe('offsets', () => {
		it('adds and subtracts days, weeks and years, in short and long units', () => {
			assert.equal(run('now+2d').getTime(), local(2026, 11, 6, 10, 30, 15, 250).getTime());
			assert.equal(run('now+2days').getTime(), local(2026, 11, 6, 10, 30, 15, 250).getTime());
			assert.equal(run('+1w').getTime(), local(2026, 11, 11, 10, 30, 15, 250).getTime());
			assert.equal(run('now-1weeks').getTime(), local(2026, 10, 28, 10, 30, 15, 250).getTime());
			assert.equal(run('now+1y').getTime(), local(2027, 11, 4, 10, 30, 15, 250).getTime());
			assert.equal(run('now-2years').getTime(), local(2024, 11, 4, 10, 30, 15, 250).getTime());
		});

		it('carries days across month and year boundaries', () => {
			assert.equal(run('now+30d').getTime(), local(2026, 12, 4, 10, 30, 15, 250).getTime());
			assert.equal(run('now+60d').getTime(), local(2027, 1, 3, 10, 30, 15, 250).getTime());
		});

		it('adds and subtracts hours and minutes', () => {
			assert.equal(run('now+3hours').getTime(), NOW.getTime() + 3 * 3600000);
			assert.equal(run('now-5h').getTime(), NOW.getTime() - 5 * 3600000);
			assert.equal(run('now+90minutes').getTime(), NOW.getTime() + 90 * 60000);
			assert.equal(run('-10m').getTime(), NOW.getTime() - 10 * 60000);
		});

		it('ignores whitespace and case', () => {
			assert.equal(run(' NOW + 2 Days ').getTime(), local(2026, 11, 6, 10, 30, 15, 250).getTime());
		});

		it('does not clamp offsets that land in the past', () => {
			assert.equal(run('now-5days').getTime(), local(2026, 10, 30, 10, 30, 15, 250).getTime());
			assert.equal(run('now-5days', true).getTime(), local(2026, 10, 30, 10, 30, 15, 250).getTime());
		});

		it('evaluates a braced offset', () => {
			assert.equal(run('{now+2days}').getTime(), local(2026, 11, 6, 10, 30, 15, 250).getTime());
		});
	});

	describe('day of week', () => {
		it('resolves to the next occurrence, keeping the time of day', () => {
			assert.equal(run('thursday').getTime(), local(2026, 11, 5, 10, 30, 15, 250).getTime());
			assert.equal(run('friday').getTime(), local(2026, 11, 6, 10, 30, 15, 250).getTime());
			assert.equal(run('sunday').getTime(), local(2026, 11, 8, 10, 30, 15, 250).getTime());
			assert.equal(run('monday').getTime(), local(2026, 11, 9, 10, 30, 15, 250).getTime());
		});

		it("resolves today's day of week to the same day next week", () => {
			assert.equal(run('wednesday').getTime(), local(2026, 11, 11, 10, 30, 15, 250).getTime());
			assert.equal(run('wed').getTime(), local(2026, 11, 11, 10, 30, 15, 250).getTime());
		});

		it('resolves every abbreviation to the next occurrence of its weekday', () => {
			const expected = { sun: 8, mon: 9, tue: 10, wed: 11, thu: 5, fri: 6, sat: 7 };
			for (const [abbreviation, day] of Object.entries(expected)) {
				assert.equal(run(abbreviation).getTime(), local(2026, 11, day, 10, 30, 15, 250).getTime(), abbreviation);
			}
		});

		it('accepts abbreviations in any case and the braced form', () => {
			assert.equal(run('FRI').getTime(), local(2026, 11, 6, 10, 30, 15, 250).getTime());
			assert.equal(run('{sat}').getTime(), local(2026, 11, 7, 10, 30, 15, 250).getTime());
			assert.equal(run('{Thu}').getTime(), local(2026, 11, 5, 10, 30, 15, 250).getTime());
		});

		it('crosses the month boundary', () => {
			mock.timers.reset();
			mock.timers.enable({ apis: ['Date'], now: local(2026, 11, 30, 8, 0, 0) });
			assert.equal(run('tuesday').getTime(), local(2026, 12, 1, 8, 0, 0).getTime());
		});
	});

	describe('static time', () => {
		it('replaces the time of day on a {macro} with HH:mm or HH:mm:ss', () => {
			assert.equal(run('{friday} 09:00').getTime(), local(2026, 11, 6, 9, 0, 0).getTime());
			assert.equal(run('{friday} 9:05').getTime(), local(2026, 11, 6, 9, 5, 0).getTime());
			assert.equal(run('{friday} 23:59:58').getTime(), local(2026, 11, 6, 23, 59, 58).getTime());
			assert.equal(run('{now+2days} 09:30:15').getTime(), local(2026, 11, 6, 9, 30, 15).getTime());
		});

		it('applies a future time on the same day', () => {
			assert.equal(run('{now} 18:45').getTime(), local(2026, 11, 4, 18, 45, 0).getTime());
		});

		it('falls back to the current minute at :59 when the time is already past', () => {
			assert.equal(run('{now} 00:00').getTime(), local(2026, 11, 4, 10, 30, 59).getTime());
			assert.equal(run('{now-1days} 12:00').getTime(), local(2026, 11, 4, 10, 30, 59).getTime());
		});

		it('keeps a past time when past dates are allowed', () => {
			assert.equal(run('{now} 00:00', true).getTime(), local(2026, 11, 4, 0, 0, 0).getTime());
			assert.equal(run('{now-1days} 12:00', true).getTime(), local(2026, 11, 3, 12, 0, 0).getTime());
		});
	});

	describe('invalid expressions', () => {
		it('fall back to the current minute at :59', () => {
			for (const expression of ['', 'tomorrow', 'monday 09:00', '{friday} 25:00', undefined as unknown as string]) {
				assert.equal(run(expression).getTime(), local(2026, 11, 4, 10, 30, 59).getTime(), String(expression));
			}
		});

		it('fall back to the current instant when past dates are allowed', () => {
			assert.equal(run('tomorrow', true).getTime(), NOW.getTime());
		});
	});

	describe('time expressions', () => {
		const runTime = (expression: string, allowPastDate?: boolean) =>
			run(expression, allowPastDate, validateTimePopulateExpression);

		it('evaluates now and hour/minute offsets with the time validator', () => {
			assert.equal(runTime('now').getTime(), local(2026, 11, 4, 10, 30, 59).getTime());
			assert.equal(runTime('now', true).getTime(), NOW.getTime());
			assert.equal(runTime('now+2hours').getTime(), NOW.getTime() + 2 * 3600000);
			assert.equal(runTime('-30minutes').getTime(), NOW.getTime() - 30 * 60000);
		});

		it('falls back for expressions only the date validator accepts', () => {
			assert.equal(runTime('now+2d').getTime(), local(2026, 11, 4, 10, 30, 59).getTime());
			assert.equal(runTime('friday', true).getTime(), NOW.getTime());
		});
	});

	describe('custom validator', () => {
		it('is consulted for the whole expression and for the macro', () => {
			const seen: string[] = [];
			const result = run('{now+1d} 09:00', true, (expr) => {
				seen.push(expr);
				return true;
			});
			assert.deepEqual(seen, ['{now+1d} 09:00', 'now+1d']);
			assert.equal(result.getTime(), local(2026, 11, 5, 9, 0, 0).getTime());
		});

		it('rejects everything when it returns false', () => {
			assert.equal(run('now+2d', true, () => false).getTime(), NOW.getTime());
		});
	});
});
