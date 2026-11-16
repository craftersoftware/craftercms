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

import type { FullConfig } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { allowList } from './allow-list';
import {
	coverageGaps,
	coverageKey,
	declaredTests,
	describeGap,
	readRecords,
	RUN_RECORD_PREFIX,
	RunRecord,
	SCAN_RECORD_PREFIX,
	ScanRecord
} from './coverage';

const artifacts = join(__dirname, '..', 'report', 'artifacts');

/**
 * Every test the suite declares, whatever this run filtered out, from a `--list` of the same config in a child process
 * (it runs no test and no global teardown). `null` if the listing can't be read: the check then judges only the tests
 * that ran.
 */
function listDeclaredTests(config: FullConfig) {
	if (!config.configFile) return null;
	const env = { ...process.env };
	delete env.PLAYWRIGHT_JSON_OUTPUT_NAME;
	delete env.PLAYWRIGHT_JSON_OUTPUT_FILE;
	const result = spawnSync(
		process.execPath,
		[require.resolve('@playwright/test/cli'), 'test', '--list', '--reporter=json', '--config', config.configFile],
		{ cwd: dirname(config.configFile), env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
	);
	try {
		if (result.status !== 0) throw new Error(result.stderr || `exit code ${result.status}`);
		return declaredTests(JSON.parse(result.stdout));
	} catch (error) {
		console.warn(
			`Allow-list coverage: could not list the suite's tests (${String(error).trim()}); entries for tests that did not run are skipped.`
		);
		return null;
	}
}

/**
 * After the run, fails on every allow-list entry (screen and theme) that no scan reached and that this run can judge:
 * its test ran without scanning it, or no test of that title exists any more (a renamed or removed root test, which the
 * per-test check in `fixtures.ts` can't see because no test matches it). Entries whose test was filtered out (`--grep`,
 * one project, some files...) are skipped, so partial runs don't fail. See `coverage.ts` for the rules.
 *
 * The check is off with `A11Y_CAPTURE=1`: capture rewrites the allow-list from the run and keeps the entries of screens
 * it did not reach (`capture-teardown.ts`), so a capture run is not a verification of the current allow-list.
 */
export default async function coverageTeardown(config: FullConfig) {
	if (process.env.A11Y_CAPTURE) {
		console.log('Allow-list coverage: skipped, A11Y_CAPTURE rewrites the allow-list from this run.');
		return;
	}
	if (!allowList.length) return;
	const scanned = new Set(
		readRecords<ScanRecord>(artifacts, SCAN_RECORD_PREFIX).map(({ theme, screen }) => coverageKey(theme, screen))
	);
	const ran = new Set(
		readRecords<RunRecord>(artifacts, RUN_RECORD_PREFIX).map(({ theme, test }) => coverageKey(theme, test))
	);
	const { gaps, skipped } = coverageGaps(allowList, scanned, ran, listDeclaredTests(config));
	if (skipped.length) {
		console.log(
			`Allow-list coverage: skipped ${skipped.length} of ${allowList.length} entries whose test did not run in this run.`
		);
	}
	if (gaps.length) {
		throw new Error(
			`Allow-list entries that no scan in this run reached (remove them, or restore the screen's test and scan):\n${gaps
				.map(describeGap)
				.join('\n')}`
		);
	}
	console.log(`Allow-list coverage: ${allowList.length - skipped.length} of ${allowList.length} entries checked.`);
}
