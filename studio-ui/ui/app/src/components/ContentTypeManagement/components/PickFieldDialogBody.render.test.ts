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

/** Controls `useMediaQuery(theme.breakpoints.up('md'))` for the next render. */
let matchMediaMatches = true;

before(() => {
	window.matchMedia = ((query: string) =>
		({
			matches: matchMediaMatches,
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
	matchMediaMatches = true;
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
});

async function renderBody(props: {
	typesCurrentList: Array<{ id: string; title?: string; name?: string }>;
	/** When false, exercises the stepped (!isMdUp) flow. Defaults to true. */
	mdUp?: boolean;
}): Promise<{ host: HTMLElement; inserts: Array<[string, number]> }> {
	matchMediaMatches = props.mdUp ?? true;
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

function footerButton(host: HTMLElement, label: string): HTMLButtonElement {
	const button = [...host.querySelectorAll('button')].find((el) => (el.textContent ?? '').includes(label));
	assert.ok(button instanceof HTMLButtonElement, `expected footer button "${label}"`);
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

const nonEmptyList = [
	{ id: 'a', title: 'Alpha' },
	{ id: 'b', title: 'Beta' }
];

describe('PickFieldDialogBody', () => {
	it('calls onInsert exactly once on Enter when the current list is empty', async () => {
		const { host, inserts } = await renderBody({ typesCurrentList: [] });

		await pressEnter(fieldButton(host));

		assert.deepEqual(inserts, [['input', 0]]);
	});

	it('inserts at the selected position on Enter when the current list is non-empty', async () => {
		const { host, inserts } = await renderBody({
			typesCurrentList: nonEmptyList
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

	it('narrow + non-empty: click or Enter moves to the position step; Accept inserts at the chosen position', async () => {
		const { host, inserts } = await renderBody({ typesCurrentList: nonEmptyList, mdUp: false });

		const button = fieldButton(host);
		await act(async () => {
			button.click();
		});

		assert.deepEqual(inserts, [], 'click must not insert before Accept on the narrow flow');
		assert.ok(footerButton(host, 'Accept'), 'position step shows Accept');
		assert.ok(footerButton(host, 'Back'), 'position step shows Back');

		await act(async () => {
			footerButton(host, 'Back').click();
		});

		await pressEnter(fieldButton(host));

		assert.deepEqual(inserts, [], 'Enter must not insert before Accept on the narrow flow');
		assert.ok(footerButton(host, 'Accept'), 'Enter advances to the position step');

		const first = host.querySelector<HTMLInputElement>('input[type="radio"][value="first"]');
		assert.ok(first);
		await act(async () => {
			first.click();
		});

		await act(async () => {
			footerButton(host, 'Accept').click();
		});

		assert.deepEqual(inserts, [['input', 0]]);
	});

	it('narrow + empty: Enter inserts once', async () => {
		const { host, inserts } = await renderBody({ typesCurrentList: [], mdUp: false });

		await pressEnter(fieldButton(host));

		assert.deepEqual(inserts, [['input', 0]]);
	});

	it('double-click on an empty target inserts once', async () => {
		const { host, inserts } = await renderBody({ typesCurrentList: [] });

		await act(async () => {
			const button = fieldButton(host);
			button.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
			button.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
			button.dispatchEvent(new window.MouseEvent('dblclick', { bubbles: true }));
		});

		assert.deepEqual(inserts, [['input', 0]]);
	});

	it('shows the control id as secondary text in the insert-after select', async () => {
		const { host } = await renderBody({ typesCurrentList: [...nonEmptyList, { id: 'c', title: 'Gamma' }] });

		await act(async () => {
			fieldButton(host).click();
		});

		const combobox = host.querySelector<HTMLElement>('[role="combobox"]');
		assert.ok(combobox, 'expected insert-after select');
		await act(async () => {
			combobox.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, button: 0 }));
		});

		const options = [...document.querySelectorAll('[role="option"]')];
		assert.deepEqual(
			options.map((option) => option.querySelector('p')?.textContent ?? ''),
			['a', 'b']
		);
	});

	it('links the disabled position group to the hint, and drops the link once an item is selected', async () => {
		const { host } = await renderBody({ typesCurrentList: nonEmptyList });

		const group = host.querySelector('[role="radiogroup"]');
		assert.ok(group);
		const hintId = group.getAttribute('aria-describedby');
		assert.ok(hintId, 'expected aria-describedby on the disabled radio group');
		assert.equal(document.getElementById(hintId)?.textContent, 'Select an item to choose its insert position.');
		assert.equal(host.querySelector<HTMLInputElement>('input[type="radio"][value="first"]')?.disabled, true);

		await act(async () => {
			fieldButton(host).click();
		});

		assert.equal(host.querySelector('[role="radiogroup"]')?.hasAttribute('aria-describedby'), false);
		assert.equal(document.getElementById(hintId), null);
	});
});
