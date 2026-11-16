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
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AllowListEntry, Theme } from '../allow-list';
import { coverageGaps, coverageKey, declaredTests, describeGap, readRecords, rootScreen } from '../coverage';

const entry = (screen: string, theme: Theme, rule = 'listitem'): AllowListEntry => ({
	rule,
	screen,
	theme,
	nodes: ['li']
});

const keys = (theme: Theme, ...names: string[]) => new Set(names.map((name) => coverageKey(theme, name)));
const union = (...sets: Set<string>[]) => new Set(sets.flatMap((set) => [...set]));

const dashboardLight = entry('dashboard', 'light', 'list');
const dashboardDark = entry('dashboard', 'dark', 'list');
const panelPage = entry('edit mode tools panel > Search', 'light');

test.describe('allow-list coverage', () => {
	test('the root of a screen is its test title, with or without a page or dialog', () => {
		expect(rootScreen('dashboard')).toBe('dashboard');
		expect(rootScreen('edit mode tools panel > Page Explorer')).toBe('edit mode tools panel');
	});

	test('an empty allow-list has no gaps', () => {
		expect(coverageGaps([], new Set(), new Set(), new Set())).toEqual({ gaps: [], skipped: [] });
	});

	test('an entry whose screen was scanned in its theme is covered', () => {
		const scanned = union(keys('light', 'dashboard', 'edit mode tools panel > Search'), keys('dark', 'dashboard'));
		const ran = union(keys('light', 'dashboard', 'edit mode tools panel'), keys('dark', 'dashboard'));
		const declared = ran;
		expect(coverageGaps([dashboardLight, dashboardDark, panelPage], scanned, ran, declared)).toEqual({
			gaps: [],
			skipped: []
		});
	});

	test('a renamed root test leaves its entries unscanned even though no test matches them', () => {
		const { gaps } = coverageGaps(
			[dashboardLight, dashboardDark],
			keys('light', 'home'),
			keys('light', 'home'),
			union(keys('light', 'home'), keys('dark', 'home'))
		);
		expect(gaps).toEqual([
			{ entry: dashboardLight, reason: 'test-missing' },
			{ entry: dashboardDark, reason: 'test-missing' }
		]);
	});

	test('a removed root test is reported on a run filtered to another screen', () => {
		const { gaps, skipped } = coverageGaps(
			[dashboardLight],
			keys('light', 'users'),
			keys('light', 'users'),
			keys('light', 'users', 'search')
		);
		expect(gaps).toEqual([{ entry: dashboardLight, reason: 'test-missing' }]);
		expect(skipped).toEqual([]);
	});

	test('a test that ran without scanning the entry leaves it unscanned', () => {
		const ran = keys('light', 'dashboard', 'edit mode tools panel');
		const scanned = keys('light', 'edit mode tools panel');
		expect(coverageGaps([dashboardLight, panelPage], scanned, ran, ran).gaps).toEqual([
			{ entry: dashboardLight, reason: 'not-scanned' },
			{ entry: panelPage, reason: 'not-scanned' }
		]);
	});

	test('entries of tests that were filtered out are skipped, not failed', () => {
		const declared = union(keys('light', 'dashboard', 'users'), keys('dark', 'dashboard', 'users'));
		// `--grep users`: the dashboard exists in both themes but did not run.
		expect(
			coverageGaps([dashboardLight, dashboardDark], keys('light', 'users'), keys('light', 'users'), declared)
		).toEqual({
			gaps: [],
			skipped: [dashboardLight, dashboardDark]
		});
	});

	test('a single theme run only judges that theme', () => {
		const declared = union(keys('light', 'dashboard'), keys('dark', 'dashboard'));
		const { gaps, skipped } = coverageGaps(
			[dashboardLight, dashboardDark],
			keys('light', 'dashboard'),
			keys('light', 'dashboard'),
			declared
		);
		expect(gaps).toEqual([]);
		expect(skipped).toEqual([dashboardDark]);
	});

	test('a root test declared in one theme only is missing in the other', () => {
		const { gaps } = coverageGaps([dashboardLight, dashboardDark], new Set(), new Set(), keys('light', 'dashboard'));
		expect(gaps).toEqual([{ entry: dashboardDark, reason: 'test-missing' }]);
	});

	test('without the declared tests, only tests that ran are judged', () => {
		const { gaps, skipped } = coverageGaps(
			[dashboardLight, dashboardDark],
			new Set(),
			keys('light', 'dashboard'),
			null
		);
		expect(gaps).toEqual([{ entry: dashboardLight, reason: 'not-scanned' }]);
		expect(skipped).toEqual([dashboardDark]);
	});

	test('a gap names the rule, theme, screen and reason', () => {
		expect(describeGap({ entry: dashboardLight, reason: 'test-missing' })).toBe(
			'  list on light dashboard: no test titled "dashboard" exists in the suite'
		);
		expect(describeGap({ entry: panelPage, reason: 'not-scanned' })).toBe(
			'  listitem on light edit mode tools panel > Search: its test ran but never scanned it'
		);
	});

	test('the declared tests come from the nested suites of a --list JSON, for the themes only', () => {
		const spec = (title: string, ...projectNames: string[]) => ({
			title,
			tests: projectNames.map((projectName) => ({ projectName }))
		});
		const listing = {
			suites: [
				{
					specs: [],
					suites: [
						{ specs: [spec('login', 'light', 'dark')], suites: [] },
						{ specs: [spec('dashboard', 'dark')], suites: [{ specs: [spec('nested', 'light')] }] },
						{ specs: [spec('readiness', 'unit')] }
					]
				}
			]
		};
		expect(declaredTests(listing)).toEqual(
			keys('light', 'login', 'nested').add(coverageKey('dark', 'login')).add(coverageKey('dark', 'dashboard'))
		);
	});

	test('records are read from every attempt directory and ignore other files', () => {
		const dir = mkdtempSync(join(tmpdir(), 'a11y-coverage-'));
		try {
			['users-light', 'users-light-retry1', 'users-dark'].forEach((attempt) => mkdirSync(join(dir, attempt)));
			writeFileSync(join(dir, 'users-light', 'a11y-scan-users.json'), JSON.stringify({ theme: 'light', screen: 'a' }));
			writeFileSync(
				join(dir, 'users-light-retry1', 'a11y-scan-users.json'),
				JSON.stringify({ theme: 'light', screen: 'b' })
			);
			writeFileSync(join(dir, 'users-dark', 'a11y-scan-users.json'), JSON.stringify({ theme: 'dark', screen: 'c' }));
			writeFileSync(join(dir, 'users-dark', 'a11y-run-test.json'), JSON.stringify({ theme: 'dark', test: 'users' }));
			writeFileSync(join(dir, 'users-dark', 'trace.zip'), 'not json');
			expect(
				readRecords<{ screen: string }>(dir, 'a11y-scan-')
					.map((r) => r.screen)
					.sort()
			).toEqual(['a', 'b', 'c']);
			expect(readRecords(dir, 'a11y-run-')).toEqual([{ theme: 'dark', test: 'users' }]);
			expect(readRecords(join(dir, 'missing'), 'a11y-scan-')).toEqual([]);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
