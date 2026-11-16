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

import AxeBuilder from '@axe-core/playwright';
import { expect, Page, TestInfo } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import type { CapturedScan } from './capture';
import { AllowListEntry, allowList, inTicketScope, ruleTickets, Theme } from './allow-list';
import { RUN_RECORD_PREFIX, RunRecord, SCAN_RECORD_PREFIX, ScanRecord } from './coverage';
import { applyAllowList, blockingFindings, Finding, StaleNode } from './filter';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** Annotation type `checkA11y` records each scanned screen under, so unscanned allow-list entries can be reported. */
export const SCAN_ANNOTATION = 'a11y-scan';

/** With `A11Y_CAPTURE=1`, every scan also writes its in-scope findings for `capture-teardown.ts` to record. */
export const CAPTURE_FILE_PREFIX = 'a11y-capture-';

/** Records that a test ran, so the suite-wide coverage check can tell tests that ran from tests filtered out. */
export function recordTestRun(testInfo: TestInfo) {
	const record: RunRecord = { theme: testInfo.project.name as Theme, test: testInfo.title };
	writeFileSync(testInfo.outputPath(`${RUN_RECORD_PREFIX}test.json`), JSON.stringify(record));
}

function describeFinding({ rule, impact, help, fingerprint, html }: Finding) {
	const ticket = ruleTickets[rule]?.ticket ?? 'no ticket';
	return `[${impact}] ${rule} (${ticket}): ${help}\n  node: ${fingerprint}\n  html: ${html}`;
}

function describeStale({ rule, fingerprint }: StaleNode, screen: string, theme: Theme) {
	return `${rule} on ${theme} ${screen} (${ruleTickets[rule]?.ticket}): allowed node no longer fails\n  node: ${fingerprint}`;
}

/**
 * Scans the current page against WCAG 2.0/2.1 A and AA rules and fails the test on any serious or critical node the
 * allow-list does not name, and on any allow-listed node that no longer fails. Soft assertions report every panel and
 * dialog of a screen in a single run.
 * @param name Name of the screen (or of the panel/dialog within it) being scanned; also its allow-list screen key.
 */
export async function checkA11y(page: Page, testInfo: TestInfo, name: string) {
	const theme = testInfo.project.name as Theme;
	// The preview iframe hosts the project's site, not Studio UI.
	const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).exclude('#crafterCMSPreviewIframe').analyze();
	const findings = blockingFindings(results.violations);
	const { allowed, blocking, stale } = applyAllowList(findings, allowList, name, theme);
	testInfo.annotations.push({ type: SCAN_ANNOTATION, description: name });
	const scan: ScanRecord = { theme, screen: name };
	writeFileSync(
		testInfo.outputPath(`${SCAN_RECORD_PREFIX}${name.replace(/[^a-z0-9]+/gi, '-')}.json`),
		JSON.stringify(scan)
	);

	const label = `${theme} - ${name}`;
	await testInfo.attach(`axe ${label}.json`, {
		body: JSON.stringify({ ...results, filtered: { allowed, blocking, stale } }, null, 2),
		contentType: 'application/json'
	});
	if (allowed.length) {
		await testInfo.attach(`allow-listed ${label}.txt`, {
			body: allowed.map(describeFinding).join('\n'),
			contentType: 'text/plain'
		});
	}
	if (process.env.A11Y_CAPTURE) {
		const nodes = findings.filter((finding) => inTicketScope(finding.rule, name, theme));
		const slug = name.replace(/[^a-z0-9]+/gi, '-');
		writeFileSync(
			testInfo.outputPath(`${CAPTURE_FILE_PREFIX}${slug}.json`),
			JSON.stringify({
				screen: name,
				theme,
				retry: testInfo.retry,
				nodes,
				unticketed: findings.filter((f) => !nodes.includes(f))
			} satisfies CapturedScan)
		);
	}
	expect
		.soft(
			blocking.length,
			`${label}: findings the allow-list does not name\n${blocking.map(describeFinding).join('\n')}`
		)
		.toBe(0);
	expect
		.soft(
			stale.length,
			`${label}: stale allow-list nodes, remove or recapture them\n${stale.map((s) => describeStale(s, name, theme)).join('\n')}`
		)
		.toBe(0);
}

/**
 * Allow-list entries for this test's screens (its title, or `title > page`) in this theme that no scan reached. A
 * renamed or removed screen would otherwise leave its exception in place without ever being checked. A test that was
 * renamed or removed matches no entry here: `coverage-teardown.ts` covers that across the whole run.
 */
export function unscannedEntries(testInfo: TestInfo, entries: AllowListEntry[] = allowList) {
	const theme = testInfo.project.name as Theme;
	const root = testInfo.title;
	const scanned = new Set(testInfo.annotations.filter((a) => a.type === SCAN_ANNOTATION).map((a) => a.description));
	return entries.filter(
		(entry) =>
			entry.theme === theme &&
			(entry.screen === root || entry.screen.startsWith(`${root} > `)) &&
			!scanned.has(entry.screen)
	);
}

/**
 * Runs after a test: records that it ran and fails it on allow-list entries for its screens that no scan reached. A test
 * that skipped itself (`test.skip()` or `test.fixme()` in its body) is neither recorded nor checked: it scanned nothing,
 * so its entries are not this run's to judge, the same as for a filtered-out test (`coverage-teardown.ts`).
 */
export function verifyTestRun(testInfo: TestInfo, entries: AllowListEntry[] = allowList) {
	if (testInfo.status === 'skipped') return;
	recordTestRun(testInfo);
	const missed = unscannedEntries(testInfo, entries);
	if (missed.length) {
		throw new Error(
			`Allow-list entries for screens this test never scanned (remove them, or fix the earlier failure):\n${missed
				.map(({ rule, screen, theme }) => `  ${rule} on ${theme} ${screen}`)
				.join('\n')}`
		);
	}
}
