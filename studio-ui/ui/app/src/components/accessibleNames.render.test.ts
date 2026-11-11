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

import '../../test/stringListDomSetup.mjs';
import '../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const React = await import('react');
const { createRoot } = await import('react-dom/client');
const { act } = await import('react');
const { RawIntlProvider, createIntl } = await import('react-intl');
const { default: ActionsBar } = await import('./ImageEditorDialog/ActionsBar.tsx');
const { ToolsPanelListItemButton } = await import('./ToolsPanelListItemButton/ToolsPanelListItemButton.tsx');
const { ToolsPanelListItemDispatchButton } =
	await import('./ToolsPanelListItemDispatchButton/ToolsPanelListItemDispatchButton.tsx');
const { Provider: ReduxProvider } = await import('react-redux');
const { configureStore } = await import('@reduxjs/toolkit');
const { DraggablePanelListItem } = await import('./DraggablePanelListItem/DraggablePanelListItem.tsx');
const { default: PluginCard } = await import('./PluginCard/PluginCard.tsx');

// The app build gives every message an id. Without that transform, use the default message as its own id.
const baseIntl = createIntl({ locale: 'en', messages: {}, onError: () => undefined });
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

async function render(element: React.ReactElement): Promise<HTMLElement> {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	mounted.push({ unmount: () => root.unmount(), host });
	await act(async () => {
		root.render(React.createElement(RawIntlProvider, { value: intl }, element));
	});
	return host;
}

const nameOf = (button: Element) => button.getAttribute('aria-label') ?? button.textContent?.trim();

describe('accessible names', () => {
	it('names every image editor action and exposes which mode is active', async () => {
		const host = await render(
			React.createElement(ActionsBar, {
				tools: ['crop', 'rotate', 'flip', 'adjustments'],
				currentMode: 'brightness',
				setMode() {},
				onRotate() {},
				onFlip() {}
			})
		);
		const buttons = Array.from(host.querySelectorAll('button'));
		assert.deepEqual(buttons.map(nameOf), [
			'Crop',
			'Rotate left',
			'Rotate right',
			'Flip horizontal',
			'Flip vertical',
			'Saturation',
			'Brightness',
			'Contrast'
		]);
		const pressed = Object.fromEntries(
			buttons.filter((b) => b.hasAttribute('aria-pressed')).map((b) => [nameOf(b), b.getAttribute('aria-pressed')])
		);
		assert.deepEqual(pressed, { Crop: 'false', Saturation: 'false', Brightness: 'true', Contrast: 'false' });
	});

	it('names the trailing action of a tools panel item and keeps className and state on the button', async () => {
		let clicked = 0;
		const host = await render(
			React.createElement(ToolsPanelListItemButton, {
				title: 'Templates',
				className: 'custom-class',
				selected: true,
				onSecondaryActionClick: () => clicked++
			})
		);
		const item = host.querySelector('li') as HTMLElement;
		const row = host.querySelector(
			'li > [role="button"], li > button, li > div[class*="ListItemButton"]'
		) as HTMLElement;
		assert.equal(item.classList.contains('custom-class'), false);
		assert.equal(row.classList.contains('custom-class'), true);
		assert.equal(row.classList.contains('Mui-selected'), true);
		const trailing = host.querySelector('button[aria-label="Open Templates"]') as HTMLButtonElement;
		assert.ok(trailing);
		await act(async () => trailing.click());
		assert.equal(clicked, 1);
	});

	it('names the dispatch button trailing action, including a caller-supplied label', async () => {
		const store = configureStore({ reducer: (state = {}) => state });
		const host = await render(
			React.createElement(
				ReduxProvider,
				{ store },
				React.createElement(ToolsPanelListItemDispatchButton, {
					title: 'Templates',
					onSecondaryActionClick: { type: 'open' }
				})
			)
		);
		assert.ok(host.querySelector('button[aria-label="Open Templates"]'));
		const named = await render(
			React.createElement(
				ReduxProvider,
				{ store },
				React.createElement(ToolsPanelListItemDispatchButton, {
					title: 'Templates',
					secondaryActionLabel: 'Preview Templates',
					onSecondaryActionClick: { type: 'preview' }
				})
			)
		);
		assert.ok(named.querySelector('button[aria-label="Preview Templates"]'));
		assert.equal(named.querySelector('button[aria-label="Open Templates"]'), null);
	});

	it('names the options button of a draggable panel item and leaves the mouse-only row out of the tab order', async () => {
		const host = await render(
			React.createElement(DraggablePanelListItem, {
				primaryText: 'Article',
				secondaryText: '/component/article',
				onMenu() {}
			} as never)
		);
		assert.ok(host.querySelector('button[aria-label="Options for Article"]'));
		assert.equal(host.querySelectorAll('button').length, 1);
		assert.equal(host.querySelectorAll('[role="button"], :not(button)[tabindex]').length, 0);
		assert.ok(host.querySelector('[draggable="true"]'));
		const withoutMenu = await render(React.createElement(DraggablePanelListItem, { primaryText: 'Article' } as never));
		assert.equal(withoutMenu.querySelectorAll('button, [role="button"], [tabindex]').length, 0);
	});

	it('names the plugin card use button after the plugin, including an icon-only use label', async () => {
		const plugin = {
			id: 'org.example.plugin',
			name: 'Example plugin',
			description: '',
			documentation: '',
			license: { name: 'MIT' },
			media: { screenshots: [] },
			compatible: true
		};
		const renderCard = (useLabel?: React.ReactElement) =>
			render(
				React.createElement(PluginCard, {
					plugin,
					useLabel,
					onPluginSelected() {},
					onDetails() {}
				} as never)
			);
		const textual = await renderCard();
		assert.match(textual.querySelector('.cardActions button')?.textContent ?? '', /^Use\s+Example plugin$/);
		const iconOnly = await renderCard(React.createElement('svg', { 'aria-hidden': 'true' }));
		assert.equal(
			iconOnly.querySelector('.cardActions button')?.textContent?.replace(/\s+/g, ' ').trim(),
			'Use Example plugin'
		);
	});
});
