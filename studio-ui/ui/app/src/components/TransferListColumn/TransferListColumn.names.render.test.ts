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
 * Transfer-list checkboxes have no FormControlLabel. The header takes the visible column title.
 * Each row takes the visible item title, then its subtitle, and only then a translated Select {name}.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { RawIntlProvider, createIntl } = await import('react-intl');
const { TransferListColumn } = await import('./TransferListColumn.tsx');

const intl = createIntl({ locale: 'en', messages: {}, onError: () => undefined });

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	await act(async () => {
		for (const { unmount, host } of mounted.splice(0)) {
			unmount();
			host.remove();
		}
	});
});

function accessibleName(host: HTMLElement, input: HTMLElement) {
	const labelledBy = input.getAttribute('aria-labelledby');
	if (labelledBy) {
		return labelledBy
			.split(/\s+/)
			.filter(Boolean)
			.map((id) => host.querySelector<HTMLElement>(`[id="${id}"]`)?.textContent ?? '')
			.join(' ')
			.replace(/\s+/g, ' ')
			.trim();
	}
	return input.getAttribute('aria-label') ?? '';
}

async function render(
	title: string | null,
	items: Array<{ id: string | number; title: string; subtitle?: string }> = [
		{ id: 'home', title: 'Home' },
		{ id: 'about', title: 'About' }
	]
) {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	mounted.push({ unmount: () => root.unmount(), host });
	await act(async () => {
		root.render(
			React.createElement(
				RawIntlProvider,
				{ value: intl },
				React.createElement(TransferListColumn, {
					title,
					items,
					checkedList: {},
					inProgressIds: [],
					isAllChecked: false,
					onItemClick() {},
					onCheckAllClicked() {}
				} as never)
			)
		);
	});
	return host;
}

describe('transfer list checkbox names', () => {
	it('names the header from the visible column title and each row from its title', async () => {
		const host = await render('Groups');
		const inputs = host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
		assert.equal(inputs.length, 3);
		assert.equal(accessibleName(host, inputs[0]), 'Groups');
		assert.equal(accessibleName(host, inputs[1]), 'Home');
		assert.equal(accessibleName(host, inputs[2]), 'About');
		for (const input of inputs) {
			assert.equal(input.closest('.MuiCheckbox-root')?.getAttribute('aria-label'), null);
		}
	});

	it('names a title-less header Select all', async () => {
		const host = await render(null);
		const input = host.querySelector<HTMLInputElement>('input[type="checkbox"]');
		assert.ok(input, 'header checkbox');
		assert.equal(input.getAttribute('aria-label'), 'Select all');
	});

	it('names a title-less row from its subtitle, and uses Select {name} only when nothing is visible', async () => {
		const host = await render('Groups', [
			{ id: 7, title: '', subtitle: 'Site editors' },
			{ id: 8, title: '' }
		]);
		const inputs = host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
		assert.equal(inputs.length, 3);
		const labelledBy = inputs[1].getAttribute('aria-labelledby');
		const subtitle = inputs[1].closest('[role="listitem"]')?.querySelector(`[id="${labelledBy}"]`);
		assert.ok(subtitle?.classList.contains('MuiListItemText-secondary'), 'the name is not the visible subtitle');
		assert.equal(subtitle?.textContent?.trim(), 'Site editors');
		assert.equal(inputs[2].getAttribute('aria-label'), 'Select 8');
	});

	it('treats whitespace-only title and subtitle as empty', async () => {
		const host = await render('Groups', [
			{ id: 9, title: ' ', subtitle: 'Sub' },
			{ id: 10, title: ' ', subtitle: '   ' }
		]);
		const inputs = host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
		assert.equal(inputs.length, 3);
		const labelledBy = inputs[1].getAttribute('aria-labelledby');
		const row = inputs[1].closest('[role="listitem"]');
		const subtitle = row?.querySelector(`[id="${labelledBy}"]`);
		assert.ok(subtitle?.classList.contains('MuiListItemText-secondary'), 'the name is not the visible subtitle');
		assert.equal(subtitle?.textContent?.trim(), 'Sub');
		assert.equal(row?.querySelector('.MuiListItemText-primary')?.getAttribute('id'), null);
		assert.equal(inputs[2].getAttribute('aria-label'), 'Select 10');
	});
});
