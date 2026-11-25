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
 * The Existing Content type filter is an outlined MUI Select. Its visible label ("Content Type") is the accessible
 * name, via the Select's labelId.
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
const { PreviewBrowseComponentsPanel } = await import('./PreviewBrowseComponentsPanel.tsx');

const intl = createIntl({ locale: 'en', messages: {}, onError: () => undefined });

const store = configureStore({
	reducer: {
		sites: (state = { active: null }) => state,
		contentTypes: (state = { byId: {}, isFetching: false }) => state,
		preview: (
			state = {
				editMode: true,
				guest: null,
				components: {
					page: {},
					pageNumber: 0,
					byId: {},
					contentTypeFilter: 'compatible',
					query: { keywords: '', offset: 0, limit: 10 },
					error: null,
					isFetching: false,
					count: 0
				}
			}
		) => state
	},
	middleware: (getDefault) => getDefault({ serializableCheck: false, immutableCheck: false })
});

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	await act(async () => {
		for (const { unmount, host } of mounted.splice(0)) {
			unmount();
			host.remove();
		}
	});
});

describe('existing content type filter name', () => {
	it('names the content type combobox with the visible Content Type label', async () => {
		const host = document.createElement('div');
		document.body.appendChild(host);
		const root = createRoot(host);
		mounted.push({ unmount: () => root.unmount(), host });
		await act(async () => {
			root.render(
				React.createElement(
					Provider,
					{ store },
					React.createElement(RawIntlProvider, { value: intl }, React.createElement(PreviewBrowseComponentsPanel))
				)
			);
		});
		const combobox = host.querySelector<HTMLElement>('.MuiSelect-outlined[role="combobox"]');
		assert.ok(combobox, 'the content type combobox is missing');
		const labelId = combobox.getAttribute('aria-labelledby');
		assert.ok(labelId, 'the content type combobox has no label');
		const label = host.querySelector<HTMLElement>(`[id="${labelId}"]`);
		assert.equal(label?.textContent, 'Content Type');
	});
});
