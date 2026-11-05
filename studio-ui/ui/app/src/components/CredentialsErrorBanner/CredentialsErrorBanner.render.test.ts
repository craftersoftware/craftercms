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
const { ThemeProvider, createTheme } = await import('@mui/material/styles');
const { default: CredentialsErrorBanner } = await import('./CredentialsErrorBanner.tsx');

// WCAG 2.1 relative luminance and contrast ratio.
const luminance = (rgb: string) => {
	const [r, g, b] = (rgb.match(/\d+/g) ?? []).slice(0, 3).map((value) => {
		const v = Number(value) / 255;
		return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: string, b: string) => {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
};

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
});

async function renderWithErrorMain(main: string, mode: 'light' | 'dark' = 'light') {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	await act(async () => {
		root.render(
			React.createElement(
				ThemeProvider,
				{ theme: createTheme({ palette: { mode, error: { main } } }) },
				React.createElement(CredentialsErrorBanner, { id: 'loginFormError' }, 'Incorrect username or password.')
			) as never
		);
	});
	mounted.push({ unmount: () => root.unmount(), host });
	const alert = host.querySelector<HTMLElement>('[role="alert"]');
	const icon = alert?.querySelector<SVGElement>('.MuiSvgIcon-root');
	return {
		alert,
		background: getComputedStyle(alert).backgroundColor,
		text: getComputedStyle(alert).color,
		icon: getComputedStyle(icon).color
	};
}

describe('CredentialsErrorBanner text contrast', () => {
	// The fills of develop's theme and of the 1427 contrast work, light and dark.
	it('uses black on the light develop fill #FF3B30', async () => {
		const { background, text, icon } = await renderWithErrorMain('#FF3B30');
		assert.equal(background, 'rgb(255, 59, 48)');
		assert.equal(text, 'rgb(0, 0, 0)');
		assert.ok(contrast(background, text) >= 4.5, `${text} on ${background} is ${contrast(background, text)}`);
		assert.equal(icon, text);
	});

	it('uses black on the dark develop fill #FF6961', async () => {
		const { background, text, icon } = await renderWithErrorMain('#FF6961', 'dark');
		assert.equal(text, 'rgb(0, 0, 0)');
		assert.ok(contrast(background, text) >= 4.5, `${text} on ${background} is ${contrast(background, text)}`);
		assert.equal(icon, text);
	});

	it('uses black on the dark 1427 fill #FF7A73', async () => {
		const { background, text, icon } = await renderWithErrorMain('#FF7A73', 'dark');
		assert.equal(text, 'rgb(0, 0, 0)');
		assert.ok(contrast(background, text) >= 4.5, `${text} on ${background} is ${contrast(background, text)}`);
		assert.equal(icon, text);
	});

	it('uses white on the light 1427 fill #D12E25, where black is 4.13:1', async () => {
		const { background, text, icon } = await renderWithErrorMain('#D12E25');
		assert.equal(text, 'rgb(255, 255, 255)');
		assert.ok(contrast(background, text) >= 4.5, `${text} on ${background} is ${contrast(background, text)}`);
		assert.ok(contrast(background, 'rgb(0, 0, 0)') < 4.5);
		assert.equal(icon, text);
	});
});
