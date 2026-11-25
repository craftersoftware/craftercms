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
 * History select mode puts a checkbox on the row with no FormControlLabel.
 * The name is the visible version date.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { RawIntlProvider, createIntl } = await import('react-intl');
const { Provider } = await import('react-redux');
const { configureStore } = await import('@reduxjs/toolkit');
const { VersionList } = await import('./VersionList.tsx');

const intl = createIntl({ locale: 'en', messages: {}, onError: () => undefined });
const store = configureStore({
	reducer: { uiConfig: (state = { locale: { localeCode: 'en-US', dateTimeFormatOptions: { hour12: true } } }) => state }
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

async function render() {
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
					React.createElement(VersionList, {
						versions: [
							{
								versionNumber: '2',
								modifiedDate: '2026-03-04T15:00:00.000Z',
								comment: 'Fix the hero',
								author: { username: 'ada' },
								committer: 'ada',
								oldPath: '',
								path: '/site/website/index.xml',
								revertible: true
							}
						],
						selected: [],
						isSelectMode: true,
						onItemClick() {}
					} as never)
				)
			)
		);
	});
	return host;
}

describe('version list checkbox', () => {
	it('names the select-mode checkbox from the visible version date', async () => {
		const host = await render();
		const input = host.querySelector<HTMLInputElement>('input[type="checkbox"]');
		assert.ok(input, 'version checkbox');
		const labelledBy = input.getAttribute('aria-labelledby');
		assert.ok(labelledBy, 'the checkbox input has no aria-labelledby');
		const label = host.querySelector(`[id="${labelledBy}"]`)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
		assert.match(label, /March/);
		assert.match(label, /2026/);
		assert.equal(input.closest('.MuiCheckbox-root')?.getAttribute('aria-label'), null);
	});
});
