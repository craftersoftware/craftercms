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
 * The password visibility toggle keeps focus on itself after a keyboard activation, so it needs its own
 * visible indicator (WCAG 2.1 SC 2.4.7, 1.4.11). It has no local ring: the theme's `focusVisible` covers every
 * ButtonBase, which is what `CrafterThemeProvider` now sets, and that has to keep holding when animations are
 * off, where `MuiButtonBase` also turns the ripple off and the ripple is the only other focus cue.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const React = await import('react');
const { createRoot } = await import('react-dom/client');
const { act } = await import('react');
const { useTheme } = await import('@mui/material/styles');
const { IntlProvider } = await import('react-intl');
const { default: CrafterThemeProvider } = await import('../CrafterThemeProvider/CrafterThemeProvider.tsx');
const { default: PasswordTextField } = await import('./PasswordTextField.tsx');
const { focusRingColor, focusRingOffset, focusRingWidth } = await import('../../styles/focusRing.ts');

(globalThis as any).localStorage ??= window.localStorage;

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
});

let seenTheme: any;

function Probe() {
	seenTheme = useTheme();
	return React.createElement(
		IntlProvider,
		{ locale: 'en', messages: {}, onError() {} },
		React.createElement(PasswordTextField, { name: 'password', label: 'Password' } as never)
	);
}

async function render(enableAnimations: boolean) {
	window.localStorage.clear();
	window.localStorage.setItem('username', 'admin');
	window.localStorage.setItem('craftercms.admin.enableAnimations', String(enableAnimations));
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	await act(async () => {
		root.render(React.createElement(CrafterThemeProvider, null, React.createElement(Probe)) as never);
	});
	mounted.push({ unmount: () => root.unmount(), host });
	const toggle = host.querySelector<HTMLElement>('button');
	return { host, toggle };
}

/** Focus the way a keyboard does, so ButtonBase applies its focus-visible class. */
async function keyboardFocus(element: HTMLElement) {
	await act(async () => {
		document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
		element.focus();
		await new Promise((resolve) => setTimeout(resolve, 20));
	});
}

describe('PasswordTextField visibility toggle focus ring', () => {
	it('draws the theme ring when animations are off, where the ripple is gone too', async () => {
		const { toggle } = await render(false);
		assert.equal(seenTheme.components.MuiButtonBase.defaultProps.disableRipple, true);
		await keyboardFocus(toggle);
		assert.match(toggle.className, /Mui-focusVisible/);
		const style = window.getComputedStyle(toggle);
		assert.equal(style.outlineStyle, 'solid');
		assert.equal(style.outlineWidth, `${focusRingWidth}px`);
		assert.equal(style.outlineColor, 'rgb(0, 104, 218)');
		assert.equal(focusRingColor.light, '#0068DA');
		assert.ok(style.outlineOffset.startsWith('calc('), 'offset follows MUI, so a clipping ancestor can inset it');
		assert.ok(focusRingOffset >= focusRingWidth);
	});

	it('draws the same ring when animations are on', async () => {
		const { toggle } = await render(true);
		await keyboardFocus(toggle);
		const style = window.getComputedStyle(toggle);
		assert.equal(style.outlineStyle, 'solid');
		assert.equal(style.outlineColor, 'rgb(0, 104, 218)');
	});
});
