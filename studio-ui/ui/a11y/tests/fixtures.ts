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
import { password, project, username } from './env';

export { expect };

async function logIn(page: Page) {
	await page.goto('/studio/login');
	await page.locator('input[name="username"]').fill(username);
	await page.locator('input[name="password"]').fill(password);
	await page.locator('button[type="submit"]').click();
	// The global app sets its hash route once it has finished booting and refreshing the auth token. Navigating away
	// before that leaves the session half-established.
	await page.waitForURL(/\/studio\/#\//);
}

export const test = base.extend<{ authenticated: boolean }>({
	// Set to false (`test.use({ authenticated: false })`) for screens that are visited logged out.
	authenticated: [true, { option: true }],
	context: async ({ context, baseURL }, use) => {
		// Deterministic rendering: no animations or transitions while axe measures colors and sizes.
		await context.addInitScript((user) => {
			window.localStorage.setItem(`craftercms.${user}.enableAnimations`, 'false');
		}, username);
		// Project-scoped screens (dashboard, search, project tools) read the active project from this cookie.
		await context.addCookies([{ name: 'crafterSite', value: project, url: baseURL }]);
		await use(context);
	},
	// Studio rotates its refresh token as it is used, so a saved login can't be shared between tests: log in per test.
	page: async ({ page, authenticated }, use) => {
		if (authenticated) await logIn(page);
		await use(page);
	}
});

/** Waits for loading indicators to go away so axe doesn't scan a half-rendered screen. */
export async function settle(page: Page) {
	// Studio keeps long-lived connections open, so network idle is only a best effort.
	await page.waitForLoadState('networkidle', { timeout: 2_000 }).catch(() => undefined);
	await expect(page.locator('[role="progressbar"], .MuiSkeleton-root'))
		.toHaveCount(0, { timeout: 5_000 })
		.catch(() => undefined);
}
