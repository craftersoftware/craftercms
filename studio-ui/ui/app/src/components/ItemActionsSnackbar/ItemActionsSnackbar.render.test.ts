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
 * The selection action row is a list. Every element child of the ul is an li, including each action
 * button and the appended action. A button is not a direct child of the list.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { RawIntlProvider } = await import('react-intl');
const { ThemeProvider, createTheme } = await import('@mui/material/styles');
const { createTestIntl } = await import('../../../test/createTestIntl.mjs');
const { default: ItemActionsSnackbar } = await import('./ItemActionsSnackbar.tsx');

const theme = createTheme();
const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];

afterEach(async () => {
	await act(async () => {
		for (const { unmount, host } of mounted.splice(0)) {
			unmount();
			host.remove();
		}
	});
});

async function render(props: { options: Array<{ id: string; label: string }> | null; append?: React.ReactNode }) {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	mounted.push({ unmount: () => root.unmount(), host });
	await act(async () => {
		root.render(
			React.createElement(
				ThemeProvider,
				{ theme },
				React.createElement(
					RawIntlProvider,
					{ value: createTestIntl() },
					React.createElement(ItemActionsSnackbar, {
						open: true,
						options: props.options as never,
						onActionClicked() {},
						append: props.append
					})
				)
			)
		);
	});
}

function actionList() {
	const list = document.querySelector('ul');
	assert.ok(list, 'the snackbar renders one list');
	return list;
}

describe('ItemActionsSnackbar list', () => {
	it('wraps each action, including the appended one, in a list item', async () => {
		await render({
			options: [
				{ id: 'edit', label: 'Edit' },
				{ id: 'delete', label: 'Delete' }
			],
			append: React.createElement('button', { type: 'button' }, 'Clear')
		});
		const list = actionList();
		const children = Array.from(list.children);
		assert.deepEqual(
			children.map((child) => child.tagName),
			['LI', 'LI', 'LI']
		);
		assert.equal(list.querySelectorAll(':scope > button').length, 0);
		assert.deepEqual(
			children.map((child) => child.textContent),
			['Edit', 'Delete', 'Clear']
		);
		children.forEach((child) => assert.equal(child.querySelectorAll('button').length, 1));
	});

	it('keeps the empty state as a single list item', async () => {
		await render({ options: [] });
		const list = actionList();
		const children = Array.from(list.children);
		assert.equal(children.length, 1);
		assert.equal(children[0].tagName, 'LI');
		assert.ok(children[0].textContent?.includes('No options available'));
		assert.equal(list.querySelector('button'), null);
	});
});
