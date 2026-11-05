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

import { test as base, expect, Locator, Page } from '@playwright/test';
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
		await context.addInitScript((user) => {
			// Studio's legacy browser check reads `window.chrome`; the headless shell doesn't define it and would render
			// the "unsupported browser" banner that no real Chrome or Firefox user sees.
			if (!('chrome' in window))
				Object.defineProperty(window, 'chrome', { value: { runtime: {} }, configurable: true });
			// Deterministic rendering: no animations or transitions while axe measures colors and sizes.
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

/** Markup Studio renders while a panel, list or form is still loading (see `LoadingState`). */
const LOADING_INDICATORS = '[role="progressbar"], .MuiSkeleton-root, svg[viewBox="0 0 264 202"]';

/**
 * Studio's transient notifications. They are app-level and outlive the screen that raised them, so they would otherwise
 * be attributed to whichever screen happens to be scanned next.
 */
const NOTIFICATIONS = '.notistack-SnackbarContainer';

/** Thrown when a readiness wait times out, so a scan is never reported against a screen that never rendered. */
export class NotReadyError extends Error {
	constructor(screen: string, detail: string) {
		super(`${screen} was not ready to scan: ${detail}`);
		this.name = 'NotReadyError';
	}
}

/**
 * Waits for a screen to be ready to scan, then optionally for its own content. Every wait fails the test with the
 * screen's name instead of letting a scan run against a loading, half-rendered or already-notified state; there is no
 * best-effort mode.
 *
 * Studio keeps long-lived connections open, so `networkidle` is not used: it returns before slow XHRs finish and is
 * never a signal that the UI has rendered.
 * @param screen Screen name, used in failure messages.
 * @param ready Condition that proves the screen's own content is on the page (a heading, a row, a dialog, ...).
 * @param stable Region whose text must stop changing, for panels that render their widgets asynchronously and show no
 * loading indicator while they do.
 */
export async function settle(page: Page, screen: string, ready?: Locator, stable?: Locator) {
	try {
		await expect(page.locator(LOADING_INDICATORS).filter({ visible: true }), `${screen} is still loading`).toHaveCount(
			0,
			{ timeout: 20_000 }
		);
		if (ready) await expect(ready, `${screen} content did not render`).toBeVisible({ timeout: 20_000 });
		if (stable) {
			let previous = await stable.innerText();
			for (let i = 0; i < 40; i++) {
				await page.waitForTimeout(250);
				const next = await stable.innerText();
				if (next === previous && next.trim()) break;
				previous = next;
				if (i === 39) throw new Error(`${screen} content never stopped changing`);
			}
		}
		// Notifications auto-dismiss after a few seconds; waiting them out keeps the scan on the screen itself.
		await expect(page.locator(NOTIFICATIONS), `${screen} never settled: a notification is still up`).toHaveCount(0, {
			timeout: 20_000
		});
	} catch (error) {
		throw new NotReadyError(screen, error instanceof Error ? error.message.split('\n')[0] : String(error));
	}
}
