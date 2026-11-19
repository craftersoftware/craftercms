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
 * MUI deepmerge replaces a styleOverrides slot when either side is a function. These tests pass a caller
 * callback (and, for two slots, a plain object) and check that its unrelated styles are still there while
 * the contrast rule wins on the keys it sets.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { Theme, ThemeOptions } from '@mui/material/styles';

const React = await import('react');
const { createRoot } = await import('react-dom/client');
const { act } = await import('react');
const { useTheme } = await import('@mui/material/styles');
const { default: Avatar } = await import('@mui/material/Avatar');
const { default: ToggleButton } = await import('@mui/material/ToggleButton');
const { default: CrafterThemeProvider } = await import('./CrafterThemeProvider.tsx');
const { default: palette } = await import('../../styles/palette.ts');

(globalThis as { localStorage?: Storage }).localStorage ??= window.localStorage;

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
});

const callerMark = { letterSpacing: '2px' };
const callerCallback = () => callerMark;

async function renderTheme(themeOptions?: ThemeOptions, beforeRender?: () => void) {
	window.localStorage.clear();
	beforeRender?.();
	let theme: Theme | null = null;
	function Capture() {
		theme = useTheme();
		return null;
	}
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	await act(async () => {
		root.render(
			React.createElement(
				CrafterThemeProvider,
				{ themeOptions },
				React.createElement(
					React.Fragment,
					null,
					React.createElement(Capture),
					React.createElement(ToggleButton, { value: 'stay', selected: true, color: 'primary' }, 'Stay'),
					React.createElement(ToggleButton, { value: 'other', selected: true, color: 'standard' }, 'Other'),
					React.createElement(Avatar, null, 'AB')
				)
			)
		);
	});
	mounted.push({ unmount: () => root.unmount(), host });
	assert.ok(theme);
	return { theme, host };
}

function slot(theme: Theme, component: keyof NonNullable<Theme['components']>, name: string): unknown {
	const overrides = theme.components?.[component]?.styleOverrides as Record<string, unknown> | undefined;
	return overrides?.[name];
}

function apply(slotValue: unknown, theme: Theme, ownerState: object = {}): Record<string, unknown> {
	const value = typeof slotValue === 'function' ? slotValue({ ownerState, theme }) : slotValue;
	assert.ok(value && typeof value === 'object' && !Array.isArray(value));
	return value as Record<string, unknown>;
}

describe('caller style overrides composed with contrast rules', () => {
	const themeOptions: ThemeOptions = {
		components: {
			MuiSwitch: { styleOverrides: { root: callerCallback, switchBase: callerCallback } },
			MuiButton: {
				defaultProps: { disableElevation: true },
				styleOverrides: {
					contained: callerCallback,
					outlined: callerCallback,
					text: () => ({ textIndent: '1px' })
				}
			},
			MuiChip: { styleOverrides: { outlined: callerCallback } },
			MuiAlert: { styleOverrides: { filled: callerCallback } },
			MuiAvatar: { styleOverrides: { colorDefault: { letterSpacing: '2px', color: 'red' } } },
			MuiToggleButton: {
				styleOverrides: {
					root: () => ({
						letterSpacing: '2px',
						'&.Mui-selected': { color: 'red', fontWeight: 700 }
					})
				}
			},
			MuiListItemButton: {
				styleOverrides: {
					root: () => ({
						letterSpacing: '2px',
						'&.Mui-selected': { color: 'red', backgroundImage: 'none', padding: '4px' }
					})
				}
			},
			MuiMenuItem: {
				styleOverrides: {
					root: { letterSpacing: '2px', '&.Mui-selected': { padding: '4px' } }
				}
			},
			MuiListItem: { styleOverrides: { root: callerCallback } },
			MuiOutlinedInput: { styleOverrides: { root: callerCallback, notchedOutline: callerCallback } },
			MuiInput: { styleOverrides: { underline: callerCallback } },
			MuiFilledInput: { styleOverrides: { underline: callerCallback } },
			MuiInputBase: { styleOverrides: { root: callerCallback, input: callerCallback } }
		}
	};

	it('keeps a caller callback and still paints the selected primary toggle in blue.shade', async () => {
		const { theme, host } = await renderTheme(themeOptions);
		const primary = apply(slot(theme, 'MuiToggleButton', 'root'), theme, { color: 'primary' });
		const selected = primary['&.Mui-selected'] as Record<string, unknown>;
		assert.equal(primary.letterSpacing, '2px');
		assert.equal(selected.color, palette.blue.shade);
		assert.equal(selected.fontWeight, 700);

		const standard = apply(slot(theme, 'MuiToggleButton', 'root'), theme, { color: 'standard' });
		const standardSelected = standard['&.Mui-selected'] as Record<string, unknown>;
		assert.equal(standard.letterSpacing, '2px');
		assert.equal(standardSelected.color, 'red');
		assert.equal(standardSelected.fontWeight, 700);

		const stay = [...host.querySelectorAll<HTMLElement>('.MuiToggleButton-root')].find(
			(node) => node.textContent === 'Stay'
		);
		const other = [...host.querySelectorAll<HTMLElement>('.MuiToggleButton-root')].find(
			(node) => node.textContent === 'Other'
		);
		assert.ok(stay);
		assert.ok(other);
		assert.equal(window.getComputedStyle(stay).color, 'rgb(0, 64, 221)');
		assert.equal(window.getComputedStyle(stay).letterSpacing, '2px');
		assert.equal(window.getComputedStyle(other).letterSpacing, '2px');
		assert.notEqual(window.getComputedStyle(other).color, 'rgb(0, 64, 221)');
	});

	it('keeps a caller object on the default avatar and still uses text.primary', async () => {
		const { theme, host } = await renderTheme(themeOptions);
		const colorDefault = apply(slot(theme, 'MuiAvatar', 'colorDefault'), theme);
		assert.equal(colorDefault.letterSpacing, '2px');
		assert.equal(colorDefault.color, theme.palette.text.primary);

		const avatar = host.querySelector<HTMLElement>('.MuiAvatar-colorDefault');
		assert.ok(avatar);
		const style = window.getComputedStyle(avatar);
		assert.equal(style.color, 'rgba(0, 0, 0, 0.87)');
		assert.equal(style.backgroundColor, 'rgb(189, 189, 189)');
		assert.equal(style.letterSpacing, '2px');
	});

	it('composes every other contrast slot the provider adds', async () => {
		const { theme } = await renderTheme(themeOptions);
		const buttonDefaults = theme.components?.MuiButton?.defaultProps;
		assert.equal(buttonDefaults?.disableElevation, true);
		assert.equal(apply(slot(theme, 'MuiButton', 'text'), theme).textIndent, '1px');

		const contained = apply(slot(theme, 'MuiButton', 'contained'), theme, { color: 'primary' });
		assert.equal(contained.letterSpacing, '2px');
		assert.equal(contained['@media (hover: hover)'], undefined);

		const outlined = apply(slot(theme, 'MuiButton', 'outlined'), theme, { color: 'primary' });
		assert.equal(outlined.letterSpacing, '2px');
		assert.equal(outlined.borderColor, theme.palette.primary.main);
		const inherit = apply(slot(theme, 'MuiButton', 'outlined'), theme, { color: 'inherit' });
		assert.equal(inherit.borderColor, 'currentColor');
		assert.equal(inherit.letterSpacing, '2px');

		const chip = apply(slot(theme, 'MuiChip', 'outlined'), theme, { color: 'default' });
		assert.equal(chip.letterSpacing, '2px');
		assert.equal(chip.borderColor, theme.palette.border.control);

		const alert = apply(slot(theme, 'MuiAlert', 'filled'), theme, { severity: 'error' });
		assert.equal(alert.letterSpacing, '2px');
		assert.equal(alert.backgroundColor, theme.palette.error.main);

		const track = apply(slot(theme, 'MuiSwitch', 'root'), theme, { color: 'primary' })['& .MuiSwitch-track'] as {
			backgroundColor?: string;
		};
		assert.equal(apply(slot(theme, 'MuiSwitch', 'root'), theme, { color: 'primary' }).letterSpacing, '2px');
		assert.equal(track.backgroundColor, theme.palette.border.control);
		assert.equal(apply(slot(theme, 'MuiSwitch', 'switchBase'), theme).letterSpacing, '2px');

		const listButton = apply(slot(theme, 'MuiListItemButton', 'root'), theme)['&.Mui-selected'] as Record<
			string,
			unknown
		>;
		assert.equal(apply(slot(theme, 'MuiListItemButton', 'root'), theme).letterSpacing, '2px');
		assert.equal(listButton.backgroundImage, 'linear-gradient(currentColor, currentColor)');
		assert.equal(listButton.color, 'red');
		assert.equal(listButton.padding, '4px');

		const menu = apply(slot(theme, 'MuiMenuItem', 'root'), theme);
		const menuSelected = menu['&.Mui-selected'] as Record<string, unknown>;
		assert.equal(menu.letterSpacing, '2px');
		assert.equal(menuSelected.padding, '4px');
		assert.equal(menuSelected.backgroundImage, 'linear-gradient(currentColor, currentColor)');

		assert.equal(apply(slot(theme, 'MuiListItem', 'root'), theme).letterSpacing, '2px');
		assert.equal(
			(apply(slot(theme, 'MuiListItem', 'root'), theme)['&.Mui-selected'] as Record<string, unknown>).backgroundImage,
			'linear-gradient(currentColor, currentColor)'
		);

		assert.equal(apply(slot(theme, 'MuiOutlinedInput', 'root'), theme).backgroundColor, theme.palette.background.paper);
		assert.equal(apply(slot(theme, 'MuiOutlinedInput', 'root'), theme).letterSpacing, '2px');
		assert.equal(
			apply(slot(theme, 'MuiOutlinedInput', 'notchedOutline'), theme).borderColor,
			theme.palette.border.control
		);

		for (const component of ['MuiInput', 'MuiFilledInput'] as const) {
			const underline = apply(slot(theme, component, 'underline'), theme);
			assert.equal(underline.letterSpacing, '2px');
			assert.equal((underline['&::before'] as Record<string, unknown>).borderBottomColor, theme.palette.border.control);
		}

		assert.equal(apply(slot(theme, 'MuiInputBase', 'root'), theme).backgroundColor, theme.palette.background.paper);
		const input = apply(slot(theme, 'MuiInputBase', 'input'), theme);
		assert.equal(input.letterSpacing, '2px');
		assert.equal(
			(input['&::placeholder, &:focus::placeholder'] as Record<string, unknown>).color,
			theme.palette.text.secondary
		);
	});

	it('composes a CssBaseline callback when animations are off', async () => {
		const { theme } = await renderTheme(
			{
				components: {
					MuiCssBaseline: {
						styleOverrides: () => ({
							body: { margin: '4px' },
							'*, *::before, *::after': { color: 'red' }
						})
					}
				}
			},
			() => {
				window.localStorage.setItem('username', 'ada');
				window.localStorage.setItem('craftercms.ada.enableAnimations', 'false');
			}
		);
		const overrides = theme.components?.MuiCssBaseline?.styleOverrides as
			((themeArg: Theme) => Record<string, unknown>) | undefined;
		assert.equal(typeof overrides, 'function');
		const styles = overrides(theme);
		assert.equal((styles.body as Record<string, unknown>).margin, '4px');
		const universal = styles['*, *::before, *::after'] as Record<string, unknown>;
		assert.equal(universal.color, 'red');
		assert.equal(universal.transition, 'none !important');
		assert.equal(universal.animation, 'none !important');
	});

	it('still merges the default list-item selection styles when the caller sets none', async () => {
		const { theme } = await renderTheme();
		const root = apply(slot(theme, 'MuiListItem', 'root'), theme);
		const highlight = root['&.Mui-selected, &.Mui-selected:hover'] as Record<string, unknown>;
		const bar = root['&.Mui-selected'] as Record<string, unknown>;
		assert.equal(highlight.backgroundColor, palette.blue.highlight);
		assert.equal(bar.backgroundImage, 'linear-gradient(currentColor, currentColor)');
		assert.equal(bar.backgroundSize, '3px 100%');
	});
});
