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
const { IntlProvider } = await import('react-intl');
const { Provider } = await import('react-redux');
const { configureStore } = await import('@reduxjs/toolkit');
const { MemoryRouter, Route, Routes } = await import('react-router');
const { ThemeProvider, createTheme } = await import('@mui/material/styles');
const { GlobalAppInternal } = await import('./GlobalApp.tsx');

const store = configureStore({
	reducer: {
		env: (state = { authoringBase: '/studio' }) => state,
		globalNavigation: (
			state = {
				items: [
					{ id: 'home.globalMenu.users', icon: { id: 'craftercms.icons.Users' } },
					{ id: 'home.globalMenu.audit', icon: { id: 'craftercms.icons.Audit' } }
				],
				isFetching: false,
				error: null
			}
		) => state
	}
});

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];

afterEach(async () => {
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
});

// Without a GlobalAppContextProvider the context default is an open sidebar.
async function renderGlobalApp() {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	await act(async () => {
		root.render(
			React.createElement(
				Provider,
				{ store },
				React.createElement(
					IntlProvider,
					{ locale: 'en', messages: {}, onError() {} },
					React.createElement(
						ThemeProvider,
						{ theme: createTheme() },
						React.createElement(
							MemoryRouter,
							{ initialEntries: ['/users'] },
							React.createElement(
								Routes,
								null,
								React.createElement(
									Route,
									{
										path: '/',
										element: React.createElement(GlobalAppInternal, {
											footerHtml: '',
											passwordRequirementsMinComplexity: 0
										})
									},
									React.createElement(Route, {
										path: 'users',
										element: React.createElement('button', { type: 'button' }, 'Create user')
									})
								)
							)
						)
					)
				)
			) as never
		);
	});
	mounted.push({ unmount: () => root.unmount(), host });
	return host;
}

describe('GlobalApp tab order', () => {
	it('follows the visual layout: skip link, then the sidebar, then the page content', async () => {
		const host = await renderGlobalApp();
		const tabbable = [
			...host.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]')
		].filter((node) => {
			const tabIndex = node.getAttribute('tabindex');
			return (
				(tabIndex === null ? node.matches('button, a[href], input, select, textarea') : Number(tabIndex) >= 0) &&
				!node.closest('[inert]')
			);
		});
		const names = tabbable.map((node) => node.textContent?.trim() || node.getAttribute('aria-label'));
		const skip = names.indexOf('Skip to main content');
		const sidebar = names.findIndex((name) => name === 'Users');
		const content = names.indexOf('Create user');
		assert.equal(skip, 0, `skip link is first: ${names.join(' | ')}`);
		assert.ok(sidebar > skip, `sidebar follows the skip link: ${names.join(' | ')}`);
		assert.ok(content > sidebar, `content follows the sidebar: ${names.join(' | ')}`);
	});

	it('puts the sidebar nav before main and keeps the skip link target on main', async () => {
		const host = await renderGlobalApp();
		const nav = host.querySelector('nav');
		const main = host.querySelector('main');
		assert.ok(nav && main);
		assert.ok(nav.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING, 'nav precedes main in the DOM');
		assert.equal(main.id, 'studioMainContent');
		const skip = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Skip to main content');
		assert.ok(skip);
		await act(async () => {
			skip.click();
		});
		assert.equal(document.activeElement, main);
	});
});

describe('GlobalApp sidebar spacing', () => {
	it('insets the nav list to line up with the first Project Tools row, not the drawer', async () => {
		const host = await renderGlobalApp();
		const nav = host.querySelector('nav');
		const list = nav?.querySelector('ul');
		assert.ok(nav && list);
		// Project Tools: 16px drawer padding + 10px header margin = 26px.
		assert.equal(getComputedStyle(list).paddingTop, '26px');
		assert.notEqual(getComputedStyle(nav).paddingTop, '26px', 'the drawer body itself stays unpadded');
	});
});
