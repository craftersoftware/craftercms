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

import { expect, Locator, Page } from '@playwright/test';

/** Markup Studio renders while a panel, list or form is still loading (see `LoadingState`). */
const LOADING_INDICATORS = '[role="progressbar"], .MuiSkeleton-root, svg[viewBox="0 0 264 202"]';

/**
 * Studio's transient notifications. They are app-level and outlive the screen that raised them, so they would otherwise
 * be attributed to whichever screen happens to be scanned next.
 */
const NOTIFICATIONS = '.notistack-SnackbarContainer';

/** Thrown when a screen can't be shown to be ready, so a scan is never reported against a screen that never rendered. */
export class NotReadyError extends Error {
	constructor(screen: string, detail: string) {
		super(`${screen} was not ready to scan: ${detail}`);
		this.name = 'NotReadyError';
	}
}

/**
 * What a screen shows once its data has arrived: its loaded content, or its explicit empty state. Both are scoped to
 * the screen itself, never to a shell (a dialog frame, a panel header, a Back button) that renders before the data.
 */
export interface ReadyState {
	loaded: Locator;
	empty?: Locator;
	/** Studio's error state for the screen. It ends the wait, then fails it: an error screen is not the screen. */
	error?: Locator;
}

/** `ApiResponseErrorState` / `ErrorState` title: "Error", optionally followed by the response code. */
export const errorState = (scope: Locator) => scope.getByRole('heading', { level: 3, name: /^Error\b/ });

/**
 * Waits for a screen to be ready to scan. Every wait fails the test with a `NotReadyError` naming the screen instead of
 * letting a scan run against a loading, half-rendered, errored or already-notified state; there is no best-effort mode.
 *
 * Studio keeps long-lived connections open, so `networkidle` is not used: it is never a signal that the UI rendered.
 * @param screen Screen name, used in failure messages.
 * @param ready The screen's own loaded, empty and error states.
 */
export async function settle(page: Page, screen: string, ready: ReadyState, timeout = 20_000) {
	const terminal = [ready.empty, ready.error].reduce<Locator>(
		(any, state) => (state ? any.or(state) : any),
		ready.loaded
	);
	try {
		await expect(terminal.first(), `${screen} content did not render`).toBeVisible({ timeout });
		await expect(page.locator(LOADING_INDICATORS).filter({ visible: true }), `${screen} is still loading`).toHaveCount(
			0,
			{ timeout }
		);
		// Notifications auto-dismiss after a few seconds; waiting them out keeps the scan on the screen itself.
		await expect(page.locator(NOTIFICATIONS), `${screen} never settled: a notification is still up`).toHaveCount(0, {
			timeout
		});
		// The content must still be there once loading is over (a refresh can replace it with a loader, then an error).
		await expect(terminal.first(), `${screen} content went away while loading`).toBeVisible({ timeout });
	} catch (error) {
		throw new NotReadyError(screen, error instanceof Error ? error.message.split('\n')[0] : String(error));
	}
	if (ready.error && (await ready.error.first().isVisible())) {
		throw new NotReadyError(screen, `it shows an error state ("${(await ready.error.first().innerText()).trim()}")`);
	}
}

/** The Unpublished Work dashlet with its rows, or its empty message. Used by the dashboard and the tools panel Dashboard. */
export function dashboardReady(scope: Locator): ReadyState {
	const dashlet = scope.locator('.MuiCard-root').filter({ hasText: 'Unpublished Work' });
	return {
		loaded: dashlet.locator('ul .MuiListItemButton-root'),
		empty: dashlet.getByText('There are no unpublished items', { exact: true }),
		error: errorState(dashlet)
	};
}

/** The project tools list, as shown by Project Tools and the tools panel's Project Tools dialog. */
export function siteToolsReady(scope: Locator): ReadyState {
	return { loaded: scope.getByRole('menu'), error: errorState(scope) };
}

type Destination = { kind: 'page' | 'dialog'; ready: (body: Locator) => ReadyState };

// A Studio "No results found." message; some panels render it with a leading space.
const noResults = (body: Locator) => body.getByText(/^\s*No results found\.?$/);

/**
 * Every top level destination of the tools panels in the Website Editorial blueprint's `ui.xml`, with the state that
 * shows its data has arrived. `page` destinations open in the panel behind a Back button; `dialog` ones open a dialog.
 */
const destinations: Record<string, Destination> = {
	// Tools panel.
	Dashboard: { kind: 'dialog', ready: dashboardReady },
	'Project Tools': { kind: 'dialog', ready: siteToolsReady },
	// Edit mode tools panel.
	Search: { kind: 'page', ready: (body) => ({ loaded: body.locator('ul li'), empty: noResults(body) }) },
	'Create Content': {
		kind: 'page',
		ready: (body) => ({
			loaded: body.getByText('Compatible Types', { exact: true }),
			empty: body.getByText('No compatible types were found.', { exact: true })
		})
	},
	'Existing Content': { kind: 'page', ready: (body) => ({ loaded: body.locator('ul li'), empty: noResults(body) }) },
	'Drop Targets': {
		kind: 'page',
		ready: (body) => ({
			loaded: body.getByText('Select content type to view the available drop targets for it', { exact: true }),
			empty: body.getByText('No drop targets were found on the current view.', { exact: true })
		})
	},
	Assets: { kind: 'page', ready: (body) => ({ loaded: body.locator('.MuiCard-root'), empty: noResults(body) }) },
	'Audience Targeting': {
		kind: 'page',
		ready: (body) => ({
			loaded: body.getByRole('button', { name: 'Apply', exact: true }),
			empty: body.getByText('Audience targeting has not been configured.', { exact: true })
		})
	},
	'Page Explorer': {
		kind: 'page',
		ready: (body) => ({ loaded: body.getByText('Current Content Items', { exact: true }) })
	},
	'Device Simulator': {
		kind: 'page',
		ready: (body) => ({ loaded: body.getByRole('spinbutton', { name: 'Width' }) })
	},
	Settings: {
		kind: 'page',
		ready: (body) => ({ loaded: body.getByText('Enable/disable keyboard shortcuts', { exact: true }) })
	}
};

/**
 * Where a tools panel button leads, and how to tell that it has loaded. The state is scoped to the destination that was
 * opened: the panel page whose header is titled `label`, or the dialog whose header is. A destination with no contract
 * throws, so a new panel button can't be scanned on a guess.
 */
export function panelDestination(page: Page, panel: Locator, label: string, screen: string) {
	const destination = destinations[label];
	if (!destination) throw new NotReadyError(screen, `no readiness contract for the "${label}" destination`);
	const title = page.getByRole('heading', { level: 2, name: label, exact: true });
	const root =
		destination.kind === 'dialog'
			? page.getByRole('dialog').filter({ has: title })
			: // ToolPanel renders `<header>` (Back, title) then a divider and the page `<section>`.
				panel.locator('header').filter({ has: title }).locator('xpath=following-sibling::section[1]');
	const ready = destination.ready(root);
	return { kind: destination.kind, ready: { ...ready, error: ready.error ?? errorState(root) } };
}
