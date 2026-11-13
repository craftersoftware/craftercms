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
 * The tooltip needs a wrapper because a disabled button does not fire the mouse events that open it. With a string
 * title and no `describeChild`, MUI would put a permanent aria-label on that generic `<span>`, where aria-label is
 * not allowed. With `describeChild` the span is left unnamed, and each button keeps its own name.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { RawIntlProvider, createIntl } = await import('react-intl');
const { Provider } = await import('react-redux');
const { configureStore } = await import('@reduxjs/toolkit');
const { PreviewBackButton } = await import('./PreviewBackButton.tsx');
const { PreviewForwardButton } = await import('../PreviewForwardButton/PreviewForwardButton.tsx');

// The real createIntl, so a message without an id fails the test instead of getting one made up.
const intl = createIntl({ locale: 'en', messages: {}, onError: () => undefined });

const store = configureStore({
	reducer: {
		sites: (state = { active: 'editorial', byId: {} }) => state,
		previewNavigation: (
			state = { currentUrlPath: '/site/website/index.xml', historyBackStack: [], historyForwardStack: [] }
		) => state
	},
	middleware: (getDefault) => getDefault({ serializableCheck: false, immutableCheck: false })
});

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	await act(async () => {
		for (const { unmount, host } of mounted.splice(0)) {
			unmount();
			host.remove();
		}
	});
});

async function render(element: React.ReactElement) {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	mounted.push({ unmount: () => root.unmount(), host });
	await act(async () => {
		root.render(
			React.createElement(Provider, { store }, React.createElement(RawIntlProvider, { value: intl }, element))
		);
	});
	return host;
}

describe('preview back and forward buttons', () => {
	for (const { name, element } of [
		{ name: 'Back', element: React.createElement(PreviewBackButton) },
		{ name: 'Forward', element: React.createElement(PreviewForwardButton) }
	]) {
		it(`names the ${name} button without naming its wrapper`, async () => {
			const host = await render(element);
			assert.equal(host.querySelector('button')?.getAttribute('aria-label'), name);
			const wrapper = host.querySelector('span');
			assert.equal(wrapper?.getAttribute('title'), name, 'the tooltip kept its text');
			assert.equal(wrapper?.getAttribute('aria-label'), null, 'aria-label is not allowed on a generic element');
		});
	}
});
