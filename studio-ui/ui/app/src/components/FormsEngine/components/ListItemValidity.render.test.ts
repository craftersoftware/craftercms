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
 * An invalid list row keeps its colour change and also exposes a visually hidden, localized “Invalid item” cue.
 */

import '../../../../test/stringListDomSetup.mjs';
import '../../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { RawIntlProvider } = await import('react-intl');
const { createTestIntl } = await import('../../../../test/createTestIntl.mjs');
const { atom, createStore, Provider: JotaiProvider } = await import('jotai');
const { StableFormContext } = await import('../lib/formsEngineContext.ts');
const { ListItemValidity } = await import('./ListItemValidity.tsx');
import type { FieldValidityState } from '../lib/validators.ts';

const intl = createTestIntl();

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
});

function hiddenInvalidCue(host: HTMLElement) {
	return [...host.querySelectorAll('span')].find((span) => span.textContent === 'Invalid item') ?? null;
}

async function render(invalid: boolean) {
	const validity: FieldValidityState = invalid
		? { isValid: false, messages: [], invalidItems: [{ key: 'row-1', fields: [] }] }
		: { isValid: true, messages: [] };
	const validationAtom = atom(async () => validity);
	const store = createStore();
	await store.get(validationAtom);
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	await act(async () => {
		root.render(
			React.createElement(
				RawIntlProvider,
				{ value: intl as never },
				React.createElement(
					JotaiProvider,
					{ store },
					React.createElement(
						StableFormContext.Provider,
						{
							value: {
								atoms: { validationByFieldId: { features_o: validationAtom } }
							} as never
						},
						React.createElement(ListItemValidity, {
							fieldId: 'features_o',
							itemKey: 'row-1',
							primary: 'Row label'
						})
					)
				)
			)
		);
	});
	// Derived validity unwraps asynchronously; wait for the invalid cue when expected.
	if (invalid) {
		await act(async () => {
			await new Promise<void>((resolve) => {
				const deadline = Date.now() + 2000;
				const tick = () => {
					if (hiddenInvalidCue(host) || Date.now() > deadline) resolve();
					else setTimeout(tick, 10);
				};
				tick();
			});
		});
	}
	mounted.push({ unmount: () => root.unmount(), host });
	return host;
}

describe('ListItemValidity accessible cue', () => {
	it('omits the hidden invalid cue when the row is valid', async () => {
		const host = await render(false);
		assert.equal(host.textContent?.includes('Invalid item'), false);
		assert.equal(hiddenInvalidCue(host), null);
		assert.match(host.textContent ?? '', /Row label/);
	});

	it('keeps a visually hidden Invalid item cue in the accessibility tree when invalid', async () => {
		const host = await render(true);
		const cue = hiddenInvalidCue(host);
		assert.ok(cue);
		assert.equal(cue.getAttribute('aria-hidden'), null);
		assert.match(host.textContent ?? '', /Row label\s+Invalid item/);
	});
});
