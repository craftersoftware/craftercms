/*
 * Copyright (C) 2007-2022 Crafter Software Corporation. All Rights Reserved.
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

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const React = await import('react');
const { createRoot } = await import('react-dom/client');
const { act } = await import('react');
const { RawIntlProvider, createIntl } = await import('react-intl');
const { Provider } = await import('react-redux');
const { configureStore } = await import('@reduxjs/toolkit');
const { SelectionList } = await import('./SelectionList.tsx');

const baseIntl = createIntl({ locale: 'en', messages: {}, onError: () => undefined });
const intl = {
	...baseIntl,
	formatMessage: (descriptor: { id?: string; defaultMessage?: string }, values?: Record<string, unknown>) =>
		baseIntl.formatMessage(
			{ ...descriptor, id: descriptor.id ?? String(descriptor.defaultMessage) } as never,
			values as never
		)
};
const store = configureStore({ reducer: { uiConfig: (state = { locale: {} }) => state } as never });

async function render(props: Record<string, unknown>): Promise<HTMLElement> {
	const host = document.createElement('div');
	document.body.appendChild(host);
	await act(async () => {
		createRoot(host).render(
			React.createElement(
				Provider,
				{ store },
				React.createElement(
					RawIntlProvider,
					{ value: intl },
					React.createElement(SelectionList, { title: 'Items', displayItemTitle: true, ...props } as never)
				)
			)
		);
	});
	return host;
}

describe('SelectionList', () => {
	it('toggles through the checkbox when its text is clicked, and keeps the row non-interactive', async () => {
		const clicks: string[] = [];
		const host = await render({
			paths: ['/a.xml', '/b.xml'],
			selectedItems: { '/a.xml': false, '/b.xml': false },
			onItemClicked: (_e: unknown, path: string) => clicks.push(path)
		});
		const boxes = host.querySelectorAll('ul input[type="checkbox"]');
		assert.equal(boxes.length, 2);
		const text = Array.from(host.querySelectorAll('li label')).find((l) => l.textContent === '/b.xml') as HTMLElement;
		await act(async () => text.click());
		assert.deepEqual(clicks, ['/b.xml']);
		assert.equal(host.querySelectorAll('ul li[role="button"], ul li[tabindex], ul li button').length, 0);
		assert.equal(boxes[0].labels?.[0]?.textContent, '/a.xml');
	});

	it('does not toggle disabled rows from their text', async () => {
		const clicks: string[] = [];
		const host = await render({
			paths: ['/a.xml'],
			selectedItems: { '/a.xml': false },
			disabledPaths: { '/a.xml': true },
			onItemClicked: (_e: unknown, path: string) => clicks.push(path)
		});
		await act(async () => (host.querySelector('ul label') as HTMLElement).click());
		assert.deepEqual(clicks, []);
	});

	it('renders no label or checkbox when the list is not selectable', async () => {
		const host = await render({ paths: ['/a.xml'], selectedItems: {} });
		assert.equal(host.querySelectorAll('ul label, ul input').length, 0);
	});
});
