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

import { expect, Page, test, TestInfo } from '@playwright/test';
import {
	BaselineStateError,
	baselineMismatch,
	DASHBOARD_BASELINE,
	observeDashlet,
	parseTotal,
	verifyDashboardBaseline
} from '../baseline';

test.describe('dashboard baseline logic', () => {
	test('reads the total from the dashlet pager text', () => {
		expect(parseTotal('1-50 of 228')).toBe(228);
		expect(parseTotal(' 1\u201350 of 1,228 ')).toBe(1228);
		expect(parseTotal('51-100 of 228')).toBe(228);
		expect(parseTotal('Items per page')).toBeNull();
		expect(parseTotal('')).toBeNull();
	});

	test('the baseline matches itself and nothing else', () => {
		expect(baselineMismatch({ ...DASHBOARD_BASELINE })).toBeNull();
		expect(baselineMismatch({ ...DASHBOARD_BASELINE, total: DASHBOARD_BASELINE.total + 1 })).not.toBeNull();
		expect(baselineMismatch({ ...DASHBOARD_BASELINE, total: DASHBOARD_BASELINE.total - 1 })).not.toBeNull();
		expect(baselineMismatch({ ...DASHBOARD_BASELINE, rows: DASHBOARD_BASELINE.rows - 1 })).not.toBeNull();
		expect(baselineMismatch({ total: 0, rows: 0 })).not.toBeNull();
	});

	test('the message names what was seen, what was expected and how to fix it', () => {
		const message = baselineMismatch({ total: 229, rows: 50 }, { total: 228, rows: 50 })!;
		expect(message).toContain('not in its baseline state');
		expect(message).toContain('229 unpublished items (50 rows');
		expect(message).toContain('captured with 228 (50)');
		expect(message).toContain('Website Editorial blueprint');
		expect(message).toContain('A11Y_CAPTURE=1');
		expect(message).toContain('DASHBOARD_BASELINE');
	});
});

const origin = 'https://studio.test';

/** The Unpublished Work dashlet the way it renders: a card with its rows and the pager's "1-n of total" text. */
function dashletHtml(rows: number, total: number, pager = true) {
	const items = Array.from({ length: rows }, (_, i) => `<li><div class="MuiListItemButton-root">Item ${i}</div></li>`);
	const footer = total && pager ? `<div><p>1-${rows} of ${total}</p></div>` : '';
	const empty = total ? '' : '<p>There are no unpublished items</p>';
	return `<!doctype html><body><div class="MuiCard-root"><h2>Unpublished Work</h2><ul>${items.join('')}</ul>${empty}${footer}</div></body>`;
}

async function openDashlet(page: Page, rows: number, total: number, pager = true) {
	await page.route(`${origin}/**`, (route) =>
		route.fulfill({ contentType: 'text/html', body: dashletHtml(rows, total, pager) })
	);
	await page.goto(`${origin}/`);
	return page.locator('body');
}

const testInfo = { attach: async () => undefined } as unknown as TestInfo;

test.describe('dashboard baseline check', () => {
	test.afterEach(() => {
		delete process.env.A11Y_CAPTURE;
	});

	test('observes the rows on the first page and the dashlet total', async ({ page }) => {
		const scope = await openDashlet(page, 50, 228);
		expect(await observeDashlet(scope)).toEqual({ total: 228, rows: 50 });
	});

	test('observes an empty dashlet as zero', async ({ page }) => {
		const scope = await openDashlet(page, 0, 0);
		expect(await observeDashlet(scope)).toEqual({ total: 0, rows: 0 });
	});

	test('passes on the baseline state', async ({ page }) => {
		const scope = await openDashlet(page, DASHBOARD_BASELINE.rows, DASHBOARD_BASELINE.total);
		await expect(verifyDashboardBaseline(scope, testInfo)).resolves.toBeUndefined();
	});

	test('one edit more than the baseline fails with the baseline message, even though the first page looks the same', async ({
		page
	}) => {
		const scope = await openDashlet(page, DASHBOARD_BASELINE.rows, DASHBOARD_BASELINE.total + 1);
		const failure = verifyDashboardBaseline(scope, testInfo);
		await expect(failure).rejects.toBeInstanceOf(BaselineStateError);
		await expect(failure).rejects.toThrow(/not in its baseline state.*229 unpublished items/);
	});

	test('a shorter first page fails too', async ({ page }) => {
		const scope = await openDashlet(page, 20, 20);
		await expect(verifyDashboardBaseline(scope, testInfo)).rejects.toThrow(/20 unpublished items \(20 rows/);
	});

	test('a dashlet with rows but no pager text fails with a baseline error instead of a timeout', async ({ page }) => {
		const scope = await openDashlet(page, 50, 228, false);
		const failure = observeDashlet(scope);
		await expect(failure).rejects.toBeInstanceOf(BaselineStateError);
		await expect(failure).rejects.toThrow(/Could not read the Unpublished Work total.*50 rows but no "1-50 of N"/);
	});

	test('capture mode reports what it observed instead of failing', async ({ page }) => {
		process.env.A11Y_CAPTURE = '1';
		const attached: string[] = [];
		const capturing = {
			attach: async (name: string, options: { body: string }) => void attached.push(`${name} ${options.body}`)
		} as unknown as TestInfo;
		const scope = await openDashlet(page, 50, 229);
		await expect(verifyDashboardBaseline(scope, capturing)).resolves.toBeUndefined();
		expect(attached).toEqual(['dashboard baseline observed.json {"total":229,"rows":50}']);
	});
});
