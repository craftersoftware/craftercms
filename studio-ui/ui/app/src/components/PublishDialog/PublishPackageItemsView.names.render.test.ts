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

/**
 * A soft dependency that cannot be published keeps "Include {name}" on the checkbox. The tooltip explains why, and
 * it wraps a span because the checkbox can be disabled. Without describeChild an open tooltip names that span.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { RawIntlProvider, createIntl } = await import('react-intl');
const { Provider } = await import('react-redux');
const { configureStore } = await import('@reduxjs/toolkit');
const { PublishPackageItemsView } = await import('./PublishPackageItemsView.tsx');

const intl = createIntl({ locale: 'en', messages: {}, onError: () => undefined });

const store = configureStore({
	reducer: {
		sites: (state = { active: 'editorial' }) => state,
		user: (state = { username: 'ann' }) => state,
		env: (state = { authoringBase: '/studio' }) => state,
		content: (state = { itemsByPath: {} }) => state
	},
	middleware: (getDefault) => getDefault({ serializableCheck: false, immutableCheck: false })
});

const path = '/site/website/index.xml';
const item = { path, label: 'Home', canRequestPublish: false };

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	await act(async () => {
		for (const { unmount, host } of mounted.splice(0)) {
			unmount();
			host.remove();
		}
	});
	window.localStorage.removeItem('craftercms.ann.publishingPackagePreferredView');
});

async function render(view: 'tree' | 'list') {
	window.localStorage.setItem('craftercms.ann.publishingPackagePreferredView', view);
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	mounted.push({ unmount: () => root.unmount(), host });
	await act(async () => {
		root.render(
			React.createElement(
				Provider,
				{ store },
				React.createElement(
					RawIntlProvider,
					{ value: intl },
					React.createElement(PublishPackageItemsView, {
						itemMap: { [path]: item },
						itemsAndDependenciesPaths: [path],
						dependencyTypeMap: { [path]: 'soft' },
						selectedDependenciesPaths: [],
						selectedDependenciesMap: { [path]: false },
						trees: [{ path, children: [] }]
					} as never)
				)
			)
		);
	});
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 30));
	});
	return host;
}

async function openTooltip(span: HTMLElement) {
	await act(async () => {
		span.dispatchEvent(new window.MouseEvent('mouseover', { bubbles: true }));
	});
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 200));
	});
}

describe('publish package include checkbox', () => {
	for (const view of ['tree', 'list'] as const) {
		it(`keeps Include Home and leaves the wrapper unnamed in ${view} view`, async () => {
			const host = await render(view);
			const input = host.querySelector<HTMLInputElement>('input[aria-label="Include Home"]');
			assert.ok(input, `the include checkbox has no name in ${view} view`);
			const root = input.closest<HTMLElement>('.MuiCheckbox-root');
			const wrapper = root?.parentElement;
			assert.equal(wrapper?.tagName, 'SPAN');
			await openTooltip(wrapper);
			assert.equal(document.querySelectorAll('[role="tooltip"]').length, 1, 'the tooltip did not open');
			assert.equal(input.getAttribute('aria-label'), 'Include Home');
			assert.equal(root?.getAttribute('aria-label'), null);
			assert.equal(root?.getAttribute('aria-labelledby'), null);
			assert.equal(wrapper.getAttribute('aria-label'), null);
			assert.equal(wrapper.getAttribute('aria-labelledby'), null);
		});
	}
});
