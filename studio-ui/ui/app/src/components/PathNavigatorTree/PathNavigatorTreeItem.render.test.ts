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
const { RawIntlProvider, createIntl } = await import('react-intl');
const { SimpleTreeView } = await import('@mui/x-tree-view');
const { default: PathNavigatorTreeItem } = await import('./PathNavigatorTreeItem.tsx');

// The app build gives every message an id. Without that transform, use the default message as its own id.
const baseIntl = createIntl({ locale: 'en', messages: {}, onError() {} });
const intl = {
	...baseIntl,
	formatMessage: (descriptor: { id?: string; defaultMessage?: string }, values?: Record<string, unknown>) =>
		baseIntl.formatMessage(
			{ ...descriptor, id: descriptor.id ?? String(descriptor.defaultMessage) } as never,
			values as never
		)
};

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
});

async function render() {
	const labelClicks: string[] = [];
	const path = '/site/website';
	const props = {
		path,
		itemsByPath: {
			[path]: { id: path, path, label: 'Home', systemType: 'folder', childrenCount: 1, stateMap: {} }
		},
		keywordByPath: {},
		totalByPath: {},
		childrenByParentPath: {},
		errorByPath: {},
		showPublishingTarget: false,
		showWorkflowState: false,
		onLabelClick: (_event: unknown, clickedPath: string) => labelClicks.push(clickedPath),
		onIconClick: () => {},
		onOpenItemMenu: () => {},
		onFilterChange: () => {},
		onMoreClick: () => {}
	};
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	await act(async () => {
		root.render(
			React.createElement(
				RawIntlProvider,
				{ value: intl as never },
				React.createElement(SimpleTreeView, null, React.createElement(PathNavigatorTreeItem, props as never))
			)
		);
	});
	mounted.push({ unmount: () => root.unmount(), host });
	const treeItem = host.querySelector<HTMLElement>('[role="treeitem"]');
	assert.ok(treeItem, 'treeitem renders');
	return { host, treeItem, labelClicks };
}

async function press(element: Element, key: string) {
	const event = new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
	await act(async () => {
		element.dispatchEvent(event);
	});
	return event;
}

const byLabel = (host: HTMLElement, label: string) => host.querySelector<HTMLElement>(`button[aria-label="${label}"]`);

describe('PathNavigatorTreeItem keyboard', () => {
	it('activates the item on Enter from the treeitem itself', async () => {
		const { treeItem, labelClicks } = await render();
		const event = await press(treeItem, 'Enter');
		assert.deepEqual(labelClicks, ['/site/website']);
		assert.equal(event.defaultPrevented, true);
	});

	it('does not activate the item on Enter from the filter Close button', async () => {
		const { host, treeItem, labelClicks } = await render();
		await act(async () => treeItem.focus());
		await act(async () => {
			byLabel(host, 'Filter')?.click();
		});
		const close = byLabel(host, 'Close');
		assert.ok(close, 'Close button of the open filter');
		const event = await press(close, 'Enter');
		assert.deepEqual(labelClicks, []);
		assert.equal(event.defaultPrevented, false, 'the button keeps its native Enter activation');
	});

	it('shows the Options and Filter buttons while the treeitem has focus', async () => {
		const { host, treeItem } = await render();
		assert.equal(byLabel(host, 'Filter'), null);
		assert.equal(byLabel(host, 'Options'), null);
		await act(async () => treeItem.focus());
		assert.ok(byLabel(host, 'Filter'), 'Filter is reachable from the focused item');
		assert.ok(byLabel(host, 'Options'), 'Options is reachable from the focused item');
		assert.equal(byLabel(host, 'Filter')?.tabIndex, 0);
	});
});
