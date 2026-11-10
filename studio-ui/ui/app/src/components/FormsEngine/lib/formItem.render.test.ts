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
 * How the form reads its content item: granular subscriptions at the leaves that render it, `getItem()` for callbacks,
 * and a wrapper that only watches whether the item exists. The wiring under test is the real one
 * (`useFormEntryProvisioning`, `useFormItemGate`, `FormItemKeyContext`); the orchestrator is a stand-in that reads the
 * item the way `FormOrchestrator` does (its path), because the real one needs the whole form to mount.
 */

import '../../../../test/stringListDomSetup.mjs';
import '../../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { ContentItem } from '../../../models';

const {
	React,
	act,
	mount,
	FormHost,
	baseItems,
	createEntry,
	createItemsStore,
	dispatchItems,
	fieldFor,
	formPath,
	mountTree,
	probeSeen,
	profiled,
	renderField,
	siteId,
	unmountAll,
	unrelatedPath,
	updateItems
} = await import('./formItemTestHarness');
const { FormItemKeyContext } = await import('./formsEngineContext');
const { useFormItem, useFormItemLabel, useFormItemPath, useFormItemSelector } = await import('./formItem');
const { useFormEntryProvisioning } = await import('./useFormEntryWiring');
const { useAffectedPackagesRefetch } = await import('./useAffectedPackagesRefetch');
const { EditModeHeader, EditModeMetadata } = await import('../components/EditModeHeader');
const { getHostToHostBus } = await import('../../../utils/subjects');
const { workflowEventSubmit } = await import('../../../state/actions/system');

afterEach(() => {
	unmountAll();
	probeSeen.length = 0;
});

const metadata = {
	systemType: 'page',
	mimeType: 'application/xml',
	stateMap: {},
	creator: { firstName: 'Ann', lastName: 'Author', username: 'ann' },
	modifier: { firstName: 'Max', lastName: 'Editor', username: 'max' },
	dateCreated: '2026-01-01T00:00:00Z',
	dateModified: '2026-02-01T00:00:00Z'
};

const lock = (username?: string) => (items: ReturnType<typeof baseItems>) => ({
	...items,
	[formPath]: { ...items[formPath], lockOwner: username ? { username } : undefined }
});

const stateOf = (host: HTMLElement) => host.querySelector('[data-testid="state"]').textContent;

/** A leaf that, like the form orchestrator, only needs the item's path. */
function OrchestratorStandIn({ counts, children }: { counts: Record<string, number>; children?: React.ReactNode }) {
	counts.orchestrator = (counts.orchestrator ?? 0) + 1;
	const path = useFormItemPath();
	return React.createElement('div', { 'data-testid': 'path' }, path, children);
}

describe('form item subscriptions', () => {
	it('a lock-owner change re-renders the header but not the orchestrator or the fields', async () => {
		const store = createItemsStore({ ...baseItems(), [formPath]: { ...baseItems()[formPath], ...metadata } });
		const fieldIds = Array.from({ length: 6 }, (_, index) => `f${index}_s`);
		const entry = createEntry(fieldIds);
		const counts: Record<string, number> = {};
		const host = await mountTree(
			store,
			React.createElement(
				FormHost,
				{ entry },
				profiled(counts, 'header', React.createElement(EditModeHeader, { isEmbedded: false })),
				profiled(
					counts,
					'metadata',
					React.createElement(
						'section',
						{ 'data-testid': 'metadata' },
						React.createElement(StateProbe),
						React.createElement(EditModeMetadata)
					)
				),
				React.createElement(
					OrchestratorStandIn,
					{ counts },
					fieldIds.map((id) => profiled(counts, id, renderField(fieldFor(id))))
				)
			)
		);
		const before = { ...counts };
		assert.equal(stateOf(host), 'unlocked');

		await updateItems(store, lock('admin'));

		assert.equal(stateOf(host), 'locked by admin');
		assert.match(host.querySelector('[data-testid="metadata"]').textContent, /admin/);
		assert.ok(counts.header > before.header, 'the header follows the item');
		assert.ok(counts.metadata > before.metadata, 'the metadata follows the item');
		assert.equal(counts.orchestrator, before.orchestrator, 'the orchestrator does not');
		for (const id of fieldIds) assert.equal(counts[id], before[id], `${id} does not re-render`);

		await updateItems(store, lock());
		assert.equal(stateOf(host), 'unlocked');
		assert.equal(counts.orchestrator, before.orchestrator);
	});

	it('does not re-render the host, the orchestrator or the leaves on an unrelated item update', async () => {
		const store = createItemsStore(baseItems());
		const entry = createEntry(['a_s']);
		const counts: Record<string, number> = {};
		await mountTree(
			store,
			React.createElement(
				FormHost,
				{ entry, counts },
				React.createElement(OrchestratorStandIn, { counts }, profiled(counts, 'leaf', React.createElement(LabelLeaf)))
			)
		);
		const before = { ...counts };
		await updateItems(store, (items) => ({ ...items, [unrelatedPath]: { ...items[unrelatedPath], label: 'Changed' } }));
		assert.deepEqual(counts, before);
	});

	it('re-renders the path and label consumers when the item is renamed or moved', async () => {
		const store = createItemsStore(baseItems());
		const entry = createEntry(['a_s']);
		const counts: Record<string, number> = {};
		const host = await mountTree(
			store,
			React.createElement(
				FormHost,
				{ entry },
				React.createElement(OrchestratorStandIn, { counts }, React.createElement(LabelLeaf))
			)
		);
		const before = counts.orchestrator;
		assert.equal(host.querySelector('[data-testid="path"]').firstChild.textContent, formPath);
		const moved = '/site/website/company/index.xml';
		await updateItems(store, (items) => ({ ...items, [formPath]: { ...items[formPath], path: moved } }));
		assert.equal(host.querySelector('[data-testid="path"]').firstChild.textContent, moved);
		assert.equal(counts.orchestrator, before + 1, 'exactly one render for the path change');
		await updateItems(store, (items) => ({ ...items, [formPath]: { ...items[formPath], label: 'Company' } }));
		assert.equal(host.querySelector('[data-testid="label"]').textContent, 'Company');
		assert.equal(counts.orchestrator, before + 1, 'a label change is not the orchestrator’s business');
	});

	describe('hooks', () => {
		it('return null without an item: create mode, or nothing stored under the key', async () => {
			const store = createItemsStore(baseItems());
			const seen: unknown[] = [];
			function Reader() {
				seen.push([useFormItem(), useFormItemPath(), useFormItemLabel()]);
				return null;
			}
			const mount = (key: string | null) =>
				mountTree(store, React.createElement(FormItemKeyContext.Provider, { value: key }, React.createElement(Reader)));
			await mount(null);
			await mount('/site/website/missing/index.xml');
			assert.deepEqual(seen, [
				[null, null, null],
				[null, null, null]
			]);
		});

		it('use the item stored under the key', async () => {
			const store = createItemsStore(baseItems());
			const seen: unknown[] = [];
			function Reader() {
				seen.push([useFormItem()?.path, useFormItemPath(), useFormItemLabel()]);
				return null;
			}
			await mountTree(
				store,
				React.createElement(FormItemKeyContext.Provider, { value: formPath }, React.createElement(Reader))
			);
			assert.deepEqual(seen.at(-1), [formPath, formPath, 'About']);
		});

		it('useFormItemSelector honours the equality function', async () => {
			const store = createItemsStore(baseItems());
			let renders = 0;
			const seen: string[] = [];
			function Reader() {
				renders++;
				const owner = useFormItemSelector(
					(item) => ({ name: item?.lockOwner?.username ?? 'none' }),
					(left, right) => left.name === right.name
				);
				seen.push(owner.name);
				return null;
			}
			await mountTree(
				store,
				React.createElement(FormItemKeyContext.Provider, { value: formPath }, React.createElement(Reader))
			);
			const before = renders;
			await updateItems(store, (items) => ({ ...items, [formPath]: { ...items[formPath], label: 'Other' } }));
			assert.equal(renders, before, 'a change the selector ignores does not render');
			await updateItems(store, lock('admin'));
			assert.equal(renders, before + 1);
			assert.equal(seen.at(-1), 'admin');
		});
	});

	describe('getItem and data-source services', () => {
		it('getItem is fresh right after a dispatch, before anything renders, and keeps its identity', async () => {
			const store = createItemsStore(baseItems());
			const entry = createEntry(['a_s']);
			assert.equal(entry.getItem(), null, 'null until the form publishes the reader');
			const counts: Record<string, number> = {};
			await mountTree(
				store,
				React.createElement(FormHost, { entry, counts }, React.createElement(OrchestratorStandIn, { counts }))
			);
			const getItem = entry.getItem;
			assert.equal(getItem().label, 'About');

			dispatchItems(store, lock('admin'));
			assert.equal((getItem() as ContentItem).lockOwner.username, 'admin', 'no render in between');
			await updateItems(store, (items) => ({ ...items, [unrelatedPath]: { ...items[unrelatedPath], label: 'x' } }));
			assert.equal(entry.getItem, getItem, 'identity is stable across item updates');
			assert.equal(counts.host, 1, 'the wrapper does not render for item content updates');
		});

		it('getItem follows the form to another key', async () => {
			const store = createItemsStore(baseItems());
			const entry = createEntry(['a_s']);
			const other = '/site/website/other/index.xml';
			await updateItems(store, (items) => ({ ...items, [other]: { path: other, label: 'Other' } }));
			const tree = (itemKey: string) =>
				React.createElement(FormHost, { entry, itemKey }, React.createElement(OrchestratorStandIn, { counts: {} }));
			const { rerender } = await mount(store, tree(formPath));
			const getItem = entry.getItem;
			assert.equal(getItem().path, formPath);
			await rerender(tree(other));
			assert.equal(getItem().path, other);
			assert.equal(entry.getItem, getItem, 'the reader is the same function');
		});

		it('publishes services once per form, and builds new ones only when the site changes', async () => {
			const store = createItemsStore(baseItems());
			const entry = createEntry([]);
			const entryRef = { current: entry };
			const formsApi = { pushForm() {} };
			function Provisioner({ site }: { site: string }) {
				useFormEntryProvisioning(entryRef, { itemKey: formPath, siteId: site, formsApi });
				return null;
			}
			const { rerender } = await mount(store, React.createElement(Provisioner, { site: siteId }));
			const services = entry.dataSourceServices;
			assert.ok(services);
			await updateItems(store, lock('admin'));
			await rerender(React.createElement(Provisioner, { site: siteId }));
			assert.equal(entry.dataSourceServices, services, 'item updates and re-renders leave them alone');
			await rerender(React.createElement(Provisioner, { site: 'other' }));
			assert.notEqual(entry.dataSourceServices, services, 'another site gets its own');
		});
	});

	describe('ready gate', () => {
		it('takes the form out of ready when a rename lands before the new path’s item is stored, and back once it is', async () => {
			const store = createItemsStore(baseItems());
			const entry = createEntry(['a_s']);
			const renamed = '/site/website/about-us/index.xml';
			const counts: Record<string, number> = {};
			const tree = (itemKey: string) =>
				React.createElement(FormHost, { entry, itemKey, counts }, React.createElement('i', { 'data-testid': 'form' }));
			const { host, rerender } = await mount(store, tree(formPath));
			assert.ok(host.querySelector('[data-testid="form"]'));
			assert.equal(counts.notReady ?? 0, 0);

			await rerender(tree(renamed));
			assert.ok(!host.querySelector('[data-testid="form"]'), 'no item yet: not ready');
			assert.ok(host.querySelector('[data-testid="not-ready"]'));
			assert.ok(counts.notReady > 0, 'the gate took the form out of ready so it prepares again');

			await updateItems(store, (items) => ({ ...items, [renamed]: { path: renamed, label: 'About us' } }));
			assert.ok(host.querySelector('[data-testid="form"]'), 'ready again once the item is stored');
			assert.equal(entry.getItem().path, renamed);
		});

		it('does not render the form for a key with no stored item', async () => {
			const store = createItemsStore(baseItems());
			const entry = createEntry(['a_s']);
			let childRenders = 0;
			function Child() {
				childRenders++;
				return null;
			}
			await mountTree(
				store,
				React.createElement(FormHost, { entry, itemKey: '/site/website/none/index.xml' }, React.createElement(Child))
			);
			assert.equal(childRenders, 0);
		});
	});

	describe('workflow refetch', () => {
		function Refetch(props: {
			path: string | null;
			site?: string;
			fetched: Array<[string, string]>;
			received: unknown[][];
		}) {
			useAffectedPackagesRefetch(
				props.site ?? siteId,
				props.path,
				(packages) => props.received.push(packages),
				(site, path) => {
					props.fetched.push([site, path]);
					return { subscribe: (observer: { next(value: unknown[]): void }) => observer.next([{ id: path }]) } as never;
				}
			);
			return null;
		}

		it('subscribes once, so an item update does not resubscribe, and fetches the current path', async () => {
			const store = createItemsStore(baseItems());
			const bus = getHostToHostBus();
			const fetched: Array<[string, string]> = [];
			const received: unknown[][] = [];
			const originalSubscribe = bus.subscribe.bind(bus);
			let subscriptions = 0;
			bus.subscribe = ((...args: unknown[]) => {
				subscriptions++;
				return (originalSubscribe as (...a: unknown[]) => unknown)(...args);
			}) as never;
			try {
				function Form() {
					const path = useFormItemPath();
					return React.createElement(Refetch, { path, fetched, received });
				}
				await mountTree(
					store,
					React.createElement(FormItemKeyContext.Provider, { value: formPath }, React.createElement(Form))
				);
				assert.equal(subscriptions, 1);
				await updateItems(store, lock('admin'));
				await updateItems(store, (items) => ({
					...items,
					[formPath]: { ...items[formPath], path: '/site/website/moved/index.xml' }
				}));
				assert.equal(subscriptions, 1, 'neither a lock change nor a rename resubscribes');
				await act(async () => bus.next(workflowEventSubmit()));
				assert.deepEqual(fetched, [[siteId, '/site/website/moved/index.xml']]);
				assert.deepEqual(received, [[{ id: '/site/website/moved/index.xml' }]]);
				await act(async () => bus.next({ type: 'unrelated' }));
				assert.equal(fetched.length, 1);
			} finally {
				bus.subscribe = originalSubscribe as never;
			}
		});

		it('does nothing without an item path', async () => {
			const store = createItemsStore(baseItems());
			const fetched: Array<[string, string]> = [];
			await mountTree(store, React.createElement(Refetch, { path: null, fetched, received: [] }));
			await act(async () => getHostToHostBus().next(workflowEventSubmit()));
			assert.deepEqual(fetched, []);
		});
	});
});

/** The item's lock, as the header's state text would show it, in a form a test can read. */
function StateProbe() {
	const item = useFormItem();
	return React.createElement(
		'span',
		{ 'data-testid': 'state' },
		item?.lockOwner ? `locked by ${item.lockOwner.username}` : 'unlocked'
	);
}

function LabelLeaf() {
	const label = useFormItemLabel();
	return React.createElement('b', { 'data-testid': 'label' }, label);
}
