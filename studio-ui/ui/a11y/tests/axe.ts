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
import type { Result } from 'axe-core';
import { allowList, AllowListEntry } from './allow-list';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const BLOCKING_IMPACTS = ['serious', 'critical'];

function entriesFor(violation: Result, screen: string, theme: string) {
	return allowList.filter(
		(entry) =>
			entry.rule === violation.id &&
			entry.screens.includes(screen) &&
			(!entry.themes || entry.themes.includes(theme as 'light' | 'dark'))
	);
}

function isAllowed(violation: Result, screen: string, theme: string) {
	return entriesFor(violation, screen, theme).length > 0;
}

function summarize(violations: Result[], screen: string = '', theme: string = '') {
	return violations
		.map(({ id, impact, help, nodes }) => {
			const tickets = screen
				? entriesFor({ id } as Result, screen, theme)
						.map((entry) => `${entry.ticket}${entry.clearedBy ? ` (expected cleared by ${entry.clearedBy})` : ''}`)
						.join(', ')
				: '';
			return `[${impact}] ${id}: ${help}${tickets ? ` [${tickets}]` : ''}\n${nodes
				.map((n) => `  ${n.target.join(' ')}`)
				.join('\n')}`;
		})
		.join('\n');
}

function summarizeAllowList(entries: AllowListEntry[]) {
	return entries
		.map(
			({ rule, ticket, clearedBy, reason }) =>
				`${rule}\n  ticket: ${ticket}\n  clearedBy: ${clearedBy ?? 'n/a'}\n  ${reason}`
		)
		.join('\n');
}

/**
 * Scans the current page against WCAG 2.0/2.1 A and AA rules. Fails the test on serious or critical violations that are
 * not covered by the allow-list. Uses soft assertions so every panel/dialog of a screen is reported in a single run.
 * @param name Name of the screen (or of the panel/dialog within it) being scanned.
 * @param screen Allow-list screen key; defaults to `name`.
 */
export async function checkA11y(page: Page, testInfo: TestInfo, name: string, screen: string = name) {
	const theme = testInfo.project.name;
	// The preview iframe hosts the project's site, not Studio UI.
	const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).exclude('#crafterCMSPreviewIframe').analyze();

	const blocking: Result[] = [];
	const allowed: Result[] = [];
	// A screen with no allow-list entry for a rule is expected to be clean: any finding there is a regression.
	results.violations
		.filter((violation) => BLOCKING_IMPACTS.includes(violation.impact ?? ''))
		.forEach((violation) => {
			if (isAllowed(violation, screen, theme)) allowed.push(violation);
			else blocking.push(violation);
		});

	const label = `${testInfo.project.name} - ${name}`;
	const allowedEntries = [...new Set(results.violations.flatMap((v) => entriesFor(v, screen, theme)))];
	await testInfo.attach(`axe ${label}.json`, {
		body: JSON.stringify({ ...results, blocking, allowed, allowList: allowedEntries }, null, 2),
		contentType: 'application/json'
	});
	if (allowed.length) {
		// Name the tickets on every allow-listed finding so a reader can tell what is still expected to fail.
		await testInfo.attach(`allow-listed ${label}.txt`, {
			body: `${summarize(allowed, screen, theme)}\n\nApplied allow-list entries:\n${summarizeAllowList(allowedEntries)}`,
			contentType: 'text/plain'
		});
	}
	expect.soft(blocking.length, `${label}\n${summarize(blocking)}`).toBe(0);
}
