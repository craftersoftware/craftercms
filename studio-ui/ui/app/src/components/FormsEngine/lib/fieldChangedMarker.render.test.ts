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
 * The field's changed marker (the "Rollback changes" menu entry) comes from the `changedFieldIds` Set through an atom.
 * It follows an edit and a rollback made through the field's own atom, and a change to the Set that no value write
 * accompanies, such as the checkpoint after a save.
 */

import '../../../../test/stringListDomSetup.mjs';
import '../../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { ContentTypeField } from '../../../models/ContentType';

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { RawIntlProvider, createIntl } = await import('react-intl');
const { Provider: ReduxProvider } = await import('react-redux');
const { configureStore } = await import('@reduxjs/toolkit');
const { createStore, Provider: JotaiProvider } = await import('jotai');
const { FormsEngineField } = await import('../components/FormsEngineField.tsx');
const { FormsEngineFormContextApi, ItemMetaContext, StableFormContext, StableGlobalContext } =
	await import('./formsEngineContext.ts');
const { createFormVisibilityAtoms } = await import('./formVisibility.ts');
const { createFieldAtoms } = await import('./formUtils.tsx');
const { notifyChangedFieldIds } = await import('./changedFieldAtoms.ts');
const { Subject } = await import('rxjs');

const reduxStore = configureStore({
	reducer: {
		sites: (state = { active: 'editorial' }) => state,
		content: (state = { itemsByPath: {} }) => state,
		contentTypes: (state = { byId: {}, isFetching: false }) => state
	}
});

// The test build adds no message ids, and react-intl throws on a descriptor without one. Use the default message.
const baseIntl = createIntl({ locale: 'en', onError: () => undefined });
const intl = { ...baseIntl, formatMessage: (descriptor: { defaultMessage?: string }) => descriptor.defaultMessage };

const field = { id: 'title_s', name: 'Title', type: 'input', validations: {}, helpText: '' } as ContentTypeField;

const mountedRoots: Array<{ unmount(): Promise<void> }> = [];
// A failed assertion skips the test's own unmount. The open root would keep the process alive.
afterEach(async () => {
	for (const mounted of mountedRoots.splice(0)) await mounted.unmount();
});

/** A field whose atoms are the real ones, so a write goes through the same dirty tracking as the form's. */
async function mount() {
	const jotai = createStore();
	const stable = {
		atoms: { valueByFieldId: {}, validationByFieldId: {}, ...createFormVisibilityAtoms() } as Record<string, unknown>,
		changedFieldIds: new Set<string>(),
		fieldUpdates$: new Subject<string>(),
		itemMeta: { sourceMap: null, path: '/site/components/thing.xml' },
		originalValues: { title_s: 'original' },
		props: null,
		state: null,
		affectedPluginControlFields: [],
		formControllerState: null
	};
	const [valueAtom, validationAtom] = createFieldAtoms(field, 'original', { current: stable } as never);
	(stable.atoms.valueByFieldId as Record<string, unknown>).title_s = valueAtom;
	(stable.atoms.validationByFieldId as Record<string, unknown>).title_s = validationAtom;
	function Probe() {
		return React.createElement(FormsEngineField, { field, isValid: true });
	}
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	await act(async () => {
		root.render(
			React.createElement(
				ReduxProvider,
				{ store: reduxStore },
				React.createElement(
					JotaiProvider,
					{ store: jotai },
					React.createElement(
						RawIntlProvider,
						{ value: intl as never },
						React.createElement(
							StableGlobalContext.Provider,
							{ value: { formsStackData: [], api: {} } as never },
							React.createElement(
								StableFormContext.Provider,
								{ value: stable as never },
								React.createElement(
									ItemMetaContext.Provider,
									{ value: { sourceMap: null } as never },
									React.createElement(
										FormsEngineFormContextApi.Provider,
										{ value: { rollbackField: () => jotai.set(valueAtom, 'original') } as never },
										React.createElement(Probe)
									)
								)
							)
						)
					)
				)
			)
		);
	});
	await act(async () =>
		host.querySelector<HTMLButtonElement>('[data-testid="MoreVertRoundedIcon"]').closest('button').click()
	);
	const hasRollback = () =>
		Array.from(document.body.querySelectorAll('li')).some((li) => li.textContent === 'Rollback changes');
	const mounted = {
		jotai,
		valueAtom,
		stable,
		hasRollback,
		async unmount() {
			if (!host.isConnected) return;
			await act(async () => root.unmount());
			host.remove();
		}
	};
	mountedRoots.push(mounted);
	return mounted;
}

describe('field changed marker', () => {
	it('shows on edit and goes away on rollback', async () => {
		const m = await mount();
		assert.equal(m.hasRollback(), false);
		await act(async () => m.jotai.set(m.valueAtom, 'edited'));
		assert.equal(m.hasRollback(), true);
		assert.equal(m.stable.changedFieldIds.has('title_s'), true);
		await act(async () => m.jotai.set(m.valueAtom, 'original'));
		assert.equal(m.hasRollback(), false);
		assert.equal(m.stable.changedFieldIds.has('title_s'), false);
		await m.unmount();
	});

	it('follows the Set when it changes without a value write', async () => {
		const m = await mount();
		await act(async () => m.jotai.set(m.valueAtom, 'edited'));
		assert.equal(m.hasRollback(), true);
		await act(async () => {
			m.stable.changedFieldIds.clear();
			notifyChangedFieldIds(m.jotai.set, m.stable.changedFieldIds);
		});
		assert.equal(m.hasRollback(), false);
		await m.unmount();
	});
});
