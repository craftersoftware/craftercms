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
import { captureMode } from './capture';
import { unpublishedDashlet } from './readiness';

/** What a screen's listing shows: the pager's own total and how many rows (or cards) its first page renders. */
export interface ListingState {
	total: number;
	rows: number;
}

/**
 * State of the Unpublished Work dashlet the allow-list baseline was captured in, from the 17 Nov 2026 capture
 * (`develop` at f2950f2c): a freshly created Website Editorial project with no edits. The dashboard entries are keyed by
 * row position, so they only hold while the dashlet looks like this.
 *  - `total` is the dashlet's own "1-50 of N" count, which any edit, publish or delete moves.
 *  - `rows` is how many rows its first page renders (the page size caps it, so it only catches a shorter list).
 * A recapture (`A11Y_CAPTURE=1`) logs what it observed: update this when the baseline is meant to change.
 */
export const DASHBOARD_BASELINE: ListingState = { total: 228, rows: 50 };

/**
 * State of the search results the allow-list baseline was captured in: the first page (21 cards) of the unfiltered
 * search of a freshly created Website Editorial project. The search entries are keyed by card position, and which cards
 * fail depends on the items behind them, so they only hold while the results look like this. The total also moves while
 * the search index is still being built, which `settleSearch` waits out before the guard compares it.
 */
export const SEARCH_BASELINE: ListingState = { total: 103, rows: 21 };

/**
 * State of the Users grid the allow-list baseline was captured in. The users entries are keyed by row position
 * (`tr:nth-child(n)`) and the failing avatars depend on the users' initials and colours, so they only hold for these
 * users.
 */
export const USERS_BASELINE: ListingState = { total: 2, rows: 2 };

/** Describes one guarded screen: what it shows, and where its baseline lives, for messages. */
export interface BaselineSubject {
	/** Name of the screen in the capture log and the attachment. */
	screen: string;
	/** The listing, for sentences: "the Unpublished Work dashlet". */
	listing: string;
	/** What the listing's total counts: "unpublished items". */
	items: string;
	/** What a row is: "rows" or "cards". */
	rowName: string;
	/** The pager text the total is read from, for the unreadable-total error: "1-N of N". */
	pagerShape: (rows: number) => string;
	/** Why the entries depend on the listing. */
	keyedBy: string;
	/** The exported constant to update on a recapture. */
	constant: string;
	/** What else can move the state, for the message. */
	hint: string;
	/** What owns the state, for the message: "project" or "Studio". */
	owner: 'project' | 'Studio';
	baseline: ListingState;
}

export const DASHBOARD_SUBJECT: BaselineSubject = {
	screen: 'dashboard',
	listing: 'the Unpublished Work dashlet',
	items: 'unpublished items',
	rowName: 'rows',
	pagerShape: (rows) => `"1-${rows} of N"`,
	keyedBy: 'The dashboard entries are keyed by row position',
	constant: 'DASHBOARD_BASELINE',
	hint: 'recreated from the Website Editorial blueprint with no edits',
	owner: 'project',
	baseline: DASHBOARD_BASELINE
};

export const SEARCH_SUBJECT: BaselineSubject = {
	screen: 'search',
	listing: 'the search results',
	items: 'results',
	rowName: 'cards',
	pagerShape: (rows) => `"1-${rows} of N results"`,
	keyedBy: 'The search entries are keyed by card position and by which items the cards show',
	constant: 'SEARCH_BASELINE',
	hint: 'freshly created from the Website Editorial blueprint with no edits, and its search index fully built',
	owner: 'project',
	baseline: SEARCH_BASELINE
};

export const USERS_SUBJECT: BaselineSubject = {
	screen: 'users',
	listing: 'the Users grid',
	items: 'users',
	rowName: 'rows',
	pagerShape: (rows) => `"1-${rows} of N"`,
	keyedBy: "The users entries are keyed by row position and by each user's avatar",
	constant: 'USERS_BASELINE',
	hint: 'a Studio with only the users the baseline was captured with',
	owner: 'Studio',
	baseline: USERS_BASELINE
};

/** Thrown when the project is not in the state the allow-list baseline was captured in. */
export class BaselineStateError extends Error {
	constructor(detail: string) {
		super(detail);
		this.name = 'BaselineStateError';
	}
}

/** The N of a pager's "1-50 of N" (or "1-21 of N results") text, or `null` when the text has no such count. */
export function parseTotal(text: string): number | null {
	const match = /\bof\s+(\d[\d,.]*)(?:\s+results\b.*)?$/s.exec(text.trim());
	return match ? Number(match[1].replace(/[,.]/g, '')) : null;
}

/** What is wrong with the observed listing compared with the baseline, or `null` when it matches. */
export function baselineMismatch(
	observed: ListingState,
	baseline: ListingState = DASHBOARD_BASELINE,
	subject: BaselineSubject = DASHBOARD_SUBJECT
): string | null {
	if (observed.total === baseline.total && observed.rows === baseline.rows) return null;
	return (
		`The ${subject.owner} is not in its baseline state: ${subject.listing} shows ` +
		`${observed.total} ${subject.items} (${observed.rows} ${subject.rowName} on its first page), and the allow-list ` +
		`baseline was captured with ${baseline.total} (${baseline.rows}). ${subject.keyedBy}, so run the suite against ` +
		`${subject.hint} (STUDIO_PROJECT, STUDIO_URL), or recapture with A11Y_CAPTURE=1 and update ${subject.constant} in ` +
		`tests/baseline.ts.`
	);
}

/** The pager text of a listing: "1-50 of 228", with the en dash and thousands separators Studio may render. */
export const PAGER_TEXT = /^\s*\d[\d,.]*\s*[-\u2013]\s*\d[\d,.]*\s+of\s+\d[\d,.]*\s*$/;

/** The search results' pager text: "1-21 of 230 results", optionally followed by "for <keyword>" and the filter flag. */
export const SEARCH_PAGER_TEXT = /^\s*\d[\d,.]*\s*[-\u2013]\s*\d[\d,.]*\s+of\s+\d[\d,.]*\s+results\b/;

/**
 * Reads a listing's first page: how many rows it renders and, from its pager, its total. No rows is an empty listing,
 * which has no pager to read.
 */
export async function observeListing(
	rows: Locator,
	pager: Locator,
	subject: Pick<BaselineSubject, 'listing' | 'rowName' | 'pagerShape'>
): Promise<ListingState> {
	const count = await rows.count();
	if (!count) return { total: 0, rows: count };
	const text = await pager
		.first()
		.innerText({ timeout: 5_000 })
		.catch(() => null);
	const total = text === null ? null : parseTotal(text);
	if (total === null) {
		throw new BaselineStateError(
			`Could not read the total of ${subject.listing}: it shows ${count} ${subject.rowName} but no ${subject.pagerShape(count)} pager text.`
		);
	}
	return { total, rows: count };
}

/** Reads the Unpublished Work dashlet inside `scope` once it has loaded: its first page's rows and its total. */
export function observeDashlet(scope: Locator): Promise<ListingState> {
	const dashlet = unpublishedDashlet(scope);
	return observeListing(
		dashlet.locator('ul .MuiListItemButton-root'),
		dashlet.getByText(PAGER_TEXT),
		DASHBOARD_SUBJECT
	);
}

/** Reads the search results inside `scope` once they have loaded: the cards of the first page and the results total. */
export function observeSearch(scope: Locator): Promise<ListingState> {
	return observeListing(
		scope.locator('.MuiGrid-container > .MuiGrid-root > .MuiCard-root'),
		scope.getByText(SEARCH_PAGER_TEXT),
		SEARCH_SUBJECT
	);
}

/** Reads the Users grid inside `scope` once it has loaded: the user rows of the first page and the users total. */
export function observeUsers(scope: Locator): Promise<ListingState> {
	return observeListing(scope.locator('tbody tr:not(.hoverDisabled)'), scope.getByText(PAGER_TEXT), USERS_SUBJECT);
}

/**
 * Fails, before the listing is scanned, when it is not in the state the baseline was captured in, so a project that has
 * been edited fails with the reason instead of with stale allow-list entries. In capture mode (`A11Y_CAPTURE=1`) it only
 * reports what it observed, since a recapture is how the baseline changes. Prune mode (`A11Y_CAPTURE=prune`) keeps the
 * check: it removes entries by position, which on shifted content would drop nodes that still fail.
 */
export async function verifyBaseline(observed: ListingState, subject: BaselineSubject, testInfo: TestInfo) {
	if (captureMode() === 'capture') {
		console.log(
			`${subject.screen} baseline observed: total=${observed.total} rows=${observed.rows}. Set ${subject.constant} in tests/baseline.ts to this if the baseline is meant to change.`
		);
		await testInfo.attach(`${subject.screen} baseline observed.json`, {
			body: JSON.stringify(observed),
			contentType: 'application/json'
		});
		return;
	}
	const mismatch = baselineMismatch(observed, subject.baseline, subject);
	if (mismatch) throw new BaselineStateError(mismatch);
}

/** Checks the Unpublished Work dashlet (on the dashboard and in the tools panel's Dashboard) against its baseline. */
export async function verifyDashboardBaseline(scope: Locator, testInfo: TestInfo) {
	await verifyBaseline(await observeDashlet(scope), DASHBOARD_SUBJECT, testInfo);
}

/** How long `settleSearch` polls the search results, and when it stops waiting. */
export interface SettleOptions {
	/** Delay between two reads of the results. */
	pollMs?: number;
	/** How long the same non-empty state has to hold before it is taken as the final one. */
	stableMs?: number;
	/** Total time to wait for the results to match the baseline or hold still. */
	timeoutMs?: number;
}

export const SEARCH_SETTLE: Required<SettleOptions> = { pollMs: 500, stableMs: 5_000, timeoutMs: 60_000 };

/**
 * Reads the search results until they are final: they match `baseline`, or show the same non-empty state for
 * `stableMs`. A project created moments ago keeps adding results while its search index builds, so a single read
 * compares a total that is still moving with the baseline and fails a run that would pass a minute later. A state that
 * holds still but differs from the baseline is returned too, for `verifyBaseline` to report: that one is a project that
 * is not in its baseline state, not an index that is still building.
 *
 * An empty or unreadable list never counts as final (the index may have nothing to show yet, or the pager may not have
 * rendered), and neither does a state that keeps changing: after `timeoutMs` it throws a `BaselineStateError` naming
 * what was last seen.
 */
export async function settleSearch(
	scope: Locator,
	baseline: ListingState = SEARCH_BASELINE,
	options: SettleOptions = {}
): Promise<ListingState> {
	const { pollMs, stableMs, timeoutMs } = { ...SEARCH_SETTLE, ...options };
	const started = Date.now();
	let last: ListingState | null = null;
	let since = started;
	let changes = 0;
	let unreadable: BaselineStateError | null = null;
	for (;;) {
		let observed: ListingState | null = null;
		try {
			observed = await observeSearch(scope);
			unreadable = null;
		} catch (error) {
			if (!(error instanceof BaselineStateError)) throw error;
			unreadable = error;
		}
		const now = Date.now();
		if (observed) {
			if (observed.total === baseline.total && observed.rows === baseline.rows) return observed;
			if (!last || last.total !== observed.total || last.rows !== observed.rows) {
				if (last) changes++;
				last = observed;
				since = now;
			} else if (observed.total > 0 && now - since >= stableMs) {
				return observed;
			}
		} else {
			last = null;
			since = now;
		}
		const remaining = started + timeoutMs - now;
		if (remaining <= 0) {
			const seen = unreadable
				? `Its last read failed: ${unreadable.message}`
				: last
					? `It last showed ${last.total} results (${last.rows} cards on its first page) after changing ${changes} time${changes === 1 ? '' : 's'}.`
					: 'It showed nothing.';
			throw new BaselineStateError(
				`The search results did not settle within ${Math.round(timeoutMs / 1000)}s: the total was still changing, empty or unreadable ` +
					`(the baseline expects ${baseline.total} results, ${baseline.rows} cards). ${seen} A project created moments ago has ` +
					`its search index still building: wait for it to finish and run the suite again.`
			);
		}
		await new Promise((resolve) => setTimeout(resolve, Math.min(pollMs, remaining)));
	}
}

/**
 * Checks the first page of the unfiltered search results against their baseline, once they have settled (see
 * `settleSearch`).
 */
export async function verifySearchBaseline(scope: Locator, testInfo: TestInfo, options?: SettleOptions) {
	await verifyBaseline(await settleSearch(scope, SEARCH_BASELINE, options), SEARCH_SUBJECT, testInfo);
}

/** Checks the Users grid against its baseline. */
export async function verifyUsersBaseline(scope: Locator, testInfo: TestInfo) {
	await verifyBaseline(await observeUsers(scope), USERS_SUBJECT, testInfo);
}
