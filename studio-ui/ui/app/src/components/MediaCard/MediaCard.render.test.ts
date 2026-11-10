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
 * Browse pickers select one result from the keyboard through a toggle on the card header.
 * The title heading and the path stay outside that toggle. Search and the assets panel do not pass
 * `isSelected`, and their cards stay as they were.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { MediaItem } from '../../models/Search';

const React = await import('react');
const { createRoot } = await import('react-dom/client');
const { act } = await import('react');
const { createTheme, ThemeProvider } = await import('@mui/material/styles');
const { RawIntlProvider, createIntl } = await import('react-intl');
const { default: MediaCard } = await import('./MediaCard.tsx');

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

const theme = createTheme();

const item: MediaItem = {
	lastModified: '2026-01-01T00:00:00.000Z',
	lastModifier: 'admin',
	mimeType: 'application/xml',
	name: 'Hero banner',
	path: '/site/components/hero.xml',
	previewUrl: '/site/components/hero.xml',
	size: 10,
	snippets: '',
	type: 'Component'
};

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
});

async function render(props: Record<string, unknown> = {}) {
	const clicks: unknown[] = [];
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	const draw = (next: Record<string, unknown>) =>
		React.createElement(
			ThemeProvider,
			{ theme },
			React.createElement(
				RawIntlProvider,
				{ value: intl as never },
				React.createElement(MediaCard, {
					item,
					previewAppBaseUri: 'http://localhost',
					onPreview: null,
					...next,
					onClick:
						'onClick' in next ? (next.onClick as (() => void) | null) : () => clicks.push(next.isSelected ?? true)
				} as never)
			)
		);
	await act(async () => {
		root.render(draw(props) as never);
	});
	mounted.push({ unmount: () => root.unmount(), host });
	return {
		host,
		clicks,
		header: () => host.querySelector<HTMLElement>('.MuiCardHeader-root'),
		rerender: async (next: Record<string, unknown>) => {
			await act(async () => {
				root.render(draw({ ...props, ...next }) as never);
			});
		}
	};
}

function headerOf(host: HTMLElement): HTMLElement {
	const header = host.querySelector<HTMLElement>('.MuiCardHeader-root');
	assert.ok(header, 'card header');
	return header;
}

async function keyDown(element: HTMLElement, key: string) {
	await act(async () => {
		element.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
	});
}

function toggleOf(header: HTMLElement | null | undefined): HTMLElement {
	const toggle = header?.querySelector<HTMLElement>('[role="button"]');
	assert.ok(toggle, 'selection toggle');
	return toggle;
}

describe('MediaCard keyboard selection', () => {
	it('makes a toggle in the tab order when isSelected is set with onClick and no onSelect', async () => {
		const plain = await render({ onClick: undefined });
		const { host } = await render({ isSelected: false });
		const header = headerOf(host);
		const toggle = toggleOf(header);
		const heading = header.querySelector('h2');
		const path = header.querySelector('.MuiCardHeader-subheader');
		assert.equal(header.getAttribute('role'), null);
		assert.equal(toggle.tabIndex, 0);
		assert.equal(toggle.getAttribute('aria-label'), 'Hero banner, /site/components/hero.xml');
		assert.equal(heading?.textContent, 'Hero banner');
		assert.equal(path?.textContent, '/site/components/hero.xml');
		assert.equal(heading?.closest('[role="button"]'), null);
		assert.equal(path?.closest('[role="button"]'), null);
		assert.equal(toggle.hasAttribute('aria-disabled'), false);

		// The toggle sits on the header box. The header's own layout matches a card that does not opt in.
		const plainHeader = headerOf(plain.host);
		const plainCss = getComputedStyle(plainHeader);
		const css = getComputedStyle(header);
		assert.equal(css.display, plainCss.display);
		assert.equal(css.padding, plainCss.padding);
		assert.equal(css.alignItems, plainCss.alignItems);
		assert.equal(css.position, 'relative');
		const slot = header.querySelector('.MuiCardHeader-action');
		assert.ok(slot);
		const slotCss = getComputedStyle(slot);
		assert.equal(slotCss.marginTop, '0px');
		assert.equal(slotCss.marginRight, '0px');
		assert.equal(slotCss.marginBottom, '0px');
		assert.equal(slotCss.width, '0px');
		assert.equal(slotCss.height, '0px');
		assert.equal(slotCss.pointerEvents, 'none');
		const toggleCss = getComputedStyle(toggle);
		assert.equal(toggleCss.position, 'absolute');
		assert.equal(toggleCss.pointerEvents, 'none');
	});

	it('calls onClick once for Enter and once for Space', async () => {
		const { clicks, header } = await render({ isSelected: false });
		const toggle = toggleOf(header());
		await keyDown(toggle, 'Enter');
		assert.equal(clicks.length, 1);
		await keyDown(toggle, ' ');
		assert.equal(clicks.length, 2);
		await keyDown(toggle, 'a');
		assert.equal(clicks.length, 2);
	});

	it('does not select when the key event comes from a nested control', async () => {
		const { clicks, header } = await render({ isSelected: false });
		const toggle = toggleOf(header());
		const heading = header()?.querySelector('h2');
		assert.ok(heading);
		await keyDown(heading, 'Enter');
		await keyDown(heading, ' ');
		const nested = document.createElement('button');
		toggle.appendChild(nested);
		await keyDown(nested, 'Enter');
		await keyDown(nested, ' ');
		assert.equal(clicks.length, 0);
	});

	it('follows isSelected with aria-pressed', async () => {
		const view = await render({ isSelected: true });
		assert.equal(toggleOf(headerOf(view.host)).getAttribute('aria-pressed'), 'true');
		await view.rerender({ isSelected: false });
		assert.equal(toggleOf(headerOf(view.host)).getAttribute('aria-pressed'), 'false');
	});

	it('blocks selection and sets aria-disabled when disableSelection is set', async () => {
		const { clicks, header } = await render({ isSelected: false, disableSelection: true });
		const toggle = toggleOf(header());
		assert.equal(toggle.getAttribute('aria-disabled'), 'true');
		await keyDown(toggle, 'Enter');
		await keyDown(toggle, ' ');
		assert.equal(clicks.length, 0);
	});

	it('leaves a card without isSelected unchanged for Search and the assets panel', async () => {
		const searchClicks: number[] = [];
		const search = await render({
			onSelect: () => undefined,
			selected: [],
			disableSelection: true,
			onClick: () => searchClicks.push(1)
		});
		const searchHeader = headerOf(search.host);
		assert.equal(searchHeader.querySelector('[role="button"]'), null);
		assert.equal(searchHeader.getAttribute('role'), null);
		assert.equal(searchHeader.hasAttribute('tabindex'), false);
		assert.equal(searchHeader.hasAttribute('aria-pressed'), false);
		assert.equal(searchHeader.hasAttribute('aria-disabled'), false);
		assert.equal(searchHeader.hasAttribute('aria-label'), false);
		assert.ok(search.host.querySelector('input[type="checkbox"]'));
		await keyDown(searchHeader, 'Enter');
		assert.equal(searchClicks.length, 0);
		assert.equal(searchHeader.querySelector('h2')?.textContent, 'Hero banner');

		const assetsClicks: number[] = [];
		const assets = await render({
			onClick: undefined,
			onPreview: () => assetsClicks.push(1),
			avatar: React.createElement('span', null, 'drag')
		});
		const assetsHeader = headerOf(assets.host);
		assert.equal(assetsHeader.querySelector('[role="button"]'), null);
		assert.equal(assetsHeader.getAttribute('role'), null);
		assert.equal(assetsHeader.hasAttribute('tabindex'), false);
		assert.equal(assetsHeader.hasAttribute('aria-pressed'), false);
		assert.equal(assetsHeader.hasAttribute('aria-label'), false);
		await keyDown(assetsHeader, ' ');
		assert.equal(assetsClicks.length, 0);
		assert.match(assets.host.textContent ?? '', /Hero banner/);
	});
});
