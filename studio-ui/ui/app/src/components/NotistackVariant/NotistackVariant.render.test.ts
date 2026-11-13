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
 * Toast content components on their real paths, mounted with MUI's real Alert and ThemeProvider: the
 * Alert-based `NotistackVariant` (error, warning, success, info) and `NotistackDefaultVariant` (default).
 * Checks the live-region roles, that no id is duplicated, and that the action buttons stay named.
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
const { default: IconButton } = await import('@mui/material/IconButton');

const { NotistackVariant, NotistackDefaultVariant } = await import('./NotistackVariant.tsx');
const { TOAST_HOST_CLASS } = await import('../../utils/a11y/toastHostClass.ts');

const mounted: Array<{ unmount(): Promise<void>; container: HTMLElement }> = [];
afterEach(async () => {
	for (const entry of mounted.splice(0)) {
		await act(async () => entry.unmount());
		entry.container.remove();
	}
});

async function mountToast(
	Content: typeof NotistackVariant | typeof NotistackDefaultVariant,
	props: Record<string, unknown>
) {
	const container = document.createElement('div');
	document.body.append(container);
	const root = createRoot(container);
	await act(async () => {
		root.render(
			React.createElement(
				ThemeProvider,
				{ theme: createTheme() },
				React.createElement(Content as never, {
					id: 'toast-1',
					variant: 'success',
					message: 'Saved',
					// notistack's SnackbarItem always supplies these to its content component.
					iconVariant: {},
					hideIconVariant: true,
					...props
				})
			)
		);
	});
	mounted.push({ unmount: async () => root.unmount(), container });
	return container;
}

const closeAction = () =>
	React.createElement(IconButton, { 'aria-label': 'Close', id: 'toast-close' }, React.createElement('span', null, 'x'));

describe('toast roles', () => {
	for (const variant of ['success', 'info'] as const) {
		it(`${variant} is a polite status`, async () => {
			const container = await mountToast(NotistackVariant, { variant });
			assert.equal(container.querySelectorAll('[role="status"]').length, 1);
			assert.equal(container.querySelectorAll('[role="alert"]').length, 0);
		});
	}

	for (const variant of ['error', 'warning'] as const) {
		it(`${variant} is an alert`, async () => {
			const container = await mountToast(NotistackVariant, { variant });
			assert.equal(container.querySelectorAll('[role="alert"]').length, 1);
			assert.equal(container.querySelectorAll('[role="status"]').length, 0);
		});
	}

	it('default is a polite status and carries no alert role', async () => {
		const container = await mountToast(NotistackDefaultVariant, { variant: 'default' });
		assert.equal(container.querySelectorAll('[role="status"]').length, 1);
		assert.equal(container.querySelectorAll('[role="alert"]').length, 0);
	});
});

describe('toast markup', () => {
	it('puts the toast-only class on both content components', async () => {
		const alertBased = await mountToast(NotistackVariant, { variant: 'success' });
		const plain = await mountToast(NotistackDefaultVariant, { variant: 'default' });
		assert.equal(alertBased.querySelectorAll(`.${TOAST_HOST_CLASS}`).length, 1);
		assert.equal(plain.querySelectorAll(`.${TOAST_HOST_CLASS}`).length, 1);
	});

	it('does not render the id notistack puts on its default content', async () => {
		await mountToast(NotistackDefaultVariant, { variant: 'default' });
		await mountToast(NotistackDefaultVariant, { variant: 'default', id: 'toast-2' });
		assert.equal(document.querySelectorAll('#notistack-snackbar').length, 0);
		const ids = [...document.querySelectorAll('[id]')].map((node) => node.id);
		assert.equal(new Set(ids).size, ids.length, 'no id is repeated across toasts');
	});

	it('renders the title and message of an Alert-based toast once', async () => {
		const container = await mountToast(NotistackVariant, {
			variant: 'info',
			alertTitle: 'Heads up',
			message: 'Read this'
		});
		assert.equal(container.textContent, 'Heads upRead this');
	});
});

describe('toast actions', () => {
	for (const [name, Content, variant] of [
		['NotistackVariant', NotistackVariant, 'error'],
		['NotistackDefaultVariant', NotistackDefaultVariant, 'default']
	] as const) {
		it(`keeps a named close button reachable (${name})`, async () => {
			const container = await mountToast(Content, { variant, action: closeAction });
			const button = container.querySelector<HTMLElement>('#toast-close');
			assert.ok(button);
			assert.equal(button.getAttribute('aria-label'), 'Close');
		});
	}
});

describe('toast content refs', () => {
	it('forwards its ref to the toast element, which notistack transitions need (NotistackDefaultVariant)', async () => {
		const ref = React.createRef<HTMLDivElement>();
		const container = await mountToast(NotistackDefaultVariant, { variant: 'default', ref });
		assert.ok(ref.current);
		assert.equal(ref.current, container.querySelector(`.${TOAST_HOST_CLASS}`));
	});

	it('forwards its ref to the toast element (NotistackVariant)', async () => {
		const ref = React.createRef<HTMLDivElement>();
		const container = await mountToast(NotistackVariant, { variant: 'success', ref });
		assert.ok(ref.current);
		assert.equal(ref.current, container.querySelector(`.${TOAST_HOST_CLASS}`));
	});
});

describe('toast focus halo', () => {
	// Emotion inserts rules with insertRule, so they are in the CSSOM and not in the style elements' text.
	const cssRules = () =>
		[...document.styleSheets].flatMap((sheet) => [...sheet.cssRules].map((rule) => (rule as CSSStyleRule).cssText));

	for (const [name, Content, variant] of [
		['NotistackVariant', NotistackVariant, 'info'],
		['NotistackDefaultVariant', NotistackDefaultVariant, 'default']
	] as const) {
		it(`paints a box-shadow on .Mui-focusVisible inside the toast (${name})`, async () => {
			const container = await mountToast(Content, { variant, action: closeAction });
			const host = container.querySelector<HTMLElement>(`.${TOAST_HOST_CLASS}`);
			const owned = [host, ...(host?.querySelectorAll('*') ?? [])].flatMap((node) => [...(node?.classList ?? [])]);
			const rule = cssRules().find(
				(text) => text.includes('.Mui-focusVisible') && owned.some((className) => text.includes(`.${className}`))
			);
			assert.ok(rule, 'a rule scoped to this toast targets .Mui-focusVisible');
			assert.match(rule, /box-shadow:\s*0 0 0 4px /);
		});
	}
});
