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
const { SectionInsertionDialogBody } = await import('./SectionInsertionDialog.tsx');

const intl = createTestIntl();

const type = {
	id: '/component/test',
	name: 'Test',
	fields: {},
	dataSources: [],
	sections: [
		{ id: 'V1StGXR8_Z5jdHi6B-myT', title: 'First', fields: [], expandedByDefault: true },
		{ id: 'xcoDi2w_6Hn0kVbJfLq4a', title: 'Second', fields: [], expandedByDefault: true },
		{ id: 'p9Qm3zLw8TnYb1cRsUe7K', title: 'Third', fields: [], expandedByDefault: true }
	]
} as never;

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];

afterEach(async () => {
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
});

describe('SectionInsertionDialogBody', () => {
	it('lists section titles in the insert-after dropdown without their generated ids', async () => {
		const host = document.createElement('div');
		document.body.appendChild(host);
		const root = createRoot(host);
		await act(async () => {
			root.render(
				React.createElement(
					RawIntlProvider,
					{ value: intl as never },
					React.createElement(SectionInsertionDialogBody, { open: true, type, onInsertSection() {}, onClose() {} })
				)
			);
		});
		mounted.push({ unmount: () => root.unmount(), host });

		const combobox = host.querySelector<HTMLElement>('[role="combobox"]');
		assert.ok(combobox, 'expected insert-after select');
		await act(async () => {
			combobox.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, button: 0 }));
		});

		const options = [...document.querySelectorAll('[role="option"]')];
		assert.deepEqual(
			options.map((option) => option.textContent ?? ''),
			['First', 'Second']
		);
		assert.equal(document.querySelector('[role="option"] p'), null);
	});
});
