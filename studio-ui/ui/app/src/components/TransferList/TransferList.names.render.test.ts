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
 * The add and remove buttons are named. Their tooltips are React elements, and a disabled button sits in a span so
 * the tip can still open. Without describeChild an open tooltip puts aria-labelledby on that span.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { RawIntlProvider, createIntl } = await import('react-intl');
const { TransferList } = await import('./TransferList.tsx');

const intl = createIntl({ locale: 'en', messages: {}, onError: () => undefined });

const column = {
	title: 'Source',
	items: [],
	checkedList: {},
	inProgressIds: [],
	filterKeyword: '',
	setFilterKeyword() {},
	onItemClick() {}
};

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	await act(async () => {
		for (const { unmount, host } of mounted.splice(0)) {
			unmount();
			host.remove();
		}
	});
});

async function render(disableAdd: boolean) {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	mounted.push({ unmount: () => root.unmount(), host });
	await act(async () => {
		root.render(
			React.createElement(
				RawIntlProvider,
				{ value: intl },
				React.createElement(TransferList, {
					source: column,
					target: { ...column, title: 'Target' },
					inProgressIds: [],
					disableAdd,
					disableRemove: true,
					addToTarget() {},
					removeFromTarget() {}
				} as never)
			)
		);
	});
	return host;
}

describe('transfer list move button names', () => {
	it('names the buttons and leaves their wrappers unnamed while the tooltip is open', async () => {
		const host = await render(true);
		const add = host.querySelector<HTMLButtonElement>('button[aria-label="Add to target"]');
		assert.ok(add, 'the add button has no name');
		const span = add.parentElement;
		assert.equal(span?.tagName, 'SPAN');
		await act(async () => {
			span.dispatchEvent(new window.MouseEvent('mouseover', { bubbles: true }));
		});
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 200));
		});
		assert.equal(document.querySelectorAll('[role="tooltip"]').length, 1, 'the tooltip did not open');
		assert.equal(add.getAttribute('aria-label'), 'Add to target');
		assert.equal(add.getAttribute('aria-labelledby'), null);
		assert.equal(span.getAttribute('aria-label'), null);
		assert.equal(span.getAttribute('aria-labelledby'), null);
		assert.ok(host.querySelector('button[aria-label="Remove from target"]'));
	});
});
