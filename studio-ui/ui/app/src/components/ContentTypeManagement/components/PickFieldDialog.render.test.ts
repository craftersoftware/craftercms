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

import '../../../../test/stringListDomSetup.mjs';
import '../../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const React = await import('react');
const { createRoot } = await import('react-dom/client');
const { act } = await import('react');
const { RawIntlProvider } = await import('react-intl');
const { ThemeProvider, createTheme } = await import('@mui/material/styles');
const { createTestIntl } = await import('../../../../test/createTestIntl.mjs');
const { PickFieldDialogBody } = await import('./PickFieldDialog.tsx');
const { inputDescriptor } = await import('../descriptors/controls/input.ts');

window.matchMedia = (query: string) =>
	({
		matches: true,
		media: query,
		addEventListener() {},
		removeEventListener() {},
		addListener() {},
		removeListener() {},
		dispatchEvent: () => false
	}) as MediaQueryList;

const intl = createTestIntl();
const theme = createTheme();
const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];

afterEach(async () => {
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
});

describe('PickFieldDialogBody insert guard', () => {
	it('inserts only once for click, click, dblclick on an empty target', async () => {
		const inserts: Array<[string, number]> = [];
		const host = document.createElement('div');
		document.body.appendChild(host);
		const root = createRoot(host);

		await act(async () => {
			root.render(
				React.createElement(
					ThemeProvider,
					{ theme },
					React.createElement(
						RawIntlProvider,
						{ value: intl as never },
						React.createElement(PickFieldDialogBody, {
							open: true,
							type: {
								id: '/component/test',
								name: 'Test',
								description: '',
								type: 'component',
								displayTemplate: '',
								mergeStrategy: '',
								quickCreate: false,
								quickCreatePath: '',
								hasJsController: false,
								fields: {},
								sections: [],
								dataSources: []
							},
							typesFullList: [inputDescriptor],
							typesCurrentList: [],
							onInsert(fieldType: string, position: number) {
								inserts.push([fieldType, position]);
							},
							onClose() {}
						} as never)
					)
				)
			);
		});
		mounted.push({ unmount: () => root.unmount(), host });

		const fieldButton = [...host.querySelectorAll('button, [role="button"]')].find((el) =>
			(el.textContent ?? '').includes('Input')
		);
		assert.ok(fieldButton instanceof HTMLElement, 'expected Input control in the grid');

		await act(async () => {
			fieldButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
			fieldButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
			fieldButton.dispatchEvent(new window.MouseEvent('dblclick', { bubbles: true }));
		});

		assert.deepEqual(inserts, [['input', 0]]);
	});
});
