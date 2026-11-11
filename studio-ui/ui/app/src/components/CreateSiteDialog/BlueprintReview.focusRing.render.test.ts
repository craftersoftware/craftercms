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
 * The blueprint review password toggle is reached by keyboard and keeps focus on itself, so it needs the
 * same visible indicator as the login toggle (WCAG 2.1 SC 2.4.7, 1.4.11). It relies on the theme's
 * `focusVisible` through ButtonBase, not a local ring, and that has to hold with animations off too.
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
const { default: CrafterThemeProvider } = await import('../CrafterThemeProvider/CrafterThemeProvider.tsx');
const { default: BlueprintReview } = await import('./BlueprintReview.tsx');
const { focusRingColor, focusRingWidth } = await import('../../styles/focusRing.ts');

const intl = createTestIntl();

(globalThis as any).localStorage ??= window.localStorage;

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
});

const blueprint = {
	id: 'GIT',
	type: 'blueprint',
	name: 'Test blueprint',
	description: 'A blueprint with a password parameter',
	documentation: '',
	media: {},
	parameters: [{ name: 'repoPassword', label: 'Repo password', type: 'PASSWORD', defaultValue: 'default' }]
} as any;

const inputs = {
	siteName: 'My Project',
	siteId: 'myproject',
	description: '',
	gitBranch: 'main',
	blueprintFields: { repoPassword: 'secret' }
} as any;

async function render(enableAnimations: boolean) {
	window.localStorage.clear();
	window.localStorage.setItem('username', 'admin');
	window.localStorage.setItem('craftercms.admin.enableAnimations', String(enableAnimations));
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	await act(async () => {
		root.render(
			React.createElement(
				CrafterThemeProvider,
				null,
				React.createElement(
					RawIntlProvider,
					{ value: intl },
					React.createElement(BlueprintReview, { inputs, blueprint, onGoTo: () => undefined } as never)
				)
			) as never
		);
	});
	mounted.push({ unmount: () => root.unmount(), host });
	const toggle = host.querySelector<HTMLElement>('button[aria-label][aria-pressed]');
	return { host, toggle };
}

describe('BlueprintReview password toggle', () => {
	it('has a stable name, exposes the state and describes itself with the parameter label', async () => {
		const { host, toggle } = await render(true);
		assert.ok(toggle, 'the password toggle exists');
		assert.equal(toggle.getAttribute('aria-label'), 'Show password');
		assert.equal(toggle.getAttribute('aria-pressed'), 'false');
		const describedBy = toggle.getAttribute('aria-describedby');
		assert.ok(describedBy);
		const label = [...host.querySelectorAll('[id]')].find((el) => el.id === describedBy);
		assert.match(label?.textContent ?? '', /Repo password/);
		await act(async () => {
			toggle.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
		});
		assert.equal(toggle.getAttribute('aria-pressed'), 'true');
	});

	it('draws the theme ring on keyboard focus with animations off', async () => {
		const { toggle } = await render(false);
		await act(async () => {
			document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
			toggle.focus();
			await new Promise((resolve) => setTimeout(resolve, 20));
		});
		assert.match(toggle.className, /Mui-focusVisible/);
		const style = window.getComputedStyle(toggle);
		assert.equal(style.outlineStyle, 'solid');
		assert.equal(style.outlineWidth, `${focusRingWidth}px`);
		assert.equal(style.outlineColor, 'rgb(0, 104, 218)');
		assert.equal(focusRingColor.light, '#0068DA');
	});
});
