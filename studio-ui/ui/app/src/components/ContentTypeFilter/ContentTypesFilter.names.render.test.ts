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
 * The content type filter has no visible label. A caller's function list slot is resolved with ownerState,
 * then the list is still named "Content Type".
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
const { ContentTypesFilter } = await import('./ContentTypesFilter.tsx');

const intl = createIntl({ locale: 'en', messages: {}, onError: () => undefined });

const store = configureStore({
	reducer: {
		uiConfig: (state = { xml: null }) => state
	}
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

describe('content type filter names', () => {
	it('keeps a function list slot and still names the open listbox', async () => {
		let ownerState: unknown;
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
						React.createElement(ContentTypesFilter, {
							value: 'all',
							MenuProps: {
								slotProps: {
									list: (state: unknown) => {
										ownerState = state;
										return { 'data-x': 'kept' };
									}
								}
							}
						})
					)
				)
			);
		});
		const combobox = host.querySelector<HTMLElement>('[role="combobox"]');
		assert.ok(combobox, 'the content type combobox is missing');
		await act(async () => {
			combobox.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, button: 0 }));
		});
		const listbox = document.querySelector<HTMLElement>('[role="listbox"]');
		assert.ok(listbox, 'the content type listbox did not open');
		assert.equal(typeof ownerState, 'object');
		assert.ok(ownerState);
		assert.equal((ownerState as { value?: string }).value, 'all');
		assert.equal(listbox.getAttribute('data-x'), 'kept');
		assert.equal(listbox.getAttribute('aria-label'), 'Content Type');
		assert.equal(listbox.hasAttribute('aria-labelledby'), false);
	});
});
