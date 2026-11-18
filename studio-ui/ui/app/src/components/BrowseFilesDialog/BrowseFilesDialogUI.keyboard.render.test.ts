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
 * The Select an item picker chooses a result from the keyboard, then confirms it with Select.
 * One result is a toggle button (aria-pressed). Several results are checkboxes named on the input.
 * Enter and Space activate a button the way the browser does. The mouse click on a card still selects.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { SearchItem } from '../../models/Search';

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { RawIntlProvider, createIntl } = await import('react-intl');
const { Provider } = await import('react-redux');
const { configureStore } = await import('@reduxjs/toolkit');
const { createTheme, ThemeProvider } = await import('@mui/material/styles');
const { BrowseFilesDialogUI } = await import('./BrowseFilesDialogUI.tsx');

const intl = createIntl({ locale: 'en', messages: {}, onError: () => undefined });
const theme = createTheme();

const store = configureStore({
	reducer: {
		sites: (state = { active: 'editorial', byId: { editorial: { id: 'editorial', uuid: 'u1' } } }) => state,
		user: (state = { username: 'ann' }) => state,
		env: (state = { authoringBase: '/studio' }) => state,
		uiConfig: (state = { locale: { localeCode: 'en-US' } }) => state,
		content: (state = { itemsByPath: {}, itemsBeingFetchedByPath: {} }) => state,
		contentTypes: (state = { byId: {}, isFetching: false }) => state,
		preview: (state = {}) => state,
		pathNavigatorTree: (state = {}) => state
	},
	middleware: (getDefault) => getDefault({ serializableCheck: false, immutableCheck: false })
});

const hero: SearchItem = {
	path: '/site/components/hero.xml',
	name: 'Hero banner',
	type: 'Component',
	mimeType: 'application/xml',
	previewUrl: '/site/components/hero.xml',
	lastModifier: 'admin',
	lastModified: '2026-01-01T00:00:00.000Z',
	size: 10,
	snippets: ''
};

const photo: SearchItem = {
	path: '/static-assets/images/photo.png',
	name: 'photo.png',
	type: 'Image',
	mimeType: 'image/png',
	previewUrl: '/static-assets/images/photo.png',
	lastModifier: 'admin',
	lastModified: '2026-01-01T00:00:00.000Z',
	size: 20,
	snippets: ''
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

async function render(props: Record<string, unknown> = {}) {
	const cards: SearchItem[] = [];
	const checks: Array<[string, boolean]> = [];
	const confirms: number[] = [];
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	const draw = (next: Record<string, unknown>) =>
		React.createElement(
			Provider,
			{ store },
			React.createElement(
				RawIntlProvider,
				{ value: intl },
				React.createElement(
					ThemeProvider,
					{ theme },
					React.createElement(BrowseFilesDialogUI, {
						items: [hero, photo],
						guestBase: '/studio',
						selectedCard: null,
						selectedArray: [],
						multiSelect: false,
						path: '/site/components',
						currentPath: '/site/components',
						searchParameters: { keywords: '', filters: {} },
						setSearchParameters() {},
						limit: 10,
						offset: 0,
						keyword: '',
						total: 2,
						sortKeys: [],
						allSelected: false,
						someSelected: false,
						isCurrentPathLeaf: false,
						disableSubmission: true,
						onCardSelected: (item: SearchItem) => cards.push(item),
						onCheckboxChecked: (path: string, selected: boolean) => checks.push([path, selected]),
						handleSearchKeyword() {},
						onPathSelected() {},
						treeSelectedPath: '',
						onSelectButtonClick: () => confirms.push(1),
						onChangePage() {},
						onChangeRowsPerPage() {},
						onCloseButtonClick() {},
						onRefresh() {},
						onUpload() {},
						onToggleViewMode() {},
						onSelectAll() {},
						...next
					} as never)
				)
			)
		);
	await act(async () => {
		root.render(draw(props) as never);
	});
	mounted.push({ unmount: () => root.unmount(), host });
	return {
		host,
		cards,
		checks,
		confirms,
		rerender: async (next: Record<string, unknown>) => {
			await act(async () => {
				root.render(draw({ ...props, ...next }) as never);
			});
		}
	};
}

function buttonNamed(host: HTMLElement, name: string): HTMLButtonElement {
	const button = [...host.querySelectorAll('button')].find((candidate) => candidate.textContent?.trim() === name);
	assert.ok(button, name);
	return button as HTMLButtonElement;
}

function selectionButton(host: HTMLElement, label: string): HTMLButtonElement {
	const button = host.querySelector<HTMLButtonElement>(`button[aria-pressed][aria-label="${label}"]`);
	assert.ok(button, label);
	return button;
}

async function press(element: HTMLElement, key: string) {
	await act(async () => {
		const down = new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
		element.dispatchEvent(down);
		if (!down.defaultPrevented && (key === 'Enter' || key === ' ')) {
			element.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 }));
		}
	});
}

describe('browse picker keyboard selection', () => {
	it('selects one component from the keyboard and confirms it', async () => {
		const view = await render();
		const select = buttonNamed(view.host, 'Select');
		assert.equal(select.disabled, true);
		const heroButton = selectionButton(view.host, 'Hero banner, /site/components/hero.xml');
		assert.equal(heroButton.getAttribute('aria-pressed'), 'false');
		heroButton.focus();
		assert.equal(document.activeElement, heroButton);
		await press(heroButton, 'Enter');
		assert.equal(view.cards.length, 1);
		assert.equal(view.cards[0].path, hero.path);

		await view.rerender({ selectedCard: hero, disableSubmission: false });
		assert.equal(
			selectionButton(view.host, 'Hero banner, /site/components/hero.xml').getAttribute('aria-pressed'),
			'true'
		);
		const confirm = buttonNamed(view.host, 'Select');
		assert.equal(confirm.disabled, false);
		await press(confirm, ' ');
		assert.equal(view.confirms.length, 1);
	});

	it('checks an existing asset from the keyboard and confirms it', async () => {
		const view = await render({ multiSelect: true, path: '/static-assets', currentPath: '/static-assets' });
		assert.equal(buttonNamed(view.host, 'Select').disabled, true);
		assert.equal(view.host.querySelector('button[aria-pressed]'), null);
		const input = view.host.querySelector<HTMLInputElement>('input[type="checkbox"][aria-label="Select photo.png"]');
		assert.ok(input, 'asset checkbox');
		input.focus();
		assert.equal(document.activeElement, input);
		// Space activates a checkbox by clicking it. jsdom does not, so the test does.
		await act(async () => {
			const down = new window.KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
			input.dispatchEvent(down);
			if (!down.defaultPrevented) input.click();
		});
		assert.deepEqual(view.checks, [[photo.path, true]]);
		assert.equal(view.cards.length, 0, 'checking the box must not also toggle the card');

		await view.rerender({
			multiSelect: true,
			path: '/static-assets',
			currentPath: '/static-assets',
			selectedArray: [photo.path],
			disableSubmission: false
		});
		const confirm = buttonNamed(view.host, 'Select');
		assert.equal(confirm.disabled, false);
		await act(async () => {
			confirm.click();
		});
		assert.equal(view.confirms.length, 1);
	});

	it('still selects a card from a mouse click', async () => {
		const single = await render();
		const heroCard = [...single.host.querySelectorAll('.MuiCard-root')].find((node) =>
			node.textContent?.includes('Hero banner')
		);
		assert.ok(heroCard, 'hero card');
		// The selection button stops propagation, so the title is the card's own click target.
		const heroTitle = heroCard.querySelector('h2');
		assert.ok(heroTitle, 'hero title');
		await act(async () => {
			heroTitle.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
		});
		assert.equal(single.cards.length, 1);
		assert.equal(single.cards[0].path, hero.path);

		const multi = await render({ multiSelect: true });
		const card = [...multi.host.querySelectorAll('.MuiCard-root')].find((node) =>
			node.textContent?.includes('Hero banner')
		);
		assert.ok(card, 'hero card');
		await act(async () => {
			card.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
		});
		assert.equal(multi.cards.length, 1);
		assert.equal(multi.cards[0].path, hero.path);
	});
});
