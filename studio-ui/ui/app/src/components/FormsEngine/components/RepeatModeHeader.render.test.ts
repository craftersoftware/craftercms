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
 * A repeat item form only gets a titleId as the root form of a dialog, and a root repeat form cannot be prepared
 * yet, so the dialog cannot reach this header. The header is rendered on its own to keep its id wired.
 */

import '../../../../test/stringListDomSetup.mjs';
import '../../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, it } from 'node:test';

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { RawIntlProvider } = await import('react-intl');
const { createTestIntl } = await import('../../../../test/createTestIntl.mjs');
const { ItemMetaContext } = await import('../lib/formsEngineContext.ts');
const { RepeatModeHeader } = await import('./RepeatModeHeader.tsx');

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
});

it('puts the title id on the repeat item heading', async () => {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	const itemMeta = { contentType: { fields: { rows_o: { name: 'Rows' } } } };
	await act(async () => {
		root.render(
			React.createElement(
				RawIntlProvider,
				{ value: createTestIntl() },
				React.createElement(
					ItemMetaContext.Provider,
					{ value: itemMeta as never },
					React.createElement(RepeatModeHeader, {
						repeat: { fieldId: 'rows_o', index: 1 },
						titleId: 'repeat-title'
					} as never)
				)
			)
		);
	});
	mounted.push({ unmount: () => root.unmount(), host });
	const title = document.getElementById('repeat-title');
	assert.ok(title, 'the repeat heading has no id');
	assert.equal(title.tagName, 'H3');
	assert.equal(title.textContent?.trim(), 'Item # 2');
});
