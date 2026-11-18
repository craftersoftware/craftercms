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
 * The edit-mode row has a visible label. The switch input takes its name from that text.
 * A string tooltip title must not become aria-label on the switch's generic span: that role
 * prohibits aria-label and aria-labelledby, and the attribute never names the input.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { createTheme, ThemeProvider } = await import('@mui/material/styles');
const { RawIntlProvider, createIntl } = await import('react-intl');
const { Provider } = await import('react-redux');
const { configureStore } = await import('@reduxjs/toolkit');
const { PreviewSettingsPanel } = await import('./PreviewSettingsPanel.tsx');
const { EditModeSwitch } = await import('../EditModeSwitch/EditModeSwitch.tsx');
const { KeyboardShortcutsSwitch } = await import('../KeyboardShortcutsSwitch/KeyboardShortcutsSwitch.tsx');

// EditModeSwitch reads palette.border.control, which the default MUI theme does not define.
const theme = createTheme({ palette: { border: { control: '#bdbdbd' } } } as never);

// The real createIntl, so a message without an id fails the test instead of getting one made up.
const intl = createIntl({ locale: 'en', messages: {}, onError: () => undefined });

const store = configureStore({
	reducer: {
		preview: (
			state = { editMode: true, highlightMode: 'all', keyboardShortcutsEnabled: true, editModePadding: false }
		) => state,
		user: (state = { username: 'admin' }) => state
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
			React.createElement(
				ThemeProvider,
				{ theme },
				React.createElement(Provider, { store }, React.createElement(RawIntlProvider, { value: intl }, element))
			)
		);
	});
	return host;
}

function accessibleName(host: HTMLElement, input: HTMLElement) {
	const labelledBy = input.getAttribute('aria-labelledby');
	if (labelledBy) {
		return labelledBy
			.split(/\s+/)
			.filter(Boolean)
			.map((id) => host.querySelector<HTMLElement>(`[id="${id}"]`)?.textContent ?? '')
			.join(' ')
			.replace(/\s+/g, ' ')
			.trim();
	}
	return input.getAttribute('aria-label') ?? '';
}

function editModeSwitch(host: HTMLElement) {
	const input = host.querySelector<HTMLInputElement>('.MuiSwitch-colorDefault input');
	assert.ok(input, 'edit mode switch input');
	const span = input.closest<HTMLElement>('.MuiSwitch-switchBase');
	assert.ok(span, 'edit mode switch root');
	return { input, span };
}

describe('settings edit mode switch', () => {
	it('names the input from the visible Edit Mode label and leaves the span unnamed', async () => {
		const host = await render(React.createElement(PreviewSettingsPanel));
		const { input, span } = editModeSwitch(host);
		assert.equal(host.querySelector('#settingsPanelEditModeLabel')?.textContent, 'Edit Mode (e | m)');
		assert.equal(accessibleName(host, input), 'Edit Mode (e | m)');
		assert.equal(span.getAttribute('aria-label'), null);
		assert.equal(span.getAttribute('aria-labelledby'), null);
		const shortcuts = host.querySelector<HTMLInputElement>(
			'input[aria-labelledby="settingsPanelKeyboardShortcutsLabel"]'
		);
		assert.ok(shortcuts, 'keyboard shortcuts switch input');
		assert.equal(host.querySelector('#settingsPanelKeyboardShortcutsLabel')?.textContent, 'Keyboard shortcuts');
		assert.equal(accessibleName(host, shortcuts), 'Keyboard shortcuts');
		assert.equal(shortcuts.closest('.MuiSwitch-switchBase')?.getAttribute('aria-label'), null);
		assert.equal(shortcuts.closest('.MuiSwitch-switchBase')?.getAttribute('aria-labelledby'), null);
	});

	it('keeps that name, and no prohibited name on the span, while the tooltip is open', async () => {
		const host = await render(React.createElement(PreviewSettingsPanel));
		const { input, span } = editModeSwitch(host);
		await act(async () => {
			span.dispatchEvent(new window.MouseEvent('mouseover', { bubbles: true }));
		});
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 200));
		});
		assert.equal(document.querySelectorAll('[role="tooltip"]').length, 1, 'the tooltip did not open');
		assert.equal(accessibleName(host, input), 'Edit Mode (e | m)');
		assert.equal(span.getAttribute('aria-label'), null);
		assert.equal(span.getAttribute('aria-labelledby'), null);
	});
});

function keyboardShortcutsSwitch(host: HTMLElement) {
	const input = host.querySelector<HTMLInputElement>('input[aria-labelledby="settingsPanelKeyboardShortcutsLabel"]');
	assert.ok(input, 'keyboard shortcuts switch input');
	const span = input.closest<HTMLElement>('.MuiSwitch-switchBase');
	assert.ok(span, 'keyboard shortcuts switch root');
	return { input, span };
}

describe('keyboard shortcuts switch', () => {
	it('keeps that name, and no prohibited name on the span, while the tooltip is open', async () => {
		const host = await render(React.createElement(PreviewSettingsPanel));
		const { input, span } = keyboardShortcutsSwitch(host);
		await act(async () => {
			span.dispatchEvent(new window.MouseEvent('mouseover', { bubbles: true }));
		});
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 200));
		});
		assert.equal(document.querySelectorAll('[role="tooltip"]').length, 1, 'the tooltip did not open');
		assert.equal(accessibleName(host, input), 'Keyboard shortcuts');
		assert.equal(span.getAttribute('aria-label'), null);
		assert.equal(span.getAttribute('aria-labelledby'), null);
	});

	it('uses a caller input name and keeps the caller input props', async () => {
		const host = await render(
			React.createElement(
				React.Fragment,
				null,
				React.createElement('span', { id: 'shortcutsLabel' }, 'Keyboard shortcuts'),
				React.createElement(KeyboardShortcutsSwitch, {
					slotProps: { input: { 'aria-labelledby': 'shortcutsLabel', 'data-kept': 'yes' } }
				} as never)
			)
		);
		const input = host.querySelector<HTMLInputElement>('input[type="checkbox"]');
		assert.ok(input, 'keyboard shortcuts switch input');
		assert.equal(accessibleName(host, input), 'Keyboard shortcuts');
		assert.equal(input.getAttribute('data-kept'), 'yes');
		assert.equal(input.closest('.MuiSwitch-switchBase')?.getAttribute('aria-label'), null);
	});

	it('merges a function form of slotProps.input and passes it ownerState', async () => {
		let ownerState: unknown;
		const host = await render(
			React.createElement(
				React.Fragment,
				null,
				React.createElement('span', { id: 'shortcutsLabel' }, 'Keyboard shortcuts'),
				React.createElement(KeyboardShortcutsSwitch, {
					slotProps: {
						input: (state) => {
							ownerState = state;
							return { 'aria-labelledby': 'shortcutsLabel', 'data-kept': 'fn' };
						}
					}
				} as never)
			)
		);
		const input = host.querySelector<HTMLInputElement>('input[type="checkbox"]');
		assert.ok(input, 'keyboard shortcuts switch input');
		assert.equal(accessibleName(host, input), 'Keyboard shortcuts');
		assert.equal(input.getAttribute('data-kept'), 'fn');
		assert.equal(typeof ownerState, 'object');
		assert.notEqual(ownerState, null);
		assert.equal(input.closest('.MuiSwitch-switchBase')?.getAttribute('aria-label'), null);
		assert.equal(input.closest('.MuiSwitch-switchBase')?.getAttribute('aria-labelledby'), null);
	});
});

describe('edit mode switch without a visible label', () => {
	it('names the input and does not put the tooltip title on the span as aria-label', async () => {
		const host = await render(React.createElement(EditModeSwitch));
		const { input, span } = editModeSwitch(host);
		assert.equal(input.getAttribute('aria-label'), 'Toggle edit mode');
		assert.equal(span.getAttribute('aria-label'), null);
		assert.equal(span.getAttribute('aria-labelledby'), null);
		assert.equal(span.getAttribute('title'), 'Toggle edit mode');
	});
});
