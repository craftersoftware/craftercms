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
 * Continue stays disabled until the warning is acknowledged. Its tooltip is a React element on the span that
 * keeps the tip open, so without describeChild an open tooltip puts aria-labelledby on that span.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

globalThis.ShadowRoot ??= window.ShadowRoot ?? class ShadowRoot {};

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { RawIntlProvider, createIntl } = await import('react-intl');
const { Provider } = await import('react-redux');
const { configureStore } = await import('@reduxjs/toolkit');
const { FolderMoveAlertDialog } = await import('./FolderMoveAlertDialog.tsx');

const intl = createIntl({ locale: 'en', messages: {}, onError: () => undefined });

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	await act(async () => {
		for (const { unmount, host } of mounted.splice(0)) {
			unmount();
			host.remove();
		}
	});
});

async function render() {
	const store = configureStore({ reducer: (state = {}) => state });
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	mounted.push({ unmount: () => root.unmount(), host });
	await act(async () => {
		root.render(
			React.createElement(
				Provider,
				{ store },
				React.createElement(
					RawIntlProvider,
					{ value: intl },
					React.createElement(FolderMoveAlertDialog, {
						open: true,
						item: { path: '/site/website' }
					} as never)
				)
			)
		);
	});
	return host;
}

describe('folder move continue tooltip', () => {
	it('leaves the disabled Continue wrapper unnamed while the tooltip is open', async () => {
		await render();
		const continueButton = Array.from(document.querySelectorAll('button')).find(
			(button) => button.textContent?.trim() === 'Continue'
		);
		assert.ok(continueButton, 'the Continue button did not render');
		assert.equal(continueButton.disabled, true);
		const span = continueButton.parentElement;
		assert.equal(span?.tagName, 'SPAN');
		await act(async () => {
			span.dispatchEvent(new window.MouseEvent('mouseover', { bubbles: true }));
		});
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 200));
		});
		assert.equal(document.querySelectorAll('[role="tooltip"]').length, 1, 'the tooltip did not open');
		assert.equal(continueButton.textContent?.trim(), 'Continue');
		assert.equal(continueButton.getAttribute('aria-labelledby'), null);
		assert.equal(span.getAttribute('aria-label'), null);
		assert.equal(span.getAttribute('aria-labelledby'), null);
	});
});
