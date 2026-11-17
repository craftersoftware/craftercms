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

import type { Locator, TestInfo } from '@playwright/test';
import { unpublishedDashlet } from './readiness';

/**
 * State of the Unpublished Work dashlet the allow-list baseline was captured in, from the 17 Nov 2026 capture
 * (`develop` at f2950f2c): a freshly created Website Editorial project with no edits. The dashboard entries are keyed by
 * row position, so they only hold while the dashlet looks like this.
 *  - `total` is the dashlet's own "1-50 of N" count, which any edit, publish or delete moves.
 *  - `rows` is how many rows its first page renders (the page size caps it, so it only catches a shorter list).
 * A recapture (`A11Y_CAPTURE=1`) logs what it observed: update this when the baseline is meant to change.
 */
export const DASHBOARD_BASELINE = { total: 228, rows: 50 };

export interface DashletState {
	total: number;
	rows: number;
}

/** Thrown when the project is not in the state the allow-list baseline was captured in. */
export class BaselineStateError extends Error {
	constructor(detail: string) {
		super(detail);
		this.name = 'BaselineStateError';
	}
}

/** The N of the dashlet pager's "1-50 of N" text, or `null` when the text has no such count. */
export function parseTotal(text: string): number | null {
	const match = /\bof\s+(\d[\d,.]*)\s*$/.exec(text.trim());
	return match ? Number(match[1].replace(/[,.]/g, '')) : null;
}

/** What is wrong with the observed dashlet compared with the baseline, or `null` when it matches. */
export function baselineMismatch(observed: DashletState, baseline: DashletState = DASHBOARD_BASELINE): string | null {
	if (observed.total === baseline.total && observed.rows === baseline.rows) return null;
	return (
		`The project is not in its baseline state: the Unpublished Work dashlet shows ${observed.total} unpublished ` +
		`items (${observed.rows} rows on its first page), and the allow-list baseline was captured with ${baseline.total} ` +
		`(${baseline.rows}). The dashboard entries are keyed by row position, so run the suite against a project freshly ` +
		`created from the Website Editorial blueprint with no edits (STUDIO_PROJECT), or recapture with A11Y_CAPTURE=1 and ` +
		`update DASHBOARD_BASELINE in tests/baseline.ts.`
	);
}

/** Reads the Unpublished Work dashlet inside `scope` once it has loaded: its first page's rows and its total. */
export async function observeDashlet(scope: Locator): Promise<DashletState> {
	const dashlet = unpublishedDashlet(scope);
	const rows = await dashlet.locator('ul .MuiListItemButton-root').count();
	if (!rows) return { total: 0, rows };
	const text = await dashlet
		.getByText(/^\s*\d[\d,.]*\s*[-\u2013]\s*\d[\d,.]*\s+of\s+\d[\d,.]*\s*$/)
		.first()
		.innerText({ timeout: 5_000 })
		.catch(() => null);
	const total = text === null ? null : parseTotal(text);
	if (total === null) {
		throw new BaselineStateError(
			`Could not read the Unpublished Work total: the dashlet shows ${rows} rows but no "1-${rows} of N" pager text.`
		);
	}
	return { total, rows };
}

/**
 * Fails, before the dashlet is scanned, when it is not in the state the baseline was captured in, so a project that has
 * been edited fails with the reason instead of with stale allow-list entries. In capture mode (`A11Y_CAPTURE=1`) it only
 * reports what it observed, since a recapture is how the baseline changes.
 */
export async function verifyDashboardBaseline(scope: Locator, testInfo: TestInfo) {
	const observed = await observeDashlet(scope);
	if (process.env.A11Y_CAPTURE) {
		console.log(
			`Dashboard baseline observed: total=${observed.total} rows=${observed.rows}. Set DASHBOARD_BASELINE in tests/baseline.ts to this if the baseline is meant to change.`
		);
		await testInfo.attach('dashboard baseline observed.json', {
			body: JSON.stringify(observed),
			contentType: 'application/json'
		});
		return;
	}
	const mismatch = baselineMismatch(observed);
	if (mismatch) throw new BaselineStateError(mismatch);
}
