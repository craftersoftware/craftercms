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

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';

globalThis.ShadowRoot = window.ShadowRoot;
import { registerHooks } from 'node:module';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

registerHooks({
	load(url, context, nextLoad) {
		if (url.endsWith('/services/workflow.ts')) {
			return {
				format: 'module',
				shortCircuit: true,
				source: `
					export function fetchItemStates() {
						return { subscribe(observer) { observer.next(globalThis.__workflowItems); } };
					}
					export function setItemStates() {
						return { subscribe(observer) { observer.next({}); } };
					}
					export function setItemStatesByQuery(siteId, states, update, path) {
						globalThis.__workflowQueryCalls.push(path);
						return { subscribe(observer) { observer.next({}); } };
					}
				`
			};
		}
		return nextLoad(url, context);
	}
});

const React = await import('react');
const { createRoot } = await import('react-dom/client');
const { act } = await import('react');
const { IntlProvider } = await import('react-intl');
const { Provider } = await import('react-redux');
const { configureStore } = await import('@reduxjs/toolkit');
const { ThemeProvider, createTheme } = await import('@mui/material/styles');
const { WorkflowStateManagement } = await import('./WorkflowStateManagement.tsx');

const store = configureStore({
	reducer: {
		sites: (state = { active: 'editorial' }) => state
	}
});

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];

afterEach(async () => {
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
	globalThis.__workflowQueryCalls = [];
});

function itemPage() {
	const stateMap = {
		new: false,
		modified: false,
		deleted: false,
		locked: false,
		systemProcessing: false,
		submitted: false,
		scheduled: false,
		publishing: false,
		submittedToStaging: false,
		submittedToLive: false,
		staged: false,
		live: false,
		disabled: false,
		translationUpToDate: false,
		translationPending: false,
		translationInProgress: false
	};
	const page = [
		{
			id: 1,
			path: '/site/website/index.xml',
			label: 'Home',
			state: 0,
			systemType: 'page',
			stateMap
		}
	] as Array<Record<string, unknown>> & { total: number; offset: number; limit: number };
	page.total = 2;
	page.offset = 0;
	page.limit = 10;
	return page;
}

async function renderTool() {
	globalThis.__workflowItems = itemPage();
	globalThis.__workflowQueryCalls = [];
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	await act(async () => {
		root.render(
			React.createElement(
				Provider,
				{ store },
				React.createElement(
					IntlProvider,
					{ locale: 'en', messages: {}, onError() {} },
					React.createElement(
						ThemeProvider,
						{ theme: createTheme() },
						React.createElement(WorkflowStateManagement, { embedded: true, showAppsButton: false })
					)
				)
			)
		);
	});
	mounted.push({ unmount: () => root.unmount(), host });
}

async function setPathFilter(value: string) {
	const filters = [...document.querySelectorAll('button')].find((button) => button.textContent?.includes('Filters'));
	await act(async () => {
		filters.click();
	});
	const input = document.querySelector('input[type="text"]') as HTMLInputElement;
	const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
	await act(async () => {
		setter.call(input, value);
		input.dispatchEvent(new window.Event('input', { bubbles: true }));
		input.dispatchEvent(new window.Event('change', { bubbles: true }));
	});
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 450));
	});
}

async function confirmSelectAll() {
	const table = document.querySelector('table');
	const rowCheckbox = table.querySelectorAll('input[type="checkbox"]');
	await act(async () => {
		rowCheckbox[rowCheckbox.length - 1].dispatchEvent(new window.Event('click', { bubbles: true }));
		(rowCheckbox[rowCheckbox.length - 1] as HTMLInputElement).click();
	});
	const selectAll = [...document.querySelectorAll('button')].find((button) =>
		button.textContent?.includes('across pages')
	);
	await act(async () => {
		selectAll.click();
	});
	const edit = [...document.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Edit');
	await act(async () => {
		edit.click();
	});
	const clearNew = [...document.querySelectorAll('label')].find((label) => label.textContent?.includes('Clear new'));
	await act(async () => {
		clearNew.querySelector('input').click();
	});
	const confirm = [...document.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Confirm');
	await act(async () => {
		confirm.click();
	});
}

describe('WorkflowStateManagement select all', () => {
	it('omits a whitespace-only path when updating every item', async () => {
		await renderTool();
		await setPathFilter('   ');
		await confirmSelectAll();

		assert.deepEqual(globalThis.__workflowQueryCalls, [undefined]);
	});

	it('passes a non-blank path filter through', async () => {
		await renderTool();
		await setPathFilter('/site/website/.*');
		await confirmSelectAll();

		assert.deepEqual(globalThis.__workflowQueryCalls, ['/site/website/.*']);
	});
});
