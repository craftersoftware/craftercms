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
const { ThemeProvider, createTheme } = await import('@mui/material/styles');
const { default: SiteTools } = await import('./SiteTools.tsx');
const { components } = await import('../../utils/constants.ts');

const store = configureStore({
	reducer: {
		env: (state = { authoringBase: '/studio' }) => state
	}
});

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
const registered: string[] = [];

afterEach(async () => {
	for (const id of registered.splice(0)) {
		components.delete(id);
	}
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
});

function register(id: string, component: React.ComponentType) {
	components.set(id, component);
	registered.push(id);
}

function tool(id: string, title = 'Audit') {
	return {
		title,
		icon: { class: 'fa' },
		url: 'audit',
		widget: { id }
	};
}

async function renderSiteTools(props: Record<string, unknown>) {
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
						React.createElement(SiteTools, {
							site: 'editorial',
							activeToolId: 'audit',
							openSidebar: false,
							sidebarWidth: 240,
							hideSidebarSiteSwitcher: true,
							hideSidebarLogo: true,
							onWidthChange() {},
							onNavItemClick() {},
							mountMode: 'page',
							tools: [tool('test.Audit')],
							...props
						})
					)
				)
			) as never
		);
	});
	mounted.push({ unmount: () => root.unmount(), host });
	return host;
}

function headings(host: HTMLElement, tag: string) {
	return [...host.querySelectorAll(tag)].map((node) => node.textContent);
}

describe('SiteTools page headings', () => {
	it('uses an h1 for an unresolved tool component in page mode', async () => {
		const host = await renderSiteTools({ tools: [tool('test.Missing')] });
		assert.deepEqual(headings(host, 'h1'), ['Component test.Missing not found.']);
		assert.equal(host.querySelectorAll('main h1').length, 1);
	});

	it('keeps the unresolved tool heading off h1 in dialog mode', async () => {
		const host = await renderSiteTools({ mountMode: 'dialog', tools: [tool('test.Missing')] });
		assert.equal(host.querySelectorAll('h1').length, 0);
		assert.deepEqual(headings(host, 'h2'), ['Component test.Missing not found.']);
	});

	it('does not add a second h1 when the tool supplies one', async () => {
		register('test.Audit', function AuditTool() {
			return React.createElement('h1', null, 'Audit heading');
		});
		const host = await renderSiteTools({});
		assert.deepEqual(headings(host, 'h1'), ['Audit heading']);
	});

	it('gives the loading fallback one hidden h1, replaced by the tool h1', async () => {
		let release: (module: { default: React.ComponentType }) => void;
		const pending = new Promise<{ default: React.ComponentType }>((resolve) => {
			release = resolve;
		});
		register(
			'test.LazyAudit',
			React.lazy(() => pending)
		);
		const host = await renderSiteTools({ tools: [tool('test.LazyAudit', 'Audit')] });
		const loadingHeading = host.querySelector('h1');
		assert.equal(host.querySelectorAll('h1').length, 1);
		assert.equal(loadingHeading?.textContent, 'Audit');
		assert.equal(getComputedStyle(loadingHeading).position, 'absolute');
		assert.ok(host.querySelector('svg'));

		await act(async () => {
			release({
				default: function LoadedAudit() {
					return React.createElement('h1', null, 'Audit loaded');
				}
			});
		});
		assert.deepEqual(headings(host, 'h1'), ['Audit loaded']);
		assert.equal(host.querySelector('svg'), null);
	});
});

describe('SiteTools tab order', () => {
	it('follows the visual layout: skip link, then the sidebar, then the tool content', async () => {
		register('test.Audit', function AuditTool() {
			return React.createElement('button', { type: 'button', id: 'tool-content-button' }, 'Run audit');
		});
		const host = await renderSiteTools({
			openSidebar: true,
			tools: [tool('test.Audit', 'Audit'), { ...tool('test.Audit', 'Logs'), url: 'logs' }]
		});
		// What Tab can reach, in document order: focusable, not tabindex -1, and not inside an inert subtree.
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
		const sidebar = names.indexOf('Audit');
		const content = names.indexOf('Run audit');
		assert.equal(skip, 0, `skip link is first: ${names.join(' | ')}`);
		assert.ok(sidebar > skip, `sidebar follows the skip link: ${names.join(' | ')}`);
		assert.ok(content > sidebar, `content follows the sidebar: ${names.join(' | ')}`);

		const drawer = host.querySelector('nav');
		const main = host.querySelector('main');
		assert.ok(drawer && main);
		assert.ok(drawer.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING, 'nav precedes main in the DOM');
	});

	it('keeps a closed sidebar out of the tab order', async () => {
		register('test.Audit', function AuditTool() {
			return React.createElement('button', { type: 'button' }, 'Run audit');
		});
		const host = await renderSiteTools({ openSidebar: false });
		const docked = host.querySelector('.MuiDrawer-docked');
		assert.ok(docked?.hasAttribute('inert'));
	});
});

describe('SiteTools sidebar spacing', () => {
	it('runs the list to the drawer edges and keeps the inset on the header and footer', async () => {
		const host = await renderSiteTools({ openSidebar: true, hideSidebarLogo: false, footerHtml: 'Footer' });
		const nav = host.querySelector('nav');
		const section = nav?.querySelector('section');
		const header = section?.firstElementChild;
		const list = nav?.querySelector('ul');
		const footer = nav?.querySelector('footer');
		assert.ok(nav && header && list && footer);
		assert.equal(parseFloat(getComputedStyle(nav).paddingTop), 0, 'the drawer body has no padding');
		assert.equal(getComputedStyle(header).paddingTop, '16px');
		assert.equal(getComputedStyle(header).marginBottom, '10px');
		assert.equal(parseFloat(getComputedStyle(list).paddingLeft), 0);
		assert.equal(getComputedStyle(footer).padding, '20px 16px 36px');
	});
});
