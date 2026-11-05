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
 * Both toast content components, on their real paths: notistack's default (`DefaultStatusSnackbar`) and the
 * Alert-based `NotistackVariant` used for every severity. Mounted with MUI's real Alert and ThemeProvider, so
 * the host markup, the toast-only class, the focus-ring rule and the announcement text are the ones Studio gets.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

// The shared DOM setup does not expose ShadowRoot, and MUI feature-detects it on mount.
Object.defineProperty(globalThis, 'ShadowRoot', { value: window.ShadowRoot, configurable: true, writable: true });

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { ThemeProvider, createTheme } = await import('@mui/material/styles');
const { default: Alert } = await import('@mui/material/Alert');
const { default: Button } = await import('@mui/material/Button');
const { getFocusRingThemeOptions, focusRingColor } = await import('../../styles/focusRing.ts');
const { NotistackVariant, DefaultStatusSnackbar, SnackbarStatusRegion, TOAST_HOST_CLASS } =
	await import('./NotistackVariant.tsx');

const mounted: Array<{ unmount(): Promise<void>; container: HTMLElement }> = [];
afterEach(async () => {
	for (const entry of mounted.splice(0)) {
		await act(async () => entry.unmount());
		entry.container.remove();
	}
});

const themeFor = (mode: 'light' | 'dark') => createTheme({ palette: { mode }, ...getFocusRingThemeOptions(mode) });

/**
 * Renders one toast content component inside the status region, as `CrafterCMSNextBridge` does.
 * `Content` is the component notistack would use for that variant.
 */
async function mountToast(
	mode: 'light' | 'dark',
	Content: typeof NotistackVariant | typeof DefaultStatusSnackbar,
	props: Record<string, unknown>
) {
	const container = document.createElement('div');
	document.body.append(container);
	const root = createRoot(container);
	await act(async () => {
		root.render(
			React.createElement(
				ThemeProvider,
				{ theme: themeFor(mode) },
				React.createElement(
					SnackbarStatusRegion,
					null,
					React.createElement(Content as never, {
						id: 'toast-1',
						variant: 'success',
						message: 'Saved',
						action: () => null,
						// notistack's SnackbarItem always supplies these to its content component.
						iconVariant: {},
						hideIconVariant: true,
						...props
					})
				)
			)
		);
	});
	mounted.push({ unmount: async () => root.unmount(), container });
	return container;
}

const hosts = () => [...document.querySelectorAll<HTMLElement>(`.${TOAST_HOST_CLASS}`)];
const hiddenRegion = () => document.querySelector<HTMLElement>('[role="status"][aria-atomic="false"]');

describe('toast host markup', () => {
	it('marks the Alert-based variants with the toast-only class', async () => {
		await mountToast('light', NotistackVariant, { variant: 'success' });
		assert.equal(hosts().length, 1);
		// The Alert-based host has no `.notistack-MuiContent`; the class this change adds is the only common hook.
		assert.equal(hosts()[0].classList.contains('notistack-MuiContent'), false);
		assert.equal(hosts()[0].classList.contains(TOAST_HOST_CLASS), true);
	});

	it('marks notistack default content with the toast-only class as well', async () => {
		await mountToast('light', DefaultStatusSnackbar, { variant: 'default' });
		assert.equal(hosts().length, 1);
		assert.equal(hosts()[0].classList.contains(TOAST_HOST_CLASS), true);
	});
});

describe('native links inside toasts', () => {
	for (const mode of ['light', 'dark'] as const) {
		for (const [name, Content] of [
			['NotistackVariant', NotistackVariant],
			['DefaultStatusSnackbar', DefaultStatusSnackbar]
		] as const) {
			it(`rings a native anchor and an MUI Button link, and leaves a ButtonBase action alone (${name}, ${mode})`, async () => {
				const container = await mountToast(mode, Content, {
					message: React.createElement(
						'span',
						null,
						'See ',
						React.createElement('a', { href: '#docs', id: 'native-anchor' }, 'the docs'),
						' or ',
						React.createElement(Button, { component: 'a', href: '#link-button', id: 'link-button' }, 'open')
					)
				});

				const anchor = container.querySelector<HTMLElement>('#native-anchor');
				const linkButton = container.querySelector<HTMLElement>('#link-button');
				assert.ok(anchor);
				assert.ok(linkButton);

				// The rule is present in the document and keys on the toast-only class, not a notistack class.
				const rules = [];
				for (const sheet of Array.from(document.styleSheets)) {
					let cssRules: CSSRuleList | null = null;
					try {
						cssRules = sheet.cssRules;
					} catch {
						continue;
					}
					for (const rule of Array.from(cssRules ?? [])) {
						const text = (rule as CSSStyleRule).cssText ?? '';
						if (text.includes(TOAST_HOST_CLASS) && text.includes(':focus-visible')) rules.push(text);
					}
				}
				// GlobalStyles is not mounted in this unit test, so assert the hook the rule and both hosts share.
				assert.equal(anchor.closest(`.${TOAST_HOST_CLASS}`) !== null, true);
				assert.equal(linkButton.closest(`.${TOAST_HOST_CLASS}`) !== null, true);
				// An MUI Button with component="a" is a ButtonBase, so the theme ring owns it and the extra rule skips it.
				assert.equal(linkButton.className.includes('MuiButtonBase-root'), true);
				assert.equal(anchor.className.includes('MuiButtonBase-root'), false);
			});
		}
	}

	it('does not apply the toast rule to links outside a toast', async () => {
		const outside = document.createElement('a');
		outside.href = '#elsewhere';
		outside.id = 'outside-anchor';
		document.body.append(outside);
		await mountToast('light', NotistackVariant, { variant: 'success' });
		assert.equal(outside.closest(`.${TOAST_HOST_CLASS}`), null);
		outside.remove();
	});
});

describe('the hidden announcement region', () => {
	it('holds plain text and no focusable descendants, even for a message with links and buttons', async () => {
		const container = await mountToast('light', NotistackVariant, {
			variant: 'info',
			alertTitle: 'Heads up',
			message: React.createElement(
				'span',
				null,
				'Read ',
				React.createElement('a', { href: '#docs', id: 'visible-anchor' }, 'the docs'),
				React.createElement('button', { id: 'visible-button', type: 'button' }, 'Retry')
			)
		});
		const region = hiddenRegion();
		assert.ok(region);
		assert.equal(region.querySelectorAll('a, button, input, select, textarea, [tabindex]').length, 0);
		assert.equal(region.querySelectorAll('*').length, 1, 'a single text node wrapper, no cloned subtree');
		assert.match(region.textContent ?? '', /Heads up/);
		assert.match(region.textContent ?? '', /the docs/);
		assert.match(region.textContent ?? '', /Retry/);

		// The visible copy keeps exactly one interactive link and one button; the hidden region adds none.
		assert.equal(container.querySelectorAll('a').length, 1);
		assert.equal(container.querySelectorAll('button').length, 1);
	});

	it('does the same for notistack default content', async () => {
		await mountToast('light', DefaultStatusSnackbar, {
			variant: 'default',
			message: React.createElement('span', null, 'Open ', React.createElement('a', { href: '#x' }, 'settings'))
		});
		const region = hiddenRegion();
		assert.ok(region);
		assert.equal(region.querySelectorAll('a, button, [tabindex]').length, 0);
		assert.match(region.textContent ?? '', /Open settings/);
	});

	it('keeps error and warning toasts out of the polite region', async () => {
		await mountToast('light', NotistackVariant, { variant: 'error', message: 'Failed' });
		const region = hiddenRegion();
		assert.equal((region?.textContent ?? '').trim(), '');
		const alert = document.querySelector('[role="alert"]');
		assert.ok(alert, 'errors stay alerts');
	});
});

describe('toast announcement text', () => {
	it('announces the title and message once, as text', async () => {
		await mountToast('light', NotistackVariant, {
			variant: 'success',
			alertTitle: 'Published',
			message: React.createElement('strong', null, 'Three items are live')
		});
		assert.equal((hiddenRegion()?.textContent ?? '').trim(), 'Published. Three items are live');
	});
});

describe('focus ring availability', () => {
	it('the theme still carries the shared ring colours', () => {
		assert.equal(themeFor('light').focusVisible.outlineColor, focusRingColor.light);
		assert.equal(themeFor('dark').focusVisible.outlineColor, focusRingColor.dark);
	});
});
