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
import type { AllowListEntry } from '../allow-list';
import { CapturedScan, captureMode, latestScans, pruneEntries } from '../capture';

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

test.describe('capture mode', () => {
	test('1 and any other value capture, prune prunes, unset or empty is a normal run', () => {
		expect(captureMode('1')).toBe('capture');
		expect(captureMode('true')).toBe('capture');
		expect(captureMode('prune')).toBe('prune');
		expect(captureMode(' PRUNE ')).toBe('prune');
		expect(captureMode('')).toBeNull();
		expect(captureMode(undefined)).toBeNull();
	});
});

test.describe('prune-only capture', () => {
	const entry = (rule: string, screen: string, nodes: string[], theme: 'light' | 'dark' = 'light'): AllowListEntry => ({
		rule,
		screen,
		theme,
		nodes
	});
	const found = (screen: string, nodes: Array<[string, string]>, unticketed: Array<[string, string]> = []) =>
		({
			screen,
			theme: 'light',
			nodes: nodes.map(([rule, fingerprint]) => ({ rule, fingerprint })),
			unticketed: unticketed.map(([rule, fingerprint]) => ({ rule, fingerprint }))
		}) as CapturedScan;
	const scans = (...list: CapturedScan[]) => latestScans(list);

	test('removes the nodes that no longer fail, keeps the ones that do and adds nothing', () => {
		const entries = [entry('listitem', 'preview', ['a <li>', 'b <li>', 'c <li>'])];
		const run = scans(
			found('preview', [
				['listitem', 'a <li>'],
				['listitem', 'c <li>'],
				['listitem', 'new <li>']
			])
		);
		const { entries: kept, removed } = pruneEntries(entries, run);
		expect(kept).toEqual([entry('listitem', 'preview', ['a <li>', 'c <li>'])]);
		expect(removed).toEqual([{ rule: 'listitem', screen: 'preview', theme: 'light', nodes: ['b <li>'] }]);
	});

	test('drops an entry whose nodes are all fixed', () => {
		const { entries, removed } = pruneEntries([entry('list', 'dashboard', ['x <ul>'])], scans(found('dashboard', [])));
		expect(entries).toEqual([]);
		expect(removed).toHaveLength(1);
	});

	test('keeps entries for screens or themes the run did not scan, and does not touch other rules', () => {
		const entries = [
			entry('list', 'dashboard', ['x <ul>']),
			entry('list', 'dashboard', ['x <ul>'], 'dark'),
			entry('list', 'users', ['y <ul>']),
			entry('label', 'users', ['z <input>'])
		];
		const run = scans(found('users', [['label', 'z <input>']]));
		const { entries: kept, removed } = pruneEntries(entries, run);
		expect(kept).toEqual([entries[0], entries[1], entries[3]]);
		expect(removed.map(({ rule, screen }) => `${rule} ${screen}`)).toEqual(['list users']);
	});

	test('a duplicate fingerprint is matched once per failing node', () => {
		const entries = [entry('listitem', 'preview', ['a <li>', 'a <li>'])];
		const { entries: kept, removed } = pruneEntries(entries, scans(found('preview', [['listitem', 'a <li>']])));
		expect(kept).toEqual([entry('listitem', 'preview', ['a <li>'])]);
		expect(removed[0].nodes).toEqual(['a <li>']);
	});

	test('a node that still fails outside its ticket scope is not pruned', () => {
		const entries = [entry('listitem', 'preview', ['a <li>'])];
		const run = scans(found('preview', [], [['listitem', 'a <li>']]));
		expect(pruneEntries(entries, run).entries).toEqual(entries);
	});

	test('with nothing fixed the allow-list is unchanged', () => {
		const entries = [entry('listitem', 'preview', ['a <li>'])];
		const { entries: kept, removed } = pruneEntries(entries, scans(found('preview', [['listitem', 'a <li>']])));
		expect(kept).toEqual(entries);
		expect(removed).toEqual([]);
	});
});
