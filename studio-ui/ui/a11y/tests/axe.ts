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
import { allowList } from './allow-list';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const BLOCKING_IMPACTS = ['serious', 'critical'];

function isAllowed(violation: Result, node: Result['nodes'][number], screen: string) {
	return allowList.some(
		(entry) =>
			entry.rule === violation.id &&
			(!entry.screens || entry.screens.includes(screen)) &&
			(!entry.selector || node.target.join(' ').includes(entry.selector))
	);
}

function summarize(violations: Result[]) {
	return violations
		.map(
			({ id, impact, help, nodes }) =>
				`[${impact}] ${id}: ${help}\n${nodes.map((n) => `  ${n.target.join(' ')}`).join('\n')}`
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
	// The preview iframe hosts the project's site, not Studio UI.
	const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).exclude('#crafterCMSPreviewIframe').analyze();

	const blocking: Result[] = [];
	const allowed: Result[] = [];
	results.violations
		.filter((violation) => BLOCKING_IMPACTS.includes(violation.impact ?? ''))
		.forEach((violation) => {
			const nodes = violation.nodes.filter((node) => !isAllowed(violation, node, screen));
			const allowedNodes = violation.nodes.filter((node) => isAllowed(violation, node, screen));
			if (nodes.length) blocking.push({ ...violation, nodes });
			if (allowedNodes.length) allowed.push({ ...violation, nodes: allowedNodes });
		});

	const label = `${testInfo.project.name} - ${name}`;
	await testInfo.attach(`axe ${label}.json`, {
		body: JSON.stringify({ ...results, blocking, allowed }, null, 2),
		contentType: 'application/json'
	});
	if (allowed.length) {
		await testInfo.attach(`allow-listed ${label}.txt`, { body: summarize(allowed), contentType: 'text/plain' });
	}
	expect.soft(blocking.length, `${label}\n${summarize(blocking)}`).toBe(0);
}
