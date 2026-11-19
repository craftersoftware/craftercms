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
const { createTestIntl } = await import('../../../../test/createTestIntl.mjs');
const { InsertPositionPicker } = await import('./InsertPositionPicker.tsx');

const intl = createTestIntl();

const items = [
	{ id: 'a', label: 'Alpha' },
	{ id: 'b', label: 'Beta' },
	{ id: 'c', label: 'Gamma' }
];

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];

afterEach(async () => {
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
});

function checkedRadioValue(host: HTMLElement): string | undefined {
	return host.querySelector<HTMLInputElement>('input[type="radio"]:checked')?.value;
}

async function openSelect(host: HTMLElement) {
	const combobox = host.querySelector<HTMLElement>('[role="combobox"]');
	assert.ok(combobox, 'expected insert-after select');
	await act(async () => {
		combobox.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, button: 0 }));
	});
	assert.ok(document.querySelector('[role="listbox"]'), 'the insert-after listbox did not open');
}

async function renderPicker(props: {
	items?: Array<{ id: string; label: string }>;
	value?: number;
	emptyMode?: 'hide' | 'firstOnly';
	onChange?: (position: number) => void;
}): Promise<{ host: HTMLElement; positions: number[] }> {
	const positions: number[] = [];
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);

	function Harness() {
		const [value, setValue] = React.useState(props.value ?? (props.items ?? items).length);
		return React.createElement(InsertPositionPicker, {
			items: props.items ?? items,
			value,
			emptyMode: props.emptyMode,
			afterSelectLabel: 'Control to insert after',
			onChange(next: number) {
				positions.push(next);
				setValue(next);
				props.onChange?.(next);
			}
		});
	}

	await act(async () => {
		root.render(React.createElement(RawIntlProvider, { value: intl as never }, React.createElement(Harness)));
	});
	mounted.push({ unmount: () => root.unmount(), host });
	return { host, positions };
}

describe('InsertPositionPicker', () => {
	it('defaults to Insert last when value is the list length', async () => {
		const { host } = await renderPicker({ value: items.length });
		assert.equal(checkedRadioValue(host), 'last');
		assert.match(host.textContent ?? '', /Position/);
		assert.match(host.textContent ?? '', /Insert last/);
	});

	it('reports splice index 0 for Insert first and length for Insert last', async () => {
		const { host, positions } = await renderPicker({ value: items.length });

		const first = host.querySelector<HTMLInputElement>('input[type="radio"][value="first"]');
		assert.ok(first);
		await act(async () => {
			first.click();
		});
		assert.deepEqual(positions, [0]);
		assert.equal(checkedRadioValue(host), 'first');

		const last = host.querySelector<HTMLInputElement>('input[type="radio"][value="last"]');
		assert.ok(last);
		await act(async () => {
			last.click();
		});
		assert.deepEqual(positions, [0, items.length]);
		assert.equal(checkedRadioValue(host), 'last');
	});

	it('lists every item except the last in the select, and choosing one selects Insert after', async () => {
		const { host, positions } = await renderPicker({ value: items.length });

		await openSelect(host);
		const options = [...document.querySelectorAll('[role="option"]')].map((option) => option.textContent ?? '');
		assert.equal(options.length, items.length - 1);
		assert.ok(options.some((text) => text.includes('Alpha') && text.includes('a')));
		assert.ok(options.some((text) => text.includes('Beta') && text.includes('b')));
		assert.equal(
			options.some((text) => text.includes('Gamma')),
			false
		);

		const beta = [...document.querySelectorAll('[role="option"]')].find((option) =>
			(option.textContent ?? '').includes('Beta')
		);
		assert.ok(beta instanceof HTMLElement);
		await act(async () => {
			beta.click();
		});

		assert.deepEqual(positions, [2]); // after index 1 (Beta)
		assert.equal(checkedRadioValue(host), 'after');
	});

	it('checks Insert after when value is a mid-list splice index', async () => {
		const { host } = await renderPicker({ value: 1 }); // after Alpha
		assert.equal(checkedRadioValue(host), 'after');
	});

	it('renders nothing for an empty list with emptyMode hide', async () => {
		const { host } = await renderPicker({ items: [], value: 0, emptyMode: 'hide' });
		assert.equal(host.textContent?.trim() ?? '', '');
		assert.equal(host.querySelector('input[type="radio"]'), null);
	});

	it('shows only Insert first for an empty list with emptyMode firstOnly', async () => {
		const { host } = await renderPicker({ items: [], value: 0, emptyMode: 'firstOnly' });
		assert.equal(checkedRadioValue(host), 'first');
		assert.equal(host.querySelector('input[type="radio"][value="after"]'), null);
		assert.equal(host.querySelector('input[type="radio"][value="last"]'), null);
		assert.equal(host.querySelector('[role="combobox"]'), null);
	});
});
