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
import { stableTokens } from '../filter';

/**
 * The committed baseline, checked apart from the synthetic cases in filter.spec.ts so those do not depend on which
 * rules are still ticketed. An empty allow-list and an empty ticket set are valid: once the remaining tickets have
 * landed, nothing is allow-listed. Entries that are still present must name stable nodes. Importing the module also
 * rejects an entry whose rule, screen or theme is not ticketed.
 */
test('the committed allow-list is valid', async () => {
	const { allowList, ruleTickets } = await import('../allow-list');
	expect(Array.isArray(allowList)).toBe(true);
	expect(ruleTickets).toEqual(expect.any(Object));
	for (const { nodes } of allowList) {
		expect(nodes.length).toBeGreaterThan(0);
		for (const value of nodes) expect(stableTokens(value), value).not.toEqual([]);
	}
});

test('every ticket scope still has a committed entry', async () => {
	// Capture mode records every finding inside a scope, so a scope with no entry would quietly re-allow a regression.
	// An empty ticket set has no scopes, so it passes.
	const { allowList, ruleTickets } = await import('../allow-list');
	const recorded = new Set(allowList.map(({ rule, screen, theme }) => `${rule} on ${theme} ${screen}`));
	const empty = Object.entries(ruleTickets).flatMap(([rule, { scope }]) =>
		Object.entries(scope).flatMap(([screen, themes]) =>
			themes.map((theme) => `${rule} on ${theme} ${screen}`).filter((key) => !recorded.has(key))
		)
	);
	expect(empty).toEqual([]);
});
