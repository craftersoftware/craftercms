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

import { expect, test } from '@playwright/test';
import { CapturedScan, latestScans } from '../capture';

const scan = (screen: string, retry: number | undefined, rule = 'list'): CapturedScan => ({
	screen,
	theme: 'light',
	...(retry !== undefined && { retry }),
	nodes: [{ rule, fingerprint: `${rule}-${retry}` } as CapturedScan['nodes'][number]],
	unticketed: []
});

test.describe('capture of retried scans', () => {
	test('the retry wins over the first attempt whatever order the files come in', () => {
		const first = scan('dashboard', 0);
		const retry = scan('dashboard', 1);
		expect(latestScans([first, retry]).get('light dashboard')).toBe(retry);
		expect(latestScans([retry, first]).get('light dashboard')).toBe(retry);
	});

	test('output directories sort a retry before its first attempt, so path order is not attempt order', () => {
		const paths = ['screens-dashboard-light-retry1/a11y-capture-x.json', 'screens-dashboard-light/a11y-capture-x.json'];
		expect([...paths].sort()).toEqual(paths);
		const byPath: Record<string, CapturedScan> = {
			[paths[0]]: scan('dashboard', 1),
			[paths[1]]: scan('dashboard', 0)
		};
		const sorted = [...paths].sort().map((path) => byPath[path]);
		expect(latestScans(sorted).get('light dashboard')?.retry).toBe(1);
	});

	test('the highest retry wins, compared as a number', () => {
		const scans = [scan('dashboard', 2), scan('dashboard', 10), scan('dashboard', 9)];
		expect(latestScans(scans).get('light dashboard')?.retry).toBe(10);
	});

	test('a record without a retry counts as the first attempt', () => {
		const retry = scan('dashboard', 1);
		expect(latestScans([retry, scan('dashboard', undefined)]).get('light dashboard')).toBe(retry);
	});

	test('screens and themes are kept apart', () => {
		const dark: CapturedScan = { ...scan('dashboard', 0), theme: 'dark' };
		const result = latestScans([scan('dashboard', 1), dark, scan('users', 0)]);
		expect([...result.keys()].sort()).toEqual(['dark dashboard', 'light dashboard', 'light users']);
	});
});
