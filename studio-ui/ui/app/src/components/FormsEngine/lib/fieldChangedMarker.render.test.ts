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
 * The field's changed marker (the "Rollback changes" menu entry) is derived from the form's changed-ids atom.
 * It follows an edit and a rollback made through the field's own atom, and a change to the set that no value write
 * accompanies, such as the checkpoint after a save, and a field does not render for a sibling's edit.
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
const { EMPTY_CHANGED_FIELD_IDS, applyValuesCheckpoint, createChangedFieldIdsAtom, createFieldAtoms } =
	await import('./formUtils.tsx');
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

const fieldOf = (id: string) => ({ id, name: id, type: 'input', validations: {}, helpText: '' }) as ContentTypeField;

/** Fields whose atoms are the real ones, so a write goes through the same dirty tracking as the form's. */
async function mount(fieldIds: string[] = ['title_s'], options: { changedFieldIds?: null } = {}) {
	const jotai = createStore();
	const stable = {
		atoms: { valueByFieldId: {}, validationByFieldId: {}, ...createFormVisibilityAtoms() } as Record<string, unknown>,
		changedFieldIds: 'changedFieldIds' in options ? options.changedFieldIds : createChangedFieldIdsAtom(),
		fieldUpdates$: new Subject<string>(),
		itemMeta: { sourceMap: null, path: '/site/components/thing.xml' },
		originalValues: Object.fromEntries(fieldIds.map((id) => [id, 'original'])),
		props: null,
		state: null,
		affectedPluginControlFields: [],
		formControllerState: null
	};
	const valueAtoms: Record<string, ReturnType<typeof createFieldAtoms>[0]> = {};
	for (const id of fieldIds) {
		const [valueAtom, validationAtom] = createFieldAtoms(fieldOf(id), 'original', { current: stable } as never);
		valueAtoms[id] = valueAtom;
		(stable.atoms.valueByFieldId as Record<string, unknown>)[id] = valueAtom;
		(stable.atoms.validationByFieldId as Record<string, unknown>)[id] = validationAtom;
	}
	// The Profiler reports every commit under a field, so it counts the renders that field was part of.
	const commits: Record<string, number> = Object.fromEntries(fieldIds.map((id) => [id, 0]));
	function Probe({ id }: { id: string }) {
		return React.createElement(
			React.Profiler,
			{ id, onRender: () => void commits[id]++ },
			React.createElement(FormsEngineField, { field: fieldOf(id), isValid: true })
		);
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
										{
											value: {
												rollbackField: (id: string) => jotai.set(valueAtoms[id], 'original')
											} as never
										},
										fieldIds.map((id) => React.createElement(Probe, { key: id, id }))
									)
								)
							)
						)
					)
				)
			)
		);
	});
	const wrapperOf = (id: string) => host.querySelector(`[data-field-id="${id}"]`);
	const mounted = {
		jotai,
		valueAtoms,
		stable,
		commits,
		changed: () => jotai.get(stable.changedFieldIds),
		async openMenu(id: string) {
			await act(async () =>
				wrapperOf(id).querySelector<HTMLElement>('[data-testid="MoreVertRoundedIcon"]').closest('button').click()
			);
		},
		hasRollback: () =>
			Array.from(document.body.querySelectorAll('li')).some((li) => li.textContent === 'Rollback changes'),
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
		await m.openMenu('title_s');
		assert.equal(m.hasRollback(), false);
		await act(async () => m.jotai.set(m.valueAtoms.title_s, 'edited'));
		assert.equal(m.hasRollback(), true);
		assert.equal(m.changed().has('title_s'), true);
		await act(async () => m.jotai.set(m.valueAtoms.title_s, 'original'));
		assert.equal(m.hasRollback(), false);
		assert.equal(m.changed().has('title_s'), false);
	});

	// What Type Builder's commit (EditTypeView) does: set the empty set, with no value write.
	it('goes away when the changed ids are set to empty without a value write', async () => {
		const m = await mount();
		await m.openMenu('title_s');
		await act(async () => m.jotai.set(m.valueAtoms.title_s, 'edited'));
		assert.equal(m.hasRollback(), true);
		await act(async () => m.jotai.set(m.stable.changedFieldIds, EMPTY_CHANGED_FIELD_IDS));
		assert.equal(m.hasRollback(), false);
	});

	it('goes away on the checkpoint a save makes', async () => {
		const m = await mount();
		await m.openMenu('title_s');
		await act(async () => m.jotai.set(m.valueAtoms.title_s, 'edited'));
		assert.equal(m.hasRollback(), true);
		await act(async () => applyValuesCheckpoint(m.stable, { title_s: 'edited' }, m.jotai.set));
		assert.equal(m.hasRollback(), false);
	});

	it('does not render a field again for a write that leaves the changed ids alone', async () => {
		const m = await mount(['title_s', 'other_s']);
		await act(async () => m.jotai.set(m.valueAtoms.other_s, 'edited'));
		const ids = m.changed();
		const before = { ...m.commits };
		await act(async () => m.jotai.set(m.valueAtoms.other_s, 'edited again'));
		assert.equal(m.changed(), ids);
		assert.equal(m.commits.title_s, before.title_s);
	});

	it('does not re-render a field when a sibling field changes', async () => {
		const m = await mount(['title_s', 'other_s']);
		const before = m.commits.title_s;
		await act(async () => m.jotai.set(m.valueAtoms.other_s, 'edited'));
		assert.equal(m.changed().has('other_s'), true);
		assert.equal(m.commits.title_s, before);
		await act(async () => m.jotai.set(m.valueAtoms.title_s, 'edited'));
		assert.ok(m.commits.title_s > before);
		await m.openMenu('title_s');
		assert.equal(m.hasRollback(), true);
	});

	it('renders when the form has no changed-field Set', async () => {
		const m = await mount(['title_s'], { changedFieldIds: null });
		await m.openMenu('title_s');
		assert.equal(m.hasRollback(), false);
	});
});
