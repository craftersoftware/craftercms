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
 * The empty state of the drop targets panel is a translated message, not literal English.
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
const { PreviewDropTargetsPanel } = await import('./PreviewDropTargetsPanel.tsx');

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	await act(async () => {
		for (const { unmount, host } of mounted.splice(0)) {
			unmount();
			host.remove();
		}
	});
});

async function render(
	messages: Record<string, string>,
	{
		allowed = {},
		contentTypes = {}
	}: { allowed?: Record<string, boolean>; contentTypes?: Record<string, unknown> } = {}
) {
	const store = configureStore({
		reducer: {
			preview: (state = { dropTargets: null, editMode: false, guest: { allowedContentTypes: allowed } }) => state,
			contentTypes: (state = { byId: contentTypes, isFetching: false }) => state
		},
		middleware: (getDefault) => getDefault({ serializableCheck: false, immutableCheck: false })
	});
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	mounted.push({ unmount: () => root.unmount(), host });
	// The real createIntl, so a message without an id fails the test.
	const intl = createIntl({ locale: 'es', messages, onError: () => undefined });
	await act(async () => {
		root.render(
			React.createElement(
				Provider,
				{ store },
				React.createElement(RawIntlProvider, { value: intl }, React.createElement(PreviewDropTargetsPanel))
			)
		);
	});
	return host;
}

describe('PreviewDropTargetsPanel empty state', () => {
	it('shows the default message when there is no translation', async () => {
		const host = await render({});
		assert.ok(host.textContent?.includes('No drop targets were found on the current view.'));
	});

	it('shows the translated message', async () => {
		const host = await render({ '/xPSui': 'No se encontraron zonas de colocación en la vista actual.' });
		assert.ok(host.textContent?.includes('No se encontraron zonas de colocación en la vista actual.'));
		assert.equal(host.textContent?.includes('No drop targets'), false);
	});
});

describe('PreviewDropTargetsPanel compatible types', () => {
	it('lists the compatible types as buttons in a labelled list, with the subheader inside the list', async () => {
		const host = await render(
			{},
			{
				allowed: { '/component/a': true, '/component/b': true },
				contentTypes: {
					'/component/a': { id: '/component/a', name: 'Article', type: 'component' },
					'/component/b': { id: '/component/b', name: 'Banner', type: 'component' }
				}
			}
		);
		const lists = host.querySelectorAll('ul');
		assert.equal(lists.length, 1);
		const list = lists[0];
		const subheader = list.querySelector(':scope > li.MuiListSubheader-root') as HTMLElement;
		assert.equal(subheader.textContent, 'Compatible types');
		assert.equal(list.getAttribute('aria-labelledby'), subheader.id);
		const items = Array.from(list.querySelectorAll(':scope > li:not(.MuiListSubheader-root)'));
		assert.equal(items.length, 2);
		items.forEach((item) => assert.equal(item.querySelectorAll(':scope > .MuiListItemButton-root').length, 1));
		assert.equal(host.querySelectorAll('li').length, 3, 'every li is a direct child of the list');
	});
});
