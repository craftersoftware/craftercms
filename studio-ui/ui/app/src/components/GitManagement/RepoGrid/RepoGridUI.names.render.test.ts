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
 * The Pull, Push and Delete buttons repeat on every repository row, so their names carry the repository name.
 */

import '../../../../test/stringListDomSetup.mjs';
import '../../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const { React, createItemsStore, baseItems, mountTree, unmountAll, act } =
	await import('../../FormsEngine/lib/formItemTestHarness');
const { RepoGridUI } = await import('./RepoGridUI.tsx');

afterEach(() => {
	unmountAll();
});

const repositories = [
	{ name: 'origin', url: 'git@example.com:a.git', fetch: 'f', pushUrl: 'p', branches: ['main'] },
	{ name: 'backup', url: 'git@example.com:b.git', fetch: 'f', pushUrl: 'p', branches: ['main'] }
];

describe('RepoGridUI row button names', () => {
	it('names Pull, Push and Delete for the repository', async () => {
		const host = await mountTree(
			createItemsStore(baseItems()),
			React.createElement(RepoGridUI, {
				repositories,
				disableActions: false,
				onDeleteRemote() {},
				onPullClick() {},
				onPushClick() {}
			} as never)
		);
		const labels = Array.from(host.querySelectorAll('button[aria-label]'), (button) =>
			button.getAttribute('aria-label')
		);
		for (const name of ['origin', 'backup']) {
			for (const verb of ['Pull', 'Push', 'Delete']) assert.ok(labels.includes(`${verb} ${name}`), labels.join(' | '));
		}
		assert.equal(labels.includes('Pull'), false);
		assert.equal(labels.includes('Push'), false);
	});

	it('keeps the repository in the Delete name while the tooltip is open', async () => {
		const host = await mountTree(
			createItemsStore(baseItems()),
			React.createElement(RepoGridUI, {
				repositories,
				disableActions: false,
				onDeleteRemote() {},
				onPullClick() {},
				onPushClick() {}
			} as never)
		);
		const deleteButton = Array.from(host.querySelectorAll<HTMLButtonElement>('button[aria-label]')).find(
			(button) => button.getAttribute('aria-label') === 'Delete origin'
		);
		assert.ok(deleteButton, 'no Delete button named for the repository');
		await act(async () => {
			deleteButton.dispatchEvent(new window.MouseEvent('mouseover', { bubbles: true }));
		});
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 200));
		});
		assert.equal(document.querySelectorAll('[role="tooltip"]').length, 1, 'the tooltip did not open');
		assert.equal(deleteButton.getAttribute('aria-label'), 'Delete origin');
		// A React element title points aria-labelledby at the tooltip, which replaces the button's own name.
		assert.equal(deleteButton.getAttribute('aria-labelledby'), null);
	});
});
