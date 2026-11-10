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
 * Fields subscribe to what they read. An item update (lock, workflow refetch, socket event) that doesn't change a
 * field's own inputs must not re-render the field or churn its data-source context identity, the source-item label
 * in the field chrome still follows that one item, and `expandPath` still reads the current item path. The form wiring
 * is the real one (`useFormEntryProvisioning`, `useFormItemGate`), not a hand-built stable entry.
 */

import '../../../../test/stringListDomSetup.mjs';
import '../../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const {
	React,
	FormHost,
	baseItems,
	createEntry,
	createItemsStore,
	fieldFor,
	formPath,
	mountTree,
	probeSeen,
	profiled,
	renderField,
	sourcePath,
	unmountAll,
	unrelatedPath,
	updateItems
} = await import('./formItemTestHarness.ts');
const { FormsEngineField } = await import('../components/FormsEngineField.tsx');

afterEach(() => {
	unmountAll();
	probeSeen.length = 0;
});

const lastSeen = (fieldId: string) => probeSeen.findLast((props) => props.field.id === fieldId);

const touchUnrelated = (items: ReturnType<typeof baseItems>) => ({
	...items,
	[unrelatedPath]: { ...items[unrelatedPath], label: 'Changed' }
});

describe('field subscriptions', () => {
	it('keeps every field’s data-source context identity across unrelated item updates and lock changes', async () => {
		const store = createItemsStore(baseItems());
		const fieldIds = ['a_s', 'b_s', 'c_s', 'd_s'];
		const entry = createEntry(fieldIds);
		await mountTree(
			store,
			React.createElement(
				FormHost,
				{ entry },
				fieldIds.map((id) => renderField(fieldFor(id)))
			)
		);
		const before = new Map(fieldIds.map((id) => [id, lastSeen(id)]));
		assert.ok(fieldIds.every((id) => before.get(id)?.dataSources?.context?.expandPath));

		await updateItems(store, touchUnrelated);
		await updateItems(store, (items) => ({
			...items,
			[formPath]: { ...items[formPath], lockOwner: { username: 'admin' } }
		}));
		await updateItems(store, (items) => ({ ...items, [formPath]: { ...items[formPath], lockOwner: undefined } }));

		for (const id of fieldIds) {
			const last = lastSeen(id);
			assert.equal(
				last.dataSources.context.expandPath,
				before.get(id).dataSources.context.expandPath,
				`${id} expandPath`
			);
			assert.equal(last.dataSources, before.get(id).dataSources, `${id} dataSources`);
		}
	});

	it('does not re-render fields on an unrelated item update or a lock change', async () => {
		const store = createItemsStore(baseItems());
		const fieldIds = ['a_s', 'b_s', 'c_s', 'd_s'];
		const entry = createEntry(fieldIds);
		const counts: Record<string, number> = {};
		await mountTree(
			store,
			React.createElement(
				FormHost,
				{ entry },
				fieldIds.map((id) => profiled(counts, id, renderField(fieldFor(id))))
			)
		);
		const rendersBefore = { ...counts };
		assert.ok(fieldIds.every((id) => rendersBefore[id] > 0));

		await updateItems(store, touchUnrelated);
		await updateItems(store, (items) => ({
			...items,
			[formPath]: { ...items[formPath], lockOwner: { username: 'admin' } }
		}));

		assert.deepEqual(counts, rendersBefore);
	});

	it('shows the source item label in the field chrome and follows only that item', async () => {
		const store = createItemsStore(baseItems());
		const entry = createEntry(['a_s', 'b_s']);
		const counts: Record<string, number> = {};
		const host = await mountTree(
			store,
			React.createElement(
				FormHost,
				{ entry, sourceMap: { a_s: sourcePath } },
				profiled(counts, 'inherited', React.createElement(FormsEngineField, { field: fieldFor('a_s'), menu: false })),
				profiled(counts, 'plain', React.createElement(FormsEngineField, { field: fieldFor('b_s'), menu: false }))
			)
		);
		const inherited = () => host.querySelector('[data-field-id="a_s"]').textContent;
		assert.match(inherited(), /Inherited value from Source is overridden/);

		const rendersBefore = { ...counts };
		await updateItems(store, touchUnrelated);
		assert.deepEqual(counts, rendersBefore, 'An unrelated item update does not re-render the fields');

		await updateItems(store, (items) => ({
			...items,
			[sourcePath]: { ...items[sourcePath], label: 'Renamed source' }
		}));
		assert.match(inherited(), /Inherited value from Renamed source is overridden/);
		assert.equal(counts.inherited, rendersBefore.inherited + 1);
		assert.equal(counts.plain, rendersBefore.plain, 'Fields without a source item are left alone');
	});

	it('falls back to the source path while the source item is not in the store', async () => {
		const store = createItemsStore({ [formPath]: { path: formPath, label: 'About' } });
		const entry = createEntry(['a_s']);
		const host = await mountTree(
			store,
			React.createElement(
				FormHost,
				{ entry, sourceMap: { a_s: sourcePath } },
				React.createElement(FormsEngineField, { field: fieldFor('a_s'), menu: false })
			)
		);
		assert.match(
			host.querySelector('[data-field-id="a_s"]').textContent,
			new RegExp(`from ${sourcePath} is overridden`)
		);
	});

	it('expands path macros with the current item path after the item is renamed or moved', async () => {
		const store = createItemsStore(baseItems());
		const entry = createEntry(['a_s']);
		await mountTree(store, React.createElement(FormHost, { entry }, renderField(fieldFor('a_s'))));
		const expandPath = lastSeen('a_s').dataSources.context.expandPath;
		assert.equal(expandPath('{parentPath}'), 'about');

		await updateItems(store, (items) => ({
			...items,
			[formPath]: { ...items[formPath], path: '/site/website/company/team/index.xml' }
		}));
		assert.equal(expandPath('{parentPath}'), 'company/team');
		assert.equal(lastSeen('a_s').dataSources.context.expandPath, expandPath, 'expandPath keeps its identity');
	});

	it('shares the data-source services the form created across its fields', async () => {
		const store = createItemsStore(baseItems());
		const fieldIds = ['a_s', 'b_s', 'c_s'];
		const entry = createEntry(fieldIds);
		await mountTree(
			store,
			React.createElement(
				FormHost,
				{ entry },
				fieldIds.map((id) => renderField(fieldFor(id)))
			)
		);
		const services = entry.dataSourceServices;
		assert.ok(services, 'the form published its services on the stable entry');
		for (const id of fieldIds) assert.equal(lastSeen(id).dataSources.context.services, services, id);

		await updateItems(store, touchUnrelated);
		assert.equal(entry.dataSourceServices, services, 'an item update does not rebuild them');
		for (const id of fieldIds) assert.equal(lastSeen(id).dataSources.context.services, services, id);
	});
});
