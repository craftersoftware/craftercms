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
 * Shared harness for the render tests that cover how the form reads its content item. It mounts the real provisioning
 * hooks (`useFormEntryProvisioning`, `useFormItemGate`) and the real item context, over a Redux store whose items a
 * test can replace. Import it after `test/stringListDomSetup.mjs` and `test/registerTsLoader.mjs`.
 */

import type { ComponentType } from 'react';
import type { AnyValue, ControlProps } from '../types';
import type { ContentTypeField } from '../../../models/ContentType';

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { RawIntlProvider } = await import('react-intl');
const { createTestIntl } = await import('../../../../test/createTestIntl.mjs');
const { Provider } = await import('react-redux');
const { configureStore } = await import('@reduxjs/toolkit');
const { atom } = await import('jotai');
const { ResolvedControlRenderer } = await import('./renderControl');
const { FormItemKeyContext, FormsEngineFormContextApi, ItemMetaContext, StableFormContext, StableGlobalContext } =
	await import('./formsEngineContext');
const { useFormEntryProvisioning, useFormItemGate } = await import('./useFormEntryWiring');
const { createFormVisibilityAtoms } = await import('./formVisibility');
const { createFormStackData } = await import('./formUtils');

export { React, act, ResolvedControlRenderer };

export type TestItem = {
	path: string;
	label: string;
	lockOwner?: { username: string };
	[key: string]: unknown;
};
export type ItemsByPath = Record<string, TestItem>;

export const formPath = '/site/website/about/index.xml';
export const sourcePath = '/site/website/source/index.xml';
export const unrelatedPath = '/site/website/unrelated/index.xml';
export const siteId = 'editorial';

export function baseItems(): ItemsByPath {
	return {
		[formPath]: { path: formPath, label: 'About' },
		[sourcePath]: { path: sourcePath, label: 'Source' },
		[unrelatedPath]: { path: unrelatedPath, label: 'Unrelated' }
	};
}

export function createItemsStore(initial: ItemsByPath) {
	return configureStore({
		reducer: {
			sites: (state = { active: siteId }) => state,
			uiConfig: (state = { locale: { localeCode: 'en-US' } }) => state,
			env: (state = { authoringBase: '/studio' }) => state,
			user: (state = { username: 'ann' }) => state,
			content: (
				state: { itemsByPath: ItemsByPath; itemsBeingFetchedByPath: Record<string, boolean> } = {
					itemsByPath: initial,
					itemsBeingFetchedByPath: {}
				},
				action: { type: string; payload?: { items: ItemsByPath } }
			) => (action.type === 'test/updateItems' ? { ...state, itemsByPath: action.payload.items } : state),
			contentTypes: (state = { byId: {}, isFetching: false }) => state
		},
		middleware: (getDefault) => getDefault({ serializableCheck: false, immutableCheck: false })
	});
}
export type ItemsStore = ReturnType<typeof createItemsStore>;

/** Replaces the stored items, as a refetch, socket event or lock change would. Settles React before returning. */
export function updateItems(store: ItemsStore, change: (items: ItemsByPath) => ItemsByPath) {
	return act(async () => {
		dispatchItems(store, change);
	});
}

/** Same, without wrapping in `act`: nothing has rendered when it returns. */
export function dispatchItems(store: ItemsStore, change: (items: ItemsByPath) => ItemsByPath) {
	store.dispatch({
		type: 'test/updateItems',
		payload: { items: change(store.getState().content.itemsByPath as ItemsByPath) }
	});
}

const intl = createTestIntl();

const mounted: Array<() => void> = [];

/** Mounts a tree with the store and intl providers. Roots are unmounted by `unmountAll`, call it in `afterEach`. */
export async function mount(store: ItemsStore, tree: React.ReactElement) {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	mounted.push(() => {
		act(() => root.unmount());
		host.remove();
	});
	const render = async (next: React.ReactElement) => {
		await act(async () => {
			root.render(
				React.createElement(Provider as never, { store }, React.createElement(RawIntlProvider, { value: intl }, next))
			);
		});
		await settle();
	};
	await render(tree);
	return { host, rerender: render };
}

export async function mountTree(store: ItemsStore, tree: React.ReactElement): Promise<HTMLElement> {
	return (await mount(store, tree)).host;
}

export function unmountAll() {
	pushFormCalls.length = 0;
	mounted.splice(0).forEach((unmount) => unmount());
}

/** Data sources resolve asynchronously and set state after the first commit. */
export function settle() {
	return act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 50));
	});
}

export function profiled(counts: Record<string, number>, id: string, child: React.ReactElement) {
	return React.createElement(
		React.Profiler,
		{
			key: id,
			id,
			onRender: () => {
				counts[id] = (counts[id] ?? 0) + 1;
			}
		},
		child
	);
}

export const probeSeen: ControlProps<string>[] = [];
export function Probe(props: ControlProps<string>) {
	probeSeen.push(props);
	return React.createElement('input', { id: props.inputId, 'data-probe': props.field.id });
}

export function fieldFor(id: string, type = 'input'): ContentTypeField {
	return { id, name: `Label of ${id}`, type, validations: {}, helpText: '' } as ContentTypeField;
}

export const itemBindings = [{ propertyName: 'datasource', interfaces: ['item'], selection: 'single' }] as never;

/** The form's stable entry, created the way `FormsEngine` creates one, with atoms the fields and header read. */
export function createEntry(fieldIds: string[]) {
	const valueAtom = atom('x');
	const validationAtom = atom({ isValid: true });
	return createFormStackData({
		atoms: {
			valueByFieldId: Object.fromEntries(fieldIds.map((id) => [id, valueAtom])),
			validationByFieldId: Object.fromEntries(fieldIds.map((id) => [id, validationAtom])),
			readonly: atom(false),
			isLargeContainer: atom(false),
			...createFormVisibilityAtoms()
		} as never,
		itemMeta: { id: 'item-id', path: formPath, pathInSite: formPath, sourceMap: null } as never,
		fieldUpdates$: null
	});
}

export type Entry = ReturnType<typeof createEntry>;

/** What the controls passed to `api.pushForm`, cleared by `unmountAll`. */
export const pushFormCalls: Array<Record<string, unknown>> = [];
const stableGlobal = {
	formsStackData: [],
	api: {
		pushForm(props: Record<string, unknown>) {
			pushFormCalls.push(props);
		}
	}
};
const formApi = { rollbackField() {} } as never;

/**
 * Stands in for the `FormsEngine` wrapper: the same item gate and provisioning hooks, the same providers, and it
 * subscribes to nothing else about the item. The children element is created once, so only context and store
 * subscriptions inside it can re-render them.
 */
export function FormHost(props: {
	entry: Entry;
	itemKey?: string | null;
	sourceMap?: Record<string, string>;
	counts?: Record<string, number>;
	children: React.ReactNode;
}) {
	const { entry, itemKey = formPath, sourceMap = null, counts } = props;
	const entryRef = React.useRef(entry);
	const [ready, setReady] = React.useState(true);
	if (counts) {
		counts.host = (counts.host ?? 0) + 1;
		if (!ready) counts.notReady = (counts.notReady ?? 0) + 1;
	}
	const hasLiveItem = useFormItemGate({ itemKey, create: false, repeat: false, setReady });
	// The prep effect makes the form ready again once the item it needs is stored.
	React.useEffect(() => {
		if (hasLiveItem) setReady(true);
	}, [hasLiveItem]);
	useFormEntryProvisioning(entryRef, { itemKey, siteId, formsApi: stableGlobal.api });
	const itemMeta = React.useMemo(() => ({ ...entry.itemMeta, sourceMap }), [entry, sourceMap]);
	if (!ready || !hasLiveItem) return React.createElement('p', { 'data-testid': 'not-ready' }, 'Please wait');
	return React.createElement(
		StableGlobalContext.Provider,
		{ value: stableGlobal as never },
		React.createElement(
			StableFormContext.Provider,
			{ value: entry as never },
			React.createElement(
				FormItemKeyContext.Provider,
				{ value: itemKey },
				React.createElement(
					ItemMetaContext.Provider,
					{ value: itemMeta as never },
					React.createElement(FormsEngineFormContextApi.Provider, { value: formApi }, props.children)
				)
			)
		)
	);
}

/** One `ResolvedControlRenderer` per field, wrapped in the default field chrome, the way a plugin control renders. */
export function renderField(field: ContentTypeField) {
	return React.createElement(ResolvedControlRenderer, {
		key: field.id,
		field,
		autoFocus: false,
		readonly: false,
		contentType: { id: '/component/thing', fields: {} } as never,
		value: 'x',
		setValue: () => undefined,
		Control: Probe as ComponentType<AnyValue>,
		bindings: itemBindings,
		fieldChrome: true
	});
}
