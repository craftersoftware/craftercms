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
 * The theme's color-contrast overrides have to win over MUI's variant styles, which set the same
 * properties. Computed style is the check: a styleOverrides entry that loses the cascade would leave
 * the failing pair in place while the ratio test still passed.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const React = await import('react');
const { createRoot } = await import('react-dom/client');
const { act } = await import('react');
const { default: Avatar } = await import('@mui/material/Avatar');
const { default: ToggleButton } = await import('@mui/material/ToggleButton');
const { default: CrafterThemeProvider } = await import('./CrafterThemeProvider.tsx');
const { PublishingStatusAvatar } = await import('../PublishingStatusAvatar/PublishingStatusAvatar.tsx');

(globalThis as any).localStorage ??= window.localStorage;

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
});

async function render(node: React.ReactElement) {
	window.localStorage.clear();
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	await act(async () => {
		root.render(React.createElement(CrafterThemeProvider, null, node) as never);
	});
	mounted.push({ unmount: () => root.unmount(), host });
	return host;
}

describe('theme color contrast overrides', () => {
	it('paints default avatar initials in text.primary on the grey disc', async () => {
		const host = await render(React.createElement(Avatar, null, 'AB'));
		const avatar = host.querySelector<HTMLElement>('.MuiAvatar-colorDefault');
		assert.ok(avatar);
		const style = window.getComputedStyle(avatar);
		// text.primary is rgba(0, 0, 0, 0.87). grey[400] is #bdbdbd.
		assert.equal(style.color, 'rgba(0, 0, 0, 0.87)');
		assert.equal(style.backgroundColor, 'rgb(189, 189, 189)');
	});

	it('paints a selected primary toggle in blue.shade', async () => {
		const host = await render(
			React.createElement(ToggleButton, { value: 'stay', selected: true, color: 'primary' }, 'Stay')
		);
		const button = host.querySelector<HTMLElement>('.Mui-selected');
		assert.ok(button);
		// palette.blue.shade is #0040DD. primary.main (#0068DA) is the colour the override replaces.
		assert.equal(window.getComputedStyle(button).color, 'rgb(0, 64, 221)');
	});

	it('paints a background status avatar with the contrast colour of the success fill', async () => {
		const host = await render(
			React.createElement(PublishingStatusAvatar, { status: 'ready', enabled: true, variant: 'background' })
		);
		const avatar = host.querySelector<HTMLElement>('.MuiAvatar-root.ready');
		assert.ok(avatar);
		const style = window.getComputedStyle(avatar);
		// Light success.main is #217F39. text.primary on it is 3.82:1; white is 5.05:1.
		assert.equal(style.backgroundColor, 'rgb(33, 127, 57)');
		assert.equal(style.color, 'rgb(255, 255, 255)');
	});
});
