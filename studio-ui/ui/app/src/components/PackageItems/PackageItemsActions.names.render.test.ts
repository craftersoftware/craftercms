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
 * The view switch already has a visible name. Its tooltip explains why tree view is unavailable. Without
 * describeChild an open tooltip puts aria-labelledby on the wrapper span.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { RawIntlProvider, createIntl } = await import('react-intl');
const { PackageItemsActions } = await import('./PackageItemsActions.tsx');

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

describe('package items view switch tooltip', () => {
	it('keeps the visible name and leaves the wrapper unnamed while the tooltip is open', async () => {
		const host = document.createElement('div');
		document.body.appendChild(host);
		const root = createRoot(host);
		mounted.push({ unmount: () => root.unmount(), host });
		await act(async () => {
			root.render(
				React.createElement(
					RawIntlProvider,
					{ value: intl },
					React.createElement(PackageItemsActions, {
						isTreeView: false,
						onSetIsTreeView() {},
						setExpandedPaths() {},
						disableTreeView: true,
						maxTreeItems: 30
					})
				)
			);
		});
		const button = Array.from(host.querySelectorAll('button')).find(
			(candidate) => candidate.textContent?.trim() === 'Tree View'
		);
		assert.ok(button, 'the view switch has no visible name');
		const span = button.parentElement;
		assert.equal(span?.tagName, 'SPAN');
		await act(async () => {
			span.dispatchEvent(new window.MouseEvent('mouseover', { bubbles: true }));
		});
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 200));
		});
		assert.equal(document.querySelectorAll('[role="tooltip"]').length, 1, 'the tooltip did not open');
		assert.equal(button.textContent?.trim(), 'Tree View');
		assert.equal(button.getAttribute('aria-labelledby'), null);
		assert.equal(span.getAttribute('aria-label'), null);
		assert.equal(span.getAttribute('aria-labelledby'), null);
	});
});
