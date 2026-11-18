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
 * rules are still ticketed.
 */
test('the committed allow-list is valid', async () => {
	const { allowList } = await import('../allow-list');
	expect(allowList.length).toBeGreaterThan(0);
	for (const { nodes } of allowList) {
		for (const value of nodes) expect(stableTokens(value), value).not.toEqual([]);
	}
});
