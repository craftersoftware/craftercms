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
const { Provider } = await import('react-redux');
const { configureStore } = await import('@reduxjs/toolkit');
const { ThemeProvider, createTheme } = await import('@mui/material/styles');
const { PathNavigatorTreeUI } = await import('../PathNavigatorTree/PathNavigatorTreeUI.tsx');
const { PathNavigatorUI } = await import('./PathNavigatorUI.tsx');
const { NavigatorTitleComponentContext, getNestedHeadingComponent, useNavigatorTitleComponent } =
	await import('./navigatorHeading.ts');
const { ToolsPanelPage } = await import('../ToolsPanelPage/ToolsPanelPage.tsx');
const { WidgetsAccordion } = await import('../WidgetsAccordion/WidgetsAccordion.tsx');
const { components } = await import('../../utils/constants.ts');

const intl = createTestIntl();

const store = configureStore({
	reducer: {
		sites: (state = { active: 'editorial', byId: { editorial: { id: 'editorial', uuid: 'site-uuid' } } }) => state,
		user: (state = { username: 'admin', rolesBySite: { editorial: ['admin'] } }) => state
	}
});

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	components.delete('craftercms.components.PathNavigatorTree');
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
});

function StubNavigator(props: { label?: string; titleComponent?: 'h2' | 'h3' | 'h4' | 'h5' | 'h6' }) {
	const level = useNavigatorTitleComponent(props.titleComponent);
	return React.createElement(level, null, props.label ?? 'Pages');
}

async function render(node: React.ReactNode) {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	await act(async () => {
		root.render(
			React.createElement(
				Provider,
				{ store },
				React.createElement(
					RawIntlProvider,
					{ value: intl },
					React.createElement(ThemeProvider, { theme: createTheme() }, node)
				)
			) as never
		);
	});
	mounted.push({ unmount: () => root.unmount(), host });
	return host;
}

const treeCallbacks = {
	onIconClick() {},
	onLabelClick() {},
	onChangeCollapsed() {},
	onOpenItemMenu() {},
	onHeaderButtonClick() {},
	onFilterChange() {},
	onMoreClick() {}
};

function renderTree(props: Record<string, unknown> = {}) {
	return render(
		React.createElement(PathNavigatorTreeUI, {
			title: 'Pages',
			rootPath: '/site/website',
			isRootPathMissing: true,
			itemsByPath: {},
			keywordByPath: {},
			totalByPath: {},
			childrenByParentPath: {},
			errorByPath: {},
			isCollapsed: false,
			expandedNodes: [],
			...treeCallbacks,
			...props
		})
	);
}

function headingTag(host: HTMLElement) {
	return host.querySelector('.MuiAccordion-heading')?.tagName;
}

describe('navigator title heading level', () => {
	it('defaults the tree and list navigator titles to h2', async () => {
		const tree = await renderTree();
		assert.equal(headingTag(tree), 'H2');
		assert.equal(tree.querySelector('.MuiAccordion-heading')?.textContent, 'Pages');

		const list = await render(
			React.createElement(PathNavigatorUI, {
				title: 'Static Assets',
				itemsByPath: {},
				keyword: '',
				state: {
					id: 'assets',
					rootPath: '/static-assets',
					currentPath: '/static-assets',
					localeCode: 'en',
					keyword: '',
					isSelectMode: false,
					hasClipboard: false,
					levelDescriptor: undefined,
					itemsInPath: [],
					breadcrumb: [],
					selectedItems: [],
					total: 0,
					limit: 10,
					offset: 0,
					collapsed: false,
					isFetching: false,
					error: null,
					isRootPathMissing: true,
					sortStrategy: undefined,
					order: undefined
				},
				onChangeCollapsed() {},
				onBreadcrumbSelected() {},
				onPathSelected() {}
			})
		);
		assert.equal(headingTag(list), 'H2');
		assert.equal(list.querySelector('.MuiAccordion-heading')?.textContent, 'Static Assets');
	});

	it('uses an explicit titleComponent, including over the parent context', async () => {
		const explicit = await renderTree({ titleComponent: 'h3' });
		assert.equal(headingTag(explicit), 'H3');
		assert.equal(explicit.querySelector('.MuiAccordion-heading')?.textContent, 'Pages');

		const kept = await render(
			React.createElement(
				NavigatorTitleComponentContext.Provider,
				{ value: 'h3' },
				React.createElement(PathNavigatorTreeUI, {
					title: 'Pages',
					titleComponent: 'h2',
					rootPath: '/site/website',
					isRootPathMissing: true,
					itemsByPath: {},
					keywordByPath: {},
					totalByPath: {},
					childrenByParentPath: {},
					errorByPath: {},
					isCollapsed: false,
					expandedNodes: [],
					...treeCallbacks
				})
			)
		);
		assert.equal(headingTag(kept), 'H2');
		assert.equal(kept.querySelector('.MuiAccordion-heading')?.textContent, 'Pages');
	});

	it('nests a navigator under the tools panel page title', async () => {
		components.set('craftercms.components.PathNavigatorTree', StubNavigator);
		const host = await render(
			React.createElement(ToolsPanelPage, {
				title: 'Site Explorer',
				widgets: [
					{
						id: 'craftercms.components.PathNavigatorTree',
						uiKey: 'pages',
						configuration: { label: 'Pages' }
					}
				]
			})
		);
		assert.equal(host.querySelector('h2')?.textContent, 'Site Explorer');
		assert.equal(host.querySelector('h3')?.textContent, 'Pages');
	});

	it('keeps a configured navigator heading when the page would otherwise lower it', async () => {
		components.set('craftercms.components.PathNavigatorTree', StubNavigator);
		const host = await render(
			React.createElement(ToolsPanelPage, {
				title: 'Site Explorer',
				widgets: [
					{
						id: 'craftercms.components.PathNavigatorTree',
						uiKey: 'pages',
						configuration: { label: 'Pages', titleComponent: 'h4' }
					}
				]
			})
		);
		assert.equal(host.querySelector('h2')?.textContent, 'Site Explorer');
		assert.equal(host.querySelector('h4')?.textContent, 'Pages');
		assert.equal(host.querySelectorAll('h3').length, 0);
	});

	it('nests a navigator under a widgets accordion title', async () => {
		components.set('craftercms.components.PathNavigatorTree', StubNavigator);
		const host = await render(
			React.createElement(WidgetsAccordion, {
				title: 'Explorer',
				initialExpanded: true,
				widgets: [
					{
						id: 'craftercms.components.PathNavigatorTree',
						uiKey: 'pages',
						configuration: { label: 'Pages' }
					}
				]
			})
		);
		assert.equal(host.querySelector('h2')?.textContent, 'Explorer');
		assert.equal(host.querySelector('h3')?.textContent, 'Pages');
	});
});

function renderList(props: Record<string, unknown> = {}) {
	return render(
		React.createElement(PathNavigatorUI, {
			title: 'Static Assets',
			itemsByPath: {},
			keyword: '',
			state: {
				id: 'assets',
				rootPath: '/static-assets',
				currentPath: '/static-assets',
				localeCode: 'en',
				keyword: '',
				isSelectMode: false,
				hasClipboard: false,
				levelDescriptor: undefined,
				itemsInPath: [],
				breadcrumb: [],
				selectedItems: [],
				total: 0,
				limit: 10,
				offset: 0,
				collapsed: false,
				isFetching: false,
				error: null,
				isRootPathMissing: true,
				sortStrategy: undefined,
				order: undefined
			},
			onChangeCollapsed() {},
			onBreadcrumbSelected() {},
			onPathSelected() {},
			...props
		})
	);
}

/** The missing-root error title, which is a subsection of the navigator title and not a peer of it. */
function errorHeading(host: HTMLElement) {
	return [...host.querySelectorAll('h2, h3, h4, h5, h6')].find((node) => node.textContent?.includes("doesn't exist"));
}

describe('navigator error state heading level', () => {
	it('renders the error title one level below the default h2 navigator title', async () => {
		for (const host of [await renderTree(), await renderList()]) {
			assert.equal(headingTag(host), 'H2');
			assert.equal(errorHeading(host)?.tagName, 'H3');
		}
	});

	it('follows an explicit or inherited navigator title level', async () => {
		const tree = await renderTree({ titleComponent: 'h3' });
		assert.equal(headingTag(tree), 'H3');
		assert.equal(errorHeading(tree)?.tagName, 'H4');

		const list = await renderList({ titleComponent: 'h4' });
		assert.equal(headingTag(list), 'H4');
		assert.equal(errorHeading(list)?.tagName, 'H5');

		const inherited = await render(
			React.createElement(
				NavigatorTitleComponentContext.Provider,
				{ value: 'h3' },
				React.createElement(PathNavigatorTreeUI, {
					title: 'Pages',
					rootPath: '/site/website',
					isRootPathMissing: true,
					itemsByPath: {},
					keywordByPath: {},
					totalByPath: {},
					childrenByParentPath: {},
					errorByPath: {},
					isCollapsed: false,
					expandedNodes: [],
					...treeCallbacks
				})
			)
		);
		assert.equal(errorHeading(inherited)?.tagName, 'H4');
	});

	it('never goes past h6', () => {
		assert.equal(getNestedHeadingComponent('h2'), 'h3');
		assert.equal(getNestedHeadingComponent('h5'), 'h6');
		assert.equal(getNestedHeadingComponent('h6'), 'h6');
	});
});
