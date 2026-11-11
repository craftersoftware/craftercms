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

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const React = await import('react');
const { createRoot } = await import('react-dom/client');
const { act } = await import('react');
const { RawIntlProvider } = await import('react-intl');
const { createTestIntl } = await import('../../../test/createTestIntl.mjs');
const { ThemeProvider, createTheme } = await import('@mui/material/styles');
const { default: Accordion } = await import('@mui/material/Accordion');
const { PathNavigatorHeader } = await import('./PathNavigatorHeader.tsx');

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
});

async function render(props: Record<string, unknown>, intl = createTestIntl()) {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	await act(async () => {
		root.render(
			React.createElement(
				RawIntlProvider,
				{ value: intl },
				React.createElement(
					ThemeProvider,
					{ theme: createTheme() },
					React.createElement(
						Accordion,
						null,
						React.createElement(PathNavigatorHeader, {
							locale: 'en',
							title: 'Pages',
							collapsed: false,
							onLanguageMenu() {},
							onMenuButtonClick() {},
							...props
						} as never)
					)
				)
			) as never
		);
	});
	mounted.push({ unmount: () => root.unmount(), host });
	return host;
}

function labels(host: HTMLElement) {
	return [...host.querySelectorAll('button[aria-label]')].map((button) => button.getAttribute('aria-label'));
}

describe('PathNavigatorHeader button names', () => {
	it('names the language and options buttons with the navigator title', async () => {
		const host = await render({});
		assert.deepEqual(labels(host), ['Language', 'Pages options']);
	});

	it('uses the translated messages', async () => {
		const intl = createTestIntl({
			locale: 'es',
			messages: { 'words.language': 'Idioma', 'pathNavigator.headerOptions': '{title}: opciones' }
		});
		const host = await render({ title: 'Paginas' }, intl);
		assert.deepEqual(labels(host), ['Idioma', 'Paginas: opciones']);
	});

	it('falls back to plain Options when the title is not text', async () => {
		const host = await render({ title: React.createElement('em', null, 'Pages') });
		assert.deepEqual(labels(host), ['Language', 'Options']);
	});

	it('renders only the buttons that have a handler', async () => {
		const host = await render({ onLanguageMenu: undefined });
		assert.deepEqual(labels(host), ['Pages options']);
	});
});
