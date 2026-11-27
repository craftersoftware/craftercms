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
	DASHBOARD_SUBJECT,
	observeDashlet,
	observeSearch,
	observeUsers,
	parseTotal,
	SEARCH_BASELINE,
	SEARCH_SETTLE,
	SEARCH_SUBJECT,
	settleSearch,
	USERS_BASELINE,
	USERS_SUBJECT,
	verifyDashboardBaseline,
	verifySearchBaseline,
	verifyUsersBaseline
} from '../baseline';

test.describe('dashboard baseline logic', () => {
	test('reads the total from the dashlet pager text', () => {
		expect(parseTotal('1-50 of 228')).toBe(228);
		expect(parseTotal(' 1\u201350 of 1,228 ')).toBe(1228);
		expect(parseTotal('51-100 of 228')).toBe(228);
		expect(parseTotal('1-21 of 230 results')).toBe(230);
		expect(parseTotal('1-21 of 1,230 results for \u201cabout\u201d \u2022 Filters Active')).toBe(1230);
		expect(parseTotal('1-50 of more than 50')).toBeNull();
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
function dashletHtml(rows: number, total: number, pager = true, skeletons = 0) {
	const items = [
		...Array.from({ length: rows }, (_, i) => `<li class="MuiListItem-root">Item ${i}</li>`),
		...Array.from(
			{ length: skeletons },
			() => '<li class="MuiListItem-root"><span class="MuiSkeleton-root"></span></li>'
		)
	];
	const footer = total && pager ? `<div><p>1-${rows} of ${total}</p></div>` : '';
	const empty = total ? '' : '<p>There are no unpublished items</p>';
	return `<!doctype html><body><div class="MuiCard-root"><h2>Unpublished Work</h2><ul>${items.join('')}</ul>${empty}${footer}</div></body>`;
}

async function openDashlet(page: Page, rows: number, total: number, pager = true, skeletons = 0) {
	await page.route(`${origin}/**`, (route) =>
		route.fulfill({ contentType: 'text/html', body: dashletHtml(rows, total, pager, skeletons) })
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

	test('does not count the placeholder rows of a dashlet that is still loading', async ({ page }) => {
		const scope = await openDashlet(page, 50, 228, true, 3);
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
		await expect(failure).rejects.toThrow(
			/Could not read the total of the Unpublished Work dashlet.*50 rows but no "1-50 of N" pager text/
		);
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

/** The search page the way it renders: a grid of cards and the pager's "1-n of total results" text. */
function searchHtml(cards: number, total: number, pager = true) {
	const items = Array.from(
		{ length: cards },
		(_, i) => `<div class="MuiGrid-root MuiGrid-item"><div class="MuiCard-root">Card ${i}</div></div>`
	);
	const footer = pager ? `<p>1-${cards} of ${total} results</p>` : '';
	return `<!doctype html><body><h1>Search</h1>${footer}<div class="MuiGrid-container">${items.join('')}</div></body>`;
}

/** The Users grid the way it renders: the header row, one row per user and the pager's "1-n of total" text. */
function usersHtml(rows: number, total: number, pager = true) {
	const items = Array.from({ length: rows }, (_, i) => `<tr><td>user${i}</td></tr>`);
	const empty = rows ? '' : '<tr class="hoverDisabled"><td>No Users Found</td></tr>';
	const footer = pager && rows ? `<p>1\u2013${rows} of ${total}</p>` : '';
	return `<!doctype html><body><table><thead><tr class="hoverDisabled"><th></th></tr></thead><tbody>${items.join('')}${empty}</tbody></table>${footer}</body>`;
}

/** Settle options that keep the unit tests quick: a state that holds still for 200ms is final. */
const fast = { pollMs: 25, stableMs: 200, timeoutMs: 3_000 };

async function open(page: Page, html: string) {
	await page.route(`${origin}/**`, (route) => route.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
	await page.goto(`${origin}/`);
	return page.locator('body');
}

/**
 * The search page while the index builds: the Nth request of the page (the load, then each reload) is served
 * `stages[N]` as `[cards, total]`, and the last stage keeps being served once they run out. The real page runs its
 * search on mount only, so a state that moves has to arrive with a reload. `requests` counts what was served.
 */
async function openBuilding(page: Page, stages: [number, number][]) {
	const requests = { count: 0 };
	await page.route(`${origin}/**`, (route) => {
		const [cards, total] = stages[Math.min(requests.count++, stages.length - 1)];
		return route.fulfill({ contentType: 'text/html; charset=utf-8', body: searchHtml(cards, total) });
	});
	await page.goto(`${origin}/`);
	return { scope: page.locator('body'), requests };
}

test.describe('search and users baselines', () => {
	test.afterEach(() => {
		delete process.env.A11Y_CAPTURE;
	});

	test('the search baseline is captured from a populated first page', () => {
		expect(SEARCH_BASELINE.rows).toBeGreaterThan(0);
		expect(SEARCH_BASELINE.total).toBeGreaterThanOrEqual(SEARCH_BASELINE.rows);
	});

	test('the users baseline is captured from a populated first page', () => {
		expect(USERS_BASELINE.rows).toBeGreaterThan(0);
		expect(USERS_BASELINE.total).toBeGreaterThanOrEqual(USERS_BASELINE.rows);
	});

	test('observes the cards and the total of the search results', async ({ page }) => {
		expect(await observeSearch(await open(page, searchHtml(21, 230)))).toEqual({ total: 230, rows: 21 });
		expect(await observeSearch(await open(page, searchHtml(0, 0, false)))).toEqual({ total: 0, rows: 0 });
	});

	test('observes the user rows and the total of the Users grid, not the header or the empty state', async ({
		page
	}) => {
		expect(await observeUsers(await open(page, usersHtml(2, 2)))).toEqual({ total: 2, rows: 2 });
		expect(await observeUsers(await open(page, usersHtml(0, 0)))).toEqual({ total: 0, rows: 0 });
	});

	test('search passes on its baseline and fails with a search message on any other state', async ({ page }) => {
		const { total, rows } = SEARCH_BASELINE;
		await expect(
			verifySearchBaseline(await open(page, searchHtml(rows, total)), testInfo, fast)
		).resolves.toBeUndefined();
		const failure = verifySearchBaseline(await open(page, searchHtml(rows, total + 1)), testInfo, fast);
		await expect(failure).rejects.toBeInstanceOf(BaselineStateError);
		await expect(failure).rejects.toThrow(
			new RegExp(
				`not in its baseline state: the search results shows ${total + 1} results \\(${rows} cards.*captured with ${total} \\(${rows}\\).*SEARCH_BASELINE`
			)
		);
		await expect(
			verifySearchBaseline(await open(page, searchHtml(Math.max(rows - 1, 1), total)), testInfo, fast)
		).rejects.toThrow(/search results shows/);
	});

	test('users passes on its baseline and fails with a users message on any other state', async ({ page }) => {
		const { total, rows } = USERS_BASELINE;
		await expect(verifyUsersBaseline(await open(page, usersHtml(rows, total)), testInfo)).resolves.toBeUndefined();
		const failure = verifyUsersBaseline(await open(page, usersHtml(rows + 1, total + 1)), testInfo);
		await expect(failure).rejects.toBeInstanceOf(BaselineStateError);
		await expect(failure).rejects.toThrow(
			new RegExp(`Studio is not in its baseline state: the Users grid shows ${total + 1} users.*USERS_BASELINE`)
		);
		await expect(verifyUsersBaseline(await open(page, usersHtml(0, 0)), testInfo)).rejects.toThrow(
			/Users grid shows 0 users/
		);
	});

	test('a listing with rows but no pager text fails with a baseline error naming it, not a timeout', async ({
		page
	}) => {
		const search = observeSearch(await open(page, searchHtml(21, 230, false)));
		await expect(search).rejects.toBeInstanceOf(BaselineStateError);
		await expect(search).rejects.toThrow(/total of the search results.*21 cards but no "1-21 of N results" pager text/);
		const users = observeUsers(await open(page, usersHtml(2, 2, false)));
		await expect(users).rejects.toThrow(/total of the Users grid.*2 rows but no "1-2 of N" pager text/);
	});

	test('capture mode reports what it observed for search and users instead of failing', async ({ page }) => {
		process.env.A11Y_CAPTURE = '1';
		const attached: string[] = [];
		const capturing = {
			attach: async (name: string, options: { body: string }) => void attached.push(`${name} ${options.body}`)
		} as unknown as TestInfo;
		await expect(verifySearchBaseline(await open(page, searchHtml(9, 99)), capturing, fast)).resolves.toBeUndefined();
		await expect(verifyUsersBaseline(await open(page, usersHtml(3, 3)), capturing)).resolves.toBeUndefined();
		expect(attached).toEqual([
			'search baseline observed.json {"total":99,"rows":9}',
			'users baseline observed.json {"total":3,"rows":3}'
		]);
	});

	test('prune mode keeps the guards, since it removes entries by position', async ({ page }) => {
		process.env.A11Y_CAPTURE = 'prune';
		const failure = verifyDashboardBaseline(
			await open(page, dashletHtml(DASHBOARD_BASELINE.rows, DASHBOARD_BASELINE.total + 1)),
			testInfo
		);
		await expect(failure).rejects.toBeInstanceOf(BaselineStateError);
	});

	test('every message names the constant to update and how to get a baseline state', () => {
		for (const subject of [DASHBOARD_SUBJECT, SEARCH_SUBJECT, USERS_SUBJECT]) {
			const message = baselineMismatch({ total: 1, rows: 1 }, { total: 2, rows: 2 }, subject)!;
			expect(message, subject.screen).toContain(subject.constant);
			expect(message, subject.screen).toContain('A11Y_CAPTURE=1');
			expect(message, subject.screen).toContain('captured with 2 (2)');
		}
	});
});

test.describe('search baseline while the index builds', () => {
	test.afterEach(() => {
		delete process.env.A11Y_CAPTURE;
	});

	const { total, rows } = SEARCH_BASELINE;

	test('waits for a total that is still growing to reach the baseline', async ({ page }) => {
		const { scope } = await openBuilding(page, [
			[5, 17],
			[12, 61],
			[rows, total]
		]);
		await expect(verifySearchBaseline(scope, testInfo, { ...fast, stableMs: 5_000 })).resolves.toBeUndefined();
	});

	test('runs the search again between reads, since the page only searches when it loads', async ({ page }) => {
		const { scope, requests } = await openBuilding(page, [
			[5, 17],
			[12, 61],
			[rows, total]
		]);
		await verifySearchBaseline(scope, testInfo, { ...fast, stableMs: 5_000 });
		expect(requests.count).toBe(3);
	});

	test('a total that is settled and matches the baseline passes without waiting for the stable interval', async ({
		page
	}) => {
		const scope = await open(page, searchHtml(rows, total));
		const started = Date.now();
		await expect(settleSearch(scope, SEARCH_BASELINE, { ...fast, stableMs: 5_000 })).resolves.toEqual({ total, rows });
		expect(Date.now() - started).toBeLessThan(2_000);
	});

	test('a total that stops short of the baseline is reported as a baseline mismatch once it held still', async ({
		page
	}) => {
		const { scope } = await openBuilding(page, [
			[5, 17],
			[12, 61]
		]);
		const failure = verifySearchBaseline(scope, testInfo, fast);
		await expect(failure).rejects.toBeInstanceOf(BaselineStateError);
		await expect(failure).rejects.toThrow(/not in its baseline state: the search results shows 61 results \(12 cards/);
	});

	test('a total that keeps changing fails with a message about the index, not with a baseline mismatch', async ({
		page
	}) => {
		const stages: [number, number][] = Array.from({ length: 400 }, (_, i) => [10, 10 + i]);
		const { scope } = await openBuilding(page, stages);
		const failure = verifySearchBaseline(scope, testInfo, { pollMs: 25, stableMs: 500, timeoutMs: 1_000 });
		await expect(failure).rejects.toBeInstanceOf(BaselineStateError);
		await expect(failure).rejects.toThrow(
			/did not settle within 1s.*still changing.*expects 103 results, 21 cards.*last showed \d+ results.*search index still building/s
		);
	});

	test('an empty or unreadable list is not taken as final, and the timeout says what was seen', async ({ page }) => {
		const options = { pollMs: 25, stableMs: 100, timeoutMs: 500 };
		const empty = settleSearch(await open(page, searchHtml(0, 0, false)), SEARCH_BASELINE, options);
		await expect(empty).rejects.toThrow(/did not settle within 1s.*last showed 0 results/s);
		const unreadable = settleSearch(await open(page, searchHtml(21, 230, false)), SEARCH_BASELINE, options);
		await expect(unreadable).rejects.toBeInstanceOf(BaselineStateError);
		await expect(unreadable).rejects.toThrow(/last read failed: Could not read the total of the search results/);
	});

	test('capture mode reads the total once, without waiting for the index or reloading', async ({ page }) => {
		process.env.A11Y_CAPTURE = '1';
		const attached: string[] = [];
		const capturing = {
			attach: async (name: string, options: { body: string }) => void attached.push(`${name} ${options.body}`)
		} as unknown as TestInfo;
		const { scope, requests } = await openBuilding(page, [
			[3, 3],
			[9, 99]
		]);
		const started = Date.now();
		await verifySearchBaseline(scope, capturing, { ...fast, stableMs: 600 });
		expect(attached).toEqual(['search baseline observed.json {"total":3,"rows":3}']);
		expect(requests.count).toBe(1);
		expect(Date.now() - started).toBeLessThan(500);
	});

	test('capture mode does not throw for an empty or unreadable search, it logs and attaches what it saw', async ({
		page
	}) => {
		process.env.A11Y_CAPTURE = '1';
		const attached: string[] = [];
		const capturing = {
			attach: async (name: string, options: { body: string }) => void attached.push(`${name} ${options.body}`)
		} as unknown as TestInfo;
		const options = { pollMs: 25, stableMs: 100, timeoutMs: 500 };
		await verifySearchBaseline(await open(page, searchHtml(0, 0, false)), capturing, options);
		await verifySearchBaseline(await open(page, searchHtml(21, 230, false)), capturing, options);
		expect(attached).toEqual([
			'search baseline observed.json {"total":0,"rows":0}',
			expect.stringMatching(/^search baseline observed\.json \{"error":"Could not read the total of the search results/)
		]);
	});

	test('prune mode waits for the final total like a normal run', async ({ page }) => {
		process.env.A11Y_CAPTURE = 'prune';
		const { scope } = await openBuilding(page, [
			[3, 3],
			[rows, total]
		]);
		await expect(verifySearchBaseline(scope, testInfo, { ...fast, stableMs: 600 })).resolves.toBeUndefined();
	});

	test('a Search error state after a reload fails at once, not after the settle timeout', async ({ page }) => {
		let requests = 0;
		await page.route(`${origin}/**`, (route) =>
			route.fulfill({
				contentType: 'text/html; charset=utf-8',
				body:
					requests++ === 0
						? searchHtml(3, 3)
						: '<!doctype html><body><h1>Search</h1><section><h2>Error 500</h2></section></body>'
			})
		);
		await page.goto(`${origin}/`);
		const started = Date.now();
		await expect(verifySearchBaseline(page.locator('body'), testInfo, { ...fast, timeoutMs: 10_000 })).rejects.toThrow(
			/search was not ready to scan: it shows an error state \("Error 500"\)/
		);
		expect(Date.now() - started).toBeLessThan(5_000);
	});

	test('the defaults give an index a minute and a few seconds of the same total to be final', () => {
		expect(SEARCH_SETTLE.pollMs).toBeGreaterThanOrEqual(1_000);
		expect(SEARCH_SETTLE.timeoutMs).toBeGreaterThanOrEqual(30_000);
		expect(SEARCH_SETTLE.stableMs).toBeGreaterThan(SEARCH_SETTLE.pollMs * 2);
		expect(SEARCH_SETTLE.stableMs).toBeLessThan(SEARCH_SETTLE.timeoutMs);
	});
});
