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

import { test as base, expect, Page } from '@playwright/test';
import { project, username } from './env';

export { expect };

export const test = base.extend({
	context: async ({ context, baseURL }, use) => {
		// Deterministic rendering: no animations or transitions while axe measures colors and sizes.
		await context.addInitScript((user) => {
			window.localStorage.setItem(`craftercms.${user}.enableAnimations`, 'false');
		}, username);
		// Project-scoped screens (dashboard, search, project tools) read the active project from this cookie.
		await context.addCookies([{ name: 'crafterSite', value: project, url: baseURL }]);
		await use(context);
	}
});

/** Waits for network and loading indicators to calm down so axe doesn't scan a half-rendered screen. */
export async function settle(page: Page) {
	await page.waitForLoadState('networkidle').catch(() => undefined);
	await expect(page.locator('[role="progressbar"], .MuiSkeleton-root'))
		.toHaveCount(0, { timeout: 15_000 })
		.catch(() => undefined);
}
