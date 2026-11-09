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

import { expect, Page, test } from '@playwright/test';
import { NotReadyError, panelDestination, settle } from '../readiness';

const origin = 'https://studio.test';

/**
 * A tools panel page the way ToolPanel renders it: header with Back and the title, a divider, and an empty section that
 * the widget fills once its request answers. The shell is complete before the data arrives, which is the false-green
 * window the readiness contract has to close.
 */
const shell = `<!doctype html><html><body>
<div id="panel">
	<header><button aria-label="Back">&lt;</button><h2>Search</h2></header><hr />
	<section></section>
</div>
<script>
	fetch('/api/search').then((r) => r.json()).then((body) => {
		const section = document.querySelector('#panel section');
		if (body.error) section.innerHTML = '<section><h3>Error 500</h3><p>Internal error.</p></section>';
		else if (body.items.length) section.innerHTML = '<ul>' + body.items.map((i) => '<li>' + i + '</li>').join('') + '</ul>';
		else section.innerHTML = '<div><h3>No results found</h3></div>';
	});
</script>
</body></html>`;

/** Serves the shell and holds the widget request until `release` is called with its response body. */
async function openHeldPanel(page: Page) {
	let release!: (body: object) => void;
	const response = new Promise<object>((resolve) => (release = resolve));
	await page.route(`${origin}/**`, async (route) => {
		if (route.request().url().endsWith('/api/search')) {
			await route.fulfill({ json: await response });
		} else {
			await route.fulfill({ contentType: 'text/html', body: shell });
		}
	});
	await page.goto(`${origin}/`);
	const panel = page.locator('#panel');
	return { panel, release, ready: panelDestination(page, panel, 'Search', 'edit mode tools panel > Search').ready };
}

test.describe('panel destination readiness', () => {
	test('does not resolve while the widget response is held, even with Back and the title on screen', async ({
		page
	}) => {
		const { panel, release, ready } = await openHeldPanel(page);
		await expect(panel.getByRole('button', { name: 'Back' })).toBeVisible();
		let scanned = false;
		const scan = settle(page, 'Search', ready).then(() => (scanned = true));
		// Well past the 250 ms stability interval the previous readiness check accepted.
		await page.waitForTimeout(1_000);
		expect(scanned).toBe(false);
		release({ items: ['Home', 'About'] });
		await scan;
		expect(scanned).toBe(true);
		await expect(panel.getByRole('listitem')).toHaveCount(2);
	});

	test('resolves on the explicit empty state', async ({ page }) => {
		const { release, ready } = await openHeldPanel(page);
		const scan = settle(page, 'Search', ready);
		release({ items: [] });
		await expect(scan).resolves.toBeUndefined();
	});

	test('a destination that never loads fails with NotReadyError instead of scanning the shell', async ({ page }) => {
		const { ready } = await openHeldPanel(page);
		await expect(settle(page, 'Search', ready, 1_000)).rejects.toBeInstanceOf(NotReadyError);
	});

	test('a destination that shows its error state fails with NotReadyError', async ({ page }) => {
		const { release, ready } = await openHeldPanel(page);
		const scan = settle(page, 'Search', ready);
		release({ error: true });
		await expect(scan).rejects.toThrow(/error state \("Error 500"\)/);
	});

	test('a destination without a readiness contract fails instead of being scanned on a guess', async ({ page }) => {
		expect(() =>
			panelDestination(page, page.locator('#panel'), 'New Panel', 'edit mode tools panel > New Panel')
		).toThrow(NotReadyError);
	});
});
