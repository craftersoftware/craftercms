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

import { expect, test, TestInfo } from '@playwright/test';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AllowListEntry } from '../allow-list';
import { SCAN_ANNOTATION, unscannedEntries, verifyTestRun } from '../axe';
import { RUN_RECORD_PREFIX } from '../coverage';

const entries: AllowListEntry[] = [
	{ rule: 'list', screen: 'dashboard', theme: 'light', nodes: ['ul'] },
	{ rule: 'list', screen: 'dashboard', theme: 'dark', nodes: ['ul'] }
];

let dir: string;
test.beforeEach(() => (dir = mkdtempSync(join(tmpdir(), 'a11y-test-run-'))));
test.afterEach(() => rmSync(dir, { recursive: true, force: true }));

/** The parts of `TestInfo` that `verifyTestRun` reads. */
function fakeTestInfo(status: TestInfo['status'], scanned: string[] = []) {
	return {
		title: 'dashboard',
		status,
		project: { name: 'light' },
		annotations: scanned.map((description) => ({ type: SCAN_ANNOTATION, description })),
		outputPath: (name: string) => join(dir, name)
	} as unknown as TestInfo;
}

const recordPath = () => join(dir, `${RUN_RECORD_PREFIX}test.json`);

test.describe('verifying a finished test', () => {
	test('a test that scanned its screens is recorded as run', () => {
		verifyTestRun(fakeTestInfo('passed', ['dashboard']), entries);
		expect(existsSync(recordPath())).toBe(true);
	});

	test('a test that ran without scanning an entry fails and is still recorded', () => {
		expect(() => verifyTestRun(fakeTestInfo('passed'), entries)).toThrow(/light dashboard/);
		expect(existsSync(recordPath())).toBe(true);
	});

	test('a failed test is checked like a passed one', () => {
		expect(() => verifyTestRun(fakeTestInfo('failed'), entries)).toThrow(/never scanned/);
	});

	test('a test that skipped itself is neither checked nor recorded', () => {
		expect(unscannedEntries(fakeTestInfo('skipped'), entries)).toHaveLength(1);
		expect(() => verifyTestRun(fakeTestInfo('skipped'), entries)).not.toThrow();
		expect(existsSync(recordPath())).toBe(false);
	});
});
