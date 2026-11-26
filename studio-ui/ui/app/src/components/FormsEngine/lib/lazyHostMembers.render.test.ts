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
 * `craftercms.formsEngine.controls.FormsEngineField` and `.useFieldValue` are stand-ins that keep the form code out of
 * the startup bundle. A plugin control renders them like the real members: synchronously when the real members are
 * installed (always the case inside a form), suspending when they are not loaded yet, and trying the load again on
 * the next render when it failed.
 */

import '../../../../test/stringListDomSetup.mjs';
import '../../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { HostMembers } from './lazyHostMembers.ts';

const React = await import('react');
const { act, Component, createElement: h, Suspense } = React;
const { createRoot } = await import('react-dom/client');
const { createHostMemberStandIns } = await import('./lazyHostMembers.ts');

const mountedRoots: Array<{ unmount(): void }> = [];
afterEach(async () => {
	await act(async () => {
		for (const root of mountedRoots.splice(0)) root.unmount();
	});
});

class Boundary extends Component<{ children?: React.ReactNode }, { error: Error | null }> {
	state = { error: null as Error | null };
	static getDerivedStateFromError(error: Error) {
		return { error };
	}
	reset() {
		this.setState({ error: null });
	}
	render() {
		return this.state.error ? h('p', { id: 'failed' }, this.state.error.message) : this.props.children;
	}
}

const realMembers = (): HostMembers => ({
	FormsEngineField: React.forwardRef<HTMLDivElement, { children?: React.ReactNode }>(function RealField(props, ref) {
		return h('div', { ref, id: 'real-field' }, props.children);
	}) as unknown as HostMembers['FormsEngineField'],
	useFieldValue: ((fieldId: string) => [`value of ${fieldId}`, () => undefined, true]) as HostMembers['useFieldValue']
});

async function mount(tree: React.ReactElement) {
	const container = document.createElement('div');
	const root = createRoot(container);
	mountedRoots.push(root);
	await act(async () => {
		root.render(tree);
	});
	return { container, root };
}

const ValueReader = ({ useFieldValue }: { useFieldValue: HostMembers['useFieldValue'] }) => {
	const [value] = useFieldValue('title_s');
	return h('span', { id: 'value' }, String(value));
};

describe('host member stand-ins', () => {
	it('render the real members synchronously when they are already installed', () => {
		let imports = 0;
		const { install, FormsEngineField, useFieldValue } = createHostMemberStandIns(async () => {
			imports++;
		});
		install(realMembers());
		const container = document.createElement('div');
		const root = createRoot(container);
		mountedRoots.push(root);
		// A synchronous act: if either member suspended, the fallback would show and the real output would be missing.
		act(() => {
			root.render(
				h(
					Suspense,
					{ fallback: h('i', { id: 'fallback' }) },
					h(FormsEngineField, { inputId: 'x' } as never, 'chrome'),
					h(ValueReader, { useFieldValue })
				)
			);
		});
		assert.equal(container.querySelector('#fallback'), null);
		assert.equal(container.querySelector('#real-field')?.textContent, 'chrome');
		assert.equal(container.querySelector('#value')?.textContent, 'value of title_s');
		assert.equal(imports, 0, 'the lazy import is not needed once the real members are installed');
	});

	it('suspend until the real members load, then render them', async () => {
		let finishImport: () => void;
		let imports = 0;
		const standIns = createHostMemberStandIns(() => {
			imports++;
			return new Promise<void>((resolve) => {
				finishImport = () => {
					standIns.install(realMembers());
					resolve();
				};
			});
		});
		const { container } = await mount(
			h(
				Suspense,
				{ fallback: h('i', { id: 'fallback' }) },
				h(standIns.FormsEngineField, { inputId: 'x' } as never, 'chrome')
			)
		);
		assert.ok(container.querySelector('#fallback'), 'shows the fallback while loading');
		assert.equal(container.querySelector('#real-field'), null);
		await act(async () => {
			finishImport();
		});
		assert.equal(container.querySelector('#fallback'), null);
		assert.equal(container.querySelector('#real-field')?.textContent, 'chrome');
		assert.equal(imports, 1);
	});

	it('suspend for useFieldValue too, then return the real hook result', async () => {
		let finishImport: () => void;
		const standIns = createHostMemberStandIns(
			() =>
				new Promise<void>((resolve) => {
					finishImport = () => {
						standIns.install(realMembers());
						resolve();
					};
				})
		);
		const { container } = await mount(
			h(Suspense, { fallback: h('i', { id: 'fallback' }) }, h(ValueReader, { useFieldValue: standIns.useFieldValue }))
		);
		assert.ok(container.querySelector('#fallback'));
		await act(async () => {
			finishImport();
		});
		assert.equal(container.querySelector('#value')?.textContent, 'value of title_s');
	});

	it('retry the import on the next render after it failed instead of reusing the rejected promise', async () => {
		let imports = 0;
		let failing = true;
		const standIns = createHostMemberStandIns(async () => {
			imports++;
			if (failing) throw new Error('Failed to fetch dynamically imported module');
			standIns.install(realMembers());
		});
		const boundary = React.createRef<Boundary>();
		const tree = h(
			Boundary,
			{ ref: boundary },
			h(
				Suspense,
				{ fallback: h('i', { id: 'fallback' }) },
				h(standIns.FormsEngineField, { inputId: 'x' } as never, 'chrome')
			)
		);
		// React logs the caught error.
		const consoleError = console.error;
		console.error = () => undefined;
		let container: HTMLElement;
		try {
			({ container } = await mount(tree));
		} finally {
			console.error = consoleError;
		}
		assert.equal(container.querySelector('#failed')?.textContent, 'Failed to fetch dynamically imported module');
		// React itself may retry a failed render before giving up, so count from here.
		const importsAfterFailure = imports;
		assert.ok(importsAfterFailure >= 1);
		failing = false;
		await act(async () => {
			boundary.current.reset();
		});
		assert.equal(imports, importsAfterFailure + 1, 'the next render started a new import');
		assert.equal(container.querySelector('#failed'), null);
		assert.equal(container.querySelector('#real-field')?.textContent, 'chrome');
	});
});
