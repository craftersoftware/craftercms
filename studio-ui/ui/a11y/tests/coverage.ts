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

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AllowListEntry, Theme } from './allow-list';

/*
 * Suite-wide allow-list coverage.
 *
 * The per-test check (`unscannedEntries` in `axe.ts`) only sees entries whose screen matches the title of a test that
 * ran. An entry whose test was renamed or removed matches no test, so only a check across the whole run can catch it.
 * `coverage-teardown.ts` does that after the run, from the records below and the list of tests the suite declares.
 *
 * Partial runs (`--grep`, one project or theme, a subset of files, a shard, `--last-failed`, an early stop) must not
 * fail, and they are not detected by reading flags. Instead each entry is judged on what is known about its root test
 * (the first segment of its screen key, which is the title of the test that scans it):
 *
 *  - a scan reached the entry's screen in that theme: covered;
 *  - the root test ran in that theme but never scanned the screen: unscanned (the screen was renamed or its scan
 *    removed, or the test failed before reaching it);
 *  - the suite declares no root test with that title in that theme: unscanned, however the run was filtered, because
 *    no run of this suite can ever reach it;
 *  - the root test exists but did not run (filtered out): skipped, it is not this run's to judge.
 */

/** Written by `checkA11y` for every scan: `{ theme, screen }`. */
export const SCAN_RECORD_PREFIX = 'a11y-scan-';

/** Written by the `allowListCoverage` fixture when a test starts: `{ theme, test }`. */
export const RUN_RECORD_PREFIX = 'a11y-run-';

export interface ScanRecord {
	theme: Theme;
	screen: string;
}

export interface RunRecord {
	theme: Theme;
	test: string;
}

export type GapReason = 'test-missing' | 'not-scanned';

export interface CoverageGap {
	entry: AllowListEntry;
	reason: GapReason;
}

export const themes: Theme[] = ['light', 'dark'];

/** Key of a screen (or test title) in a theme, for the sets `coverageGaps` takes. */
export const coverageKey = (theme: Theme, name: string) => `${theme}\u0000${name}`;

/** The test that scans a screen: its own title, or the part before ` > ` for a page or dialog inside a panel. */
export const rootScreen = (screen: string) => screen.split(' > ')[0];

/**
 * Splits the allow-list into entries this run left unscanned and entries it had no basis to judge.
 * @param scanned Keys of the screens a scan reached in this run.
 * @param ran Keys of the tests that started in this run.
 * @param declared Keys of every test the suite declares, filtered or not, or `null` when that list is not available.
 *   Without it an entry whose root test did not run is skipped, since a filtered test can't be told from a removed one.
 */
export function coverageGaps(
	entries: AllowListEntry[],
	scanned: Set<string>,
	ran: Set<string>,
	declared: Set<string> | null
) {
	const gaps: CoverageGap[] = [];
	const skipped: AllowListEntry[] = [];
	entries.forEach((entry) => {
		const root = coverageKey(entry.theme, rootScreen(entry.screen));
		if (scanned.has(coverageKey(entry.theme, entry.screen))) return;
		if (ran.has(root)) gaps.push({ entry, reason: 'not-scanned' });
		else if (declared && !declared.has(root)) gaps.push({ entry, reason: 'test-missing' });
		else skipped.push(entry);
	});
	return { gaps, skipped };
}

export function describeGap({ entry: { rule, screen, theme }, reason }: CoverageGap) {
	const why =
		reason === 'test-missing'
			? `no test titled "${rootScreen(screen)}" exists in the suite`
			: `its test ran but never scanned it`;
	return `  ${rule} on ${theme} ${screen}: ${why}`;
}

/** Tests the suite declares per theme, from the JSON of `playwright test --list --reporter=json`. */
export function declaredTests(listing: {
	suites?: unknown[];
	specs?: { title: string; tests?: { projectName: string }[] }[];
}) {
	const declared = new Set<string>();
	const visit = (suite: typeof listing) => {
		suite.specs?.forEach(({ title, tests }) =>
			tests?.forEach(({ projectName }) => {
				if ((themes as string[]).includes(projectName)) declared.add(coverageKey(projectName as Theme, title));
			})
		);
		(suite.suites as (typeof listing)[] | undefined)?.forEach(visit);
	};
	visit(listing);
	return declared;
}

/** Reads every JSON record whose file name starts with `prefix` under `dir`, in path order. */
export function readRecords<T>(dir: string, prefix: string): T[] {
	if (!existsSync(dir)) return [];
	return (readdirSync(dir, { recursive: true }) as string[])
		.filter((file) => file.split(/[\\/]/).pop()!.startsWith(prefix))
		.sort()
		.map((file) => JSON.parse(readFileSync(join(dir, file), 'utf8')) as T);
}
