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
import { afterEach, before, describe, it } from 'node:test';

const React = await import('react');
const { createRoot } = await import('react-dom/client');
const { act } = await import('react');
const { RawIntlProvider } = await import('react-intl');
const { ThemeProvider, createTheme } = await import('@mui/material/styles');
const { createTestIntl } = await import('../../../../test/createTestIntl.mjs');
const { PickFieldDialogBody } = await import('./PickFieldDialog.tsx');
const { inputDescriptor } = await import('../descriptors/controls/input.ts');

const intl = createTestIntl();
const theme = createTheme();

const type = {
	id: '/component/test',
	name: 'Test',
	fields: {},
	dataSources: [],
	sections: []
} as never;

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];

before(() => {
	// useMediaQuery(theme.breakpoints.up('md')) — treat the viewport as wide enough for side-by-side layout.
	window.matchMedia = ((query: string) =>
		({
			matches: true,
			media: query,
			onchange: null,
			addListener() {},
			removeListener() {},
			addEventListener() {},
			removeEventListener() {},
			dispatchEvent() {
				return false;
			}
		}) as MediaQueryList) as typeof window.matchMedia;
});

afterEach(async () => {
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
});

async function renderBody(props: {
	typesCurrentList: Array<{ id: string; title?: string; name?: string }>;
}): Promise<{ host: HTMLElement; inserts: Array<[string, number]> }> {
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
						type,
						typesFullList: [inputDescriptor],
						typesCurrentList: props.typesCurrentList as never,
						onInsert(fieldType: string, position: number) {
							inserts.push([fieldType, position]);
						},
						onClose() {}
					})
				)
			)
		);
	});

	mounted.push({ unmount: () => root.unmount(), host });
	return { host, inserts };
}

function fieldButton(host: HTMLElement): HTMLElement {
	const button = [...host.querySelectorAll<HTMLElement>('[role="button"]')].find((el) =>
		(el.textContent ?? '').includes('Input')
	);
	assert.ok(button, 'expected a field list button for Input');
	return button;
}

async function pressEnter(el: HTMLElement) {
	await act(async () => {
		el.focus();
		el.dispatchEvent(
			new window.KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true })
		);
	});
}

describe('PickFieldDialogBody', () => {
	it('calls onInsert exactly once on Enter when the current list is empty', async () => {
		const { host, inserts } = await renderBody({ typesCurrentList: [] });

		await pressEnter(fieldButton(host));

		assert.deepEqual(inserts, [['input', 0]]);
	});

	it('inserts at the selected position on Enter when the current list is non-empty', async () => {
		const { host, inserts } = await renderBody({
			typesCurrentList: [
				{ id: 'a', title: 'Alpha' },
				{ id: 'b', title: 'Beta' }
			]
		});

		const button = fieldButton(host);
		await act(async () => {
			button.click();
		});

		const first = host.querySelector<HTMLInputElement>('input[type="radio"][value="first"]');
		assert.ok(first);
		await act(async () => {
			first.click();
		});

		await pressEnter(button);

		assert.deepEqual(inserts, [['input', 0]]);
	});
});
