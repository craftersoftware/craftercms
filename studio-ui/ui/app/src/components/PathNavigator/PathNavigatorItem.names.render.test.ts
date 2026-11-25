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
 * In select mode the row checkbox has no FormControlLabel. Its name is the visible item label.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { RawIntlProvider, createIntl } = await import('react-intl');
const { default: PathNavigatorItem } = await import('./PathNavigatorItem.tsx');

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

const item = {
	label: 'Articles',
	path: '/site/website/articles',
	systemType: 'folder',
	mimeType: 'text/plain',
	previewUrl: null,
	childrenCount: 2,
	stateMap: {}
};

async function render() {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	mounted.push({ unmount: () => root.unmount(), host });
	await act(async () => {
		root.render(
			React.createElement(
				RawIntlProvider,
				{ value: intl },
				React.createElement(PathNavigatorItem, {
					item,
					locale: 'en',
					isSelectMode: true,
					onItemChecked() {}
				} as never)
			)
		);
	});
	return host;
}

describe('path navigator item checkbox', () => {
	it('names the select-mode checkbox from the visible item label', async () => {
		const host = await render();
		const input = host.querySelector<HTMLInputElement>('input[type="checkbox"]');
		assert.ok(input, 'select checkbox');
		const labelledBy = input.getAttribute('aria-labelledby');
		assert.ok(labelledBy, 'the checkbox input has no aria-labelledby');
		assert.equal(host.querySelector(`[id="${labelledBy}"]`)?.textContent, 'Articles');
		assert.equal(input.closest('.MuiCheckbox-root')?.getAttribute('aria-label'), null);
	});
});
