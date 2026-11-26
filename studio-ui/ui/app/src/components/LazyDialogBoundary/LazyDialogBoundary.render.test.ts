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
 * A lazily loaded dialog whose chunk fails to load must not take the page down, and must load on a later open
 * instead of replaying the rejected `lazy` promise.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const React = await import('react');
const { act, createElement: h, Suspense } = React;
const { createRoot } = await import('react-dom/client');
const { LazyDialogBoundary } = await import('./LazyDialogBoundary.tsx');
const { lazyWithRetry } = await import('../../utils/lazyWithRetry.ts');

const mountedRoots: Array<{ unmount(): void }> = [];
afterEach(async () => {
	await act(async () => {
		for (const root of mountedRoots.splice(0)) root.unmount();
	});
});

const Dialog = ({ open }: { open: boolean }) => h('div', { id: 'dialog' }, open ? 'open' : 'closed');

describe('lazy dialog failure', () => {
	it('is contained, reported once, and retried on the next open', async () => {
		let imports = 0;
		let failing = true;
		const LazyDialog = lazyWithRetry(async () => {
			imports++;
			if (failing) throw new Error('Failed to fetch dynamically imported module');
			return { default: Dialog };
		});
		const errors: Error[] = [];
		let setOpen: (open: boolean) => void;
		const Page = () => {
			const [open, set] = React.useState(true);
			React.useEffect(() => {
				setOpen = set;
			}, [set]);
			return h(
				'main',
				null,
				h('p', { id: 'page' }, 'Projects'),
				h(
					LazyDialogBoundary,
					{
						dialog: LazyDialog,
						open,
						onError: (error: Error) => {
							errors.push(error);
							set(false);
						}
					},
					h(Suspense, { fallback: '' }, h(LazyDialog, { open }))
				)
			);
		};
		const container = document.createElement('div');
		const root = createRoot(container);
		mountedRoots.push(root);
		// React logs the caught error.
		const consoleError = console.error;
		console.error = () => undefined;
		try {
			await act(async () => {
				root.render(h(Page));
			});
		} finally {
			console.error = consoleError;
		}
		assert.equal(container.querySelector('#page')?.textContent, 'Projects', 'the page around the dialog stays');
		assert.equal(container.querySelector('#dialog'), null);
		assert.equal(errors.length, 1, 'reports the failure once');
		const importsAfterFailure = imports;

		failing = false;
		await act(async () => {
			setOpen(true);
		});
		assert.equal(imports, importsAfterFailure + 1, 'opening again starts a new import');
		assert.equal(errors.length, 1);
		assert.equal(container.querySelector('#dialog')?.textContent, 'open');

		await act(async () => {
			setOpen(false);
		});
		assert.equal(container.querySelector('#dialog')?.textContent, 'closed', 'stays mounted for its exit transition');
		await act(async () => {
			setOpen(true);
		});
		assert.equal(imports, importsAfterFailure + 1, 'a loaded dialog is not imported again');
	});
});
