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
 * Each row takes the visible item title.
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

async function render(title: string | null) {
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
					items: [
						{ id: 'home', title: 'Home' },
						{ id: 'about', title: 'About' }
					],
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
});
