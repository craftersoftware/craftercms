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
 * The dialog's aria-labelledby must point at an element that is rendered, and two open dialogs must not
 * share ids. With no title the body text names the dialog, and with neither the dialog has no labelledby.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

// MUI's focus trap checks ShadowRoot. jsdom exposes it on window, not as a Node global.
globalThis.ShadowRoot ??= window.ShadowRoot ?? class ShadowRoot {};

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { RawIntlProvider } = await import('react-intl');
const { createTestIntl } = await import('../../../test/createTestIntl.mjs');
const { default: ConfirmDialog } = await import('../ConfirmDialog/ConfirmDialog.tsx');
const { default: AlertDialog } = await import('./AlertDialog.tsx');

const intl = createTestIntl();
const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
});

async function render(component: React.ElementType, props: Record<string, unknown> = {}) {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	await act(async () => {
		root.render(
			React.createElement(RawIntlProvider, { value: intl }, React.createElement(component, { open: true, ...props }))
		);
	});
	mounted.push({ unmount: () => root.unmount(), host });
}

function dialogs() {
	return [...document.querySelectorAll('[role="dialog"]')] as HTMLElement[];
}

/** The accessible name, resolved from aria-labelledby the way a browser does. */
function nameOf(dialog: HTMLElement) {
	const ids = (dialog.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter(Boolean);
	return ids
		.map((id) => {
			const target = document.getElementById(id);
			assert.ok(target, `aria-labelledby points at "${id}", which is not rendered`);
			return target.textContent?.trim();
		})
		.join(' ');
}

describe('AlertDialog accessible name', () => {
	it('names an AlertDialog by its title', async () => {
		await render(AlertDialog, { title: 'Leave this form?', body: 'Your changes will be discarded.' });
		const [dialog] = dialogs();
		assert.equal(nameOf(dialog), 'Leave this form?');
		assert.equal(document.getElementById(dialog.getAttribute('aria-labelledby'))?.tagName, 'H2');
		assert.ok(document.getElementById(dialog.getAttribute('aria-describedby')));
	});

	it('names a ConfirmDialog by its title', async () => {
		await render(ConfirmDialog, { title: 'Delete item?', body: 'This cannot be undone.', onOk() {}, onCancel() {} });
		assert.equal(nameOf(dialogs()[0]), 'Delete item?');
	});

	it('names the dialog by its body text when there is no title', async () => {
		await render(ConfirmDialog, { body: 'This cannot be undone.', onOk() {}, onCancel() {} });
		assert.equal(nameOf(dialogs()[0]), 'This cannot be undone.');
	});

	it('has no aria-labelledby when there is neither a title nor a body', async () => {
		await render(AlertDialog, { children: React.createElement('p', null, 'Only children') });
		const [dialog] = dialogs();
		assert.equal(dialog.hasAttribute('aria-labelledby'), false);
		assert.ok(document.getElementById(dialog.getAttribute('aria-describedby')));
	});

	it('gives stacked dialogs their own title ids', async () => {
		await render(AlertDialog, { title: 'First' });
		await render(AlertDialog, { title: 'Second' });
		const [first, second] = dialogs();
		assert.notEqual(first.getAttribute('aria-labelledby'), second.getAttribute('aria-labelledby'));
		assert.notEqual(first.getAttribute('aria-describedby'), second.getAttribute('aria-describedby'));
		assert.equal(nameOf(first), 'First');
		assert.equal(nameOf(second), 'Second');
		const ids = [...document.querySelectorAll('[id]')].map((node) => node.id);
		assert.equal(new Set(ids).size, ids.length, 'duplicate ids');
	});
});
