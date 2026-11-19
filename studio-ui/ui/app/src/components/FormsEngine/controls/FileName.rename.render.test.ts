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
 * The Page URL pencil is the rename action. It is shown only when the current item has the rename bit,
 * which is granted by content_move.
 */

import '../../../../test/stringListDomSetup.mjs';
import '../../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { RawIntlProvider } = await import('react-intl');
const { createTestIntl } = await import('../../../../test/createTestIntl.mjs');
const intl = createTestIntl();
const { Provider } = await import('react-redux');
const { configureStore } = await import('@reduxjs/toolkit');
const { atom, createStore, Provider: JotaiProvider } = await import('jotai');
const { createChangedFieldIdsAtom } = await import('../lib/formUtils.tsx');
const { createFormVisibilityAtoms } = await import('../lib/formVisibility.ts');
const { FormsEngineFormContextApi, FormItemKeyContext, ItemMetaContext, StableFormContext, StableGlobalContext } =
	await import('../lib/formsEngineContext.ts');
const { FileName } = await import('./FileName.tsx');

window.matchMedia = (query: string) =>
	({
		matches: false,
		media: query,
		addEventListener() {},
		removeEventListener() {},
		addListener() {},
		removeListener() {},
		dispatchEvent: () => false
	}) as MediaQueryList;

const path = '/site/website/about/index.xml';
const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];

afterEach(() => {
	for (const entry of mounted.splice(0)) {
		act(() => entry.unmount());
		entry.host.remove();
	}
});

async function renderPencil(rename: boolean) {
	const store = configureStore({
		reducer: {
			content: (
				state = {
					itemsByPath: {
						[path]: { path, availableActionsMap: { rename } }
					}
				}
			) => state
		}
	});
	const validation = atom({ isValid: true, messages: [] });
	const stable = {
		atoms: {
			valueByFieldId: { 'file-name': atom('about'), 'internal-name': atom('About') },
			validationByFieldId: { 'file-name': validation },
			fileName: atom('about'),
			...createFormVisibilityAtoms()
		},
		changedFieldIds: createChangedFieldIdsAtom(),
		fieldUpdates$: null,
		itemMeta: null,
		originalValues: {},
		props: null,
		state: null,
		affectedPluginControlFields: [],
		formControllerState: null,
		getItem: () => null
	};
	const field = {
		id: 'file-name',
		name: 'Page URL',
		type: 'file-name',
		description: '',
		helpText: '',
		validations: {},
		properties: {},
		defaultValue: ''
	};
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	await act(async () => {
		root.render(
			React.createElement(
				Provider,
				{ store },
				React.createElement(
					RawIntlProvider,
					{ value: intl as never },
					React.createElement(
						JotaiProvider,
						{ store: createStore() },
						React.createElement(
							StableGlobalContext.Provider,
							{ value: { formsStackData: [], api: {} } },
							React.createElement(
								StableFormContext.Provider,
								{ value: stable },
								React.createElement(
									FormItemKeyContext.Provider,
									{ value: path },
									React.createElement(
										ItemMetaContext.Provider,
										{
											value: {
												sourceMap: null,
												path,
												pathInSite: '/site/website/about',
												contentType: { id: '/page/entry', type: 'page', fields: {}, sections: [] }
											}
										},
										React.createElement(
											FormsEngineFormContextApi.Provider,
											{ value: { rollbackField() {} } },
											React.createElement(FileName, {
												field,
												value: 'about',
												setValue() {},
												contentType: { id: '/page/entry', type: 'page', fields: {}, sections: [] },
												readonly: false,
												autoFocus: false
											})
										)
									)
								)
							)
						)
					)
				)
			)
		);
	});
	mounted.push({ unmount: () => root.unmount(), host });
	return host;
}

const pencil = (host: HTMLElement) => host.querySelector('[data-testid="EditOutlinedIcon"]');

describe('Page URL pencil', () => {
	it('is hidden unless the item has the rename bit', async () => {
		const hidden = await renderPencil(false);
		assert.equal(pencil(hidden), null);
		act(() => mounted.splice(0).forEach((entry) => entry.unmount()));

		const shown = await renderPencil(true);
		assert.ok(pencil(shown));
	});
});
