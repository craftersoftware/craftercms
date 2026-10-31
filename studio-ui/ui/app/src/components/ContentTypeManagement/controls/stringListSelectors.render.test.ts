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

import '../../../../test/stringListDomSetup.mjs';
import '../../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const React = await import('react');
const { createRoot } = await import('react-dom/client');
const { act } = await import('react');
const { IntlProvider } = await import('react-intl');
const { Provider } = await import('react-redux');
const { configureStore } = await import('@reduxjs/toolkit');
const { atom } = await import('jotai');
const { TypeAllowedRolesSelector } = await import('./TypeAllowedRolesSelector.tsx');
const { TypeDestinationPathsSelector } = await import('./TypeDestinationPathsSelector.tsx');
const { FormsEngineFormContextApi, ItemMetaContext, StableFormContext, StableGlobalContext } =
	await import('../../FormsEngine/lib/formsEngineContext.ts');
const { createFormVisibilityAtoms } = await import('../../FormsEngine/lib/formVisibility.ts');

const store = configureStore({
	reducer: {
		content: (state = { itemsByPath: {} }) => state
	}
});

const valueAtom = atom([]);
const validationAtom = atom({ isValid: true });

function field(id: string, name: string, type: string) {
	return { id, name, type, defaultValue: [], validations: {}, helpText: '' };
}

function Harness(props: { children: React.ReactNode }) {
	const stable = {
		atoms: {
			valueByFieldId: { allowedRoles: valueAtom, paths: valueAtom },
			validationByFieldId: { allowedRoles: validationAtom, paths: validationAtom },
			...createFormVisibilityAtoms()
		},
		changedFieldIds: new Set<string>(),
		fieldUpdates$: null,
		itemMeta: { sourceMap: null },
		originalValues: {},
		props: null,
		state: null,
		affectedPluginControlFields: [],
		formControllerState: null
	};
	return React.createElement(
		Provider,
		{ store },
		React.createElement(
			IntlProvider,
			{ locale: 'en', messages: {} },
			React.createElement(
				StableGlobalContext.Provider,
				{ value: { formsStackData: [], api: {} } },
				React.createElement(
					StableFormContext.Provider,
					{ value: stable },
					React.createElement(
						ItemMetaContext.Provider,
						{ value: { sourceMap: null } },
						React.createElement(FormsEngineFormContextApi.Provider, { value: { rollbackField() {} } }, props.children)
					)
				)
			)
		)
	);
}

async function render(node: React.ReactElement): Promise<HTMLElement> {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	await act(async () => {
		root.render(React.createElement(Harness, null, node));
	});
	return host;
}

describe('string list selectors render', () => {
	it('renders Allowed Roles without a missing message id', async () => {
		const host = await render(
			React.createElement(TypeAllowedRolesSelector, {
				field: field('allowedRoles', 'Allowed Roles', 'type-allowed-roles-selector'),
				value: ['author'],
				setValue() {}
			})
		);
		assert.match(host.textContent ?? '', /Role 1/);
		assert.equal(host.querySelector('button[aria-label="Remove Role 1"]') != null, true);
		assert.equal(host.querySelector('button[aria-label="Add Role"]') != null, true);
	});

	it('renders Allowed Destinations without a missing message id', async () => {
		const host = await render(
			React.createElement(TypeDestinationPathsSelector, {
				field: field('paths', 'Paths', 'type-destination-paths-selector'),
				value: { includes: { pattern: ['/site/.*'] }, excludes: { pattern: [] } },
				setValue() {}
			})
		);
		assert.match(host.textContent ?? '', /Includes pattern 1/);
		assert.equal(host.querySelector('button[aria-label="Remove include pattern 1"]') != null, true);
		assert.equal(host.querySelector('button[aria-label="Add include path"]') != null, true);
		assert.equal(host.querySelector('button[aria-label="Add exclude path"]') != null, true);
	});

	it('removes a role and focuses the row that takes its place', async () => {
		let latest: string[] = [];
		function Roles() {
			const [value, setValue] = React.useState(['author', 'editor', 'admin']);
			latest = value;
			return React.createElement(TypeAllowedRolesSelector, {
				field: field('allowedRoles', 'Allowed Roles', 'type-allowed-roles-selector'),
				value,
				setValue
			});
		}

		const host = await render(React.createElement(Roles));
		const remove = host.querySelector('button[aria-label="Remove Role 2"]');
		assert.ok(remove instanceof HTMLButtonElement);
		await act(async () => {
			remove.click();
		});

		assert.deepEqual(latest, ['author', 'admin']);
		const inputs = [...host.querySelectorAll('input')].map((input) => (input as HTMLInputElement).value);
		assert.deepEqual(inputs, ['author', 'admin']);
		const focused = document.activeElement;
		assert.ok(focused instanceof HTMLInputElement);
		assert.equal(focused.getAttribute('aria-label'), 'Role 2');
		assert.equal(focused.value, 'admin');
	});

	it('keeps earlier rows when the parent replaces the list', async () => {
		let setRoles: (next: string[]) => void = () => {};
		function Roles() {
			const [value, setValue] = React.useState(['author', 'editor']);
			setRoles = setValue;
			return React.createElement(TypeAllowedRolesSelector, {
				field: field('allowedRoles', 'Allowed Roles', 'type-allowed-roles-selector'),
				value,
				setValue
			});
		}

		const host = await render(React.createElement(Roles));
		const initial = [...host.querySelectorAll('input')];
		assert.deepEqual(
			initial.map((input) => input.value),
			['author', 'editor']
		);

		await act(async () => {
			setRoles(['author', 'publisher']);
		});
		const replaced = [...host.querySelectorAll('input')];
		assert.deepEqual(
			replaced.map((input) => input.value),
			['author', 'publisher']
		);
		assert.equal(replaced[0], initial[0]);
		assert.equal(replaced[1], initial[1]);

		await act(async () => {
			setRoles(['author', 'publisher', 'admin']);
		});
		const grown = [...host.querySelectorAll('input')];
		assert.deepEqual(
			grown.map((input) => input.value),
			['author', 'publisher', 'admin']
		);
		assert.equal(grown[0], initial[0]);
		assert.equal(grown[1], initial[1]);

		await act(async () => {
			setRoles(['author']);
		});
		const shrunk = [...host.querySelectorAll('input')];
		assert.deepEqual(
			shrunk.map((input) => input.value),
			['author']
		);
		assert.equal(shrunk[0], initial[0]);
	});

	it('appends an empty role and focuses it from an empty list and a populated list', async () => {
		let latest: string[] = [];
		function Roles() {
			const [value, setValue] = React.useState<string[]>([]);
			latest = value;
			return React.createElement(TypeAllowedRolesSelector, {
				field: field('allowedRoles', 'Allowed Roles', 'type-allowed-roles-selector'),
				value,
				setValue
			});
		}

		const host = await render(React.createElement(Roles));
		await clickAdd(host, 'Add Role');
		assert.deepEqual(latest, ['']);
		assertFocusedRow('Role 1', '');

		await clickAdd(host, 'Add Role');
		assert.deepEqual(latest, ['', '']);
		assertFocusedRow('Role 2', '');
	});

	it('appends an empty include path and focuses it from an empty list and a populated list', async () => {
		const latest = { includes: { pattern: [] as string[] }, excludes: { pattern: [] as string[] } };
		function Paths() {
			const [value, setValue] = React.useState({
				includes: { pattern: [] as string[] },
				excludes: { pattern: [] as string[] }
			});
			latest.includes = value.includes;
			latest.excludes = value.excludes;
			return React.createElement(TypeDestinationPathsSelector, {
				field: field('paths', 'Paths', 'type-destination-paths-selector'),
				value,
				setValue
			});
		}

		const host = await render(React.createElement(Paths));
		await clickAdd(host, 'Add include path');
		assert.deepEqual(latest.includes.pattern, ['']);
		assert.deepEqual(latest.excludes.pattern, []);
		assertFocusedRow('Includes pattern 1', '');

		await clickAdd(host, 'Add include path');
		assert.deepEqual(latest.includes.pattern, ['', '']);
		assertFocusedRow('Includes pattern 2', '');
	});

	it('appends an empty exclude path and focuses it from an empty list and a populated list', async () => {
		const latest = { includes: { pattern: [] as string[] }, excludes: { pattern: [] as string[] } };
		function Paths() {
			const [value, setValue] = React.useState({
				includes: { pattern: [] as string[] },
				excludes: { pattern: [] as string[] }
			});
			latest.includes = value.includes;
			latest.excludes = value.excludes;
			return React.createElement(TypeDestinationPathsSelector, {
				field: field('paths', 'Paths', 'type-destination-paths-selector'),
				value,
				setValue
			});
		}

		const host = await render(React.createElement(Paths));
		await clickAdd(host, 'Add exclude path');
		assert.deepEqual(latest.excludes.pattern, ['']);
		assert.deepEqual(latest.includes.pattern, []);
		assertFocusedRow('Excludes pattern 1', '');

		await clickAdd(host, 'Add exclude path');
		assert.deepEqual(latest.excludes.pattern, ['', '']);
		assertFocusedRow('Excludes pattern 2', '');
	});
});

async function clickAdd(host: HTMLElement, label: string) {
	const button = host.querySelector(`button[aria-label="${label}"]`);
	assert.ok(button instanceof HTMLButtonElement);
	await act(async () => {
		button.click();
	});
}

function assertFocusedRow(label: string, value: string) {
	const focused = document.activeElement;
	assert.ok(focused instanceof HTMLInputElement);
	assert.equal(focused.getAttribute('aria-label'), label);
	assert.equal(focused.value, value);
}
