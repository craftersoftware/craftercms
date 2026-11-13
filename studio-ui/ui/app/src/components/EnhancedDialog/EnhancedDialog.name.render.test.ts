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
 * Every EnhancedDialog is announced without a name unless its aria-labelledby points at the visible heading
 * text, which DialogHeader renders. A caller that names the dialog itself keeps its own name, and a dialog
 * with no title must not carry a reference to an element that is not rendered.
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
const { default: EnhancedDialog } = await import('./EnhancedDialog.tsx');

const intl = createTestIntl();
const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
});

async function render({ children, ...props }: Record<string, unknown> = {}) {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	await act(async () => {
		root.render(
			React.createElement(
				RawIntlProvider,
				{ value: intl },
				React.createElement(
					EnhancedDialog,
					{ open: true, ...props },
					children ?? React.createElement('div', null, 'Body')
				)
			)
		);
	});
	mounted.push({ unmount: () => root.unmount(), host });
	return host;
}

function dialog(): HTMLElement {
	const element = document.querySelector('[role="dialog"]');
	assert.ok(element instanceof HTMLElement, 'no element with role dialog');
	return element;
}

/** The accessible name, resolved from aria-labelledby the way a browser does, falling back to aria-label. */
function nameOf(element: HTMLElement) {
	const ids = (element.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter(Boolean);
	if (!ids.length) return element.getAttribute('aria-label');
	return ids
		.map((id) => {
			const target = document.getElementById(id);
			assert.ok(target, `aria-labelledby points at "${id}", which is not rendered`);
			return target.textContent?.trim();
		})
		.join(' ');
}

describe('EnhancedDialog accessible name', () => {
	it('names the dialog by its title and points at the visible heading', async () => {
		await render({ title: 'Publish' });
		const element = dialog();
		const labelledBy = element.getAttribute('aria-labelledby');
		assert.ok(labelledBy, 'the dialog has no aria-labelledby');
		assert.equal(document.getElementById(labelledBy)?.tagName, 'H2');
		assert.equal(document.getElementById(labelledBy)?.textContent, 'Publish');
		assert.equal(nameOf(element), 'Publish');
	});

	it('names the dialog by a title given through the header props', async () => {
		await render({ dialogHeaderProps: { title: 'Delete item?' } });
		assert.equal(nameOf(dialog()), 'Delete item?');
	});

	it('gives stacked dialogs their own title ids', async () => {
		await render({ title: 'First' });
		await render({ title: 'Second' });
		const [first, second] = [...document.querySelectorAll('[role="dialog"]')] as HTMLElement[];
		assert.notEqual(first.getAttribute('aria-labelledby'), second.getAttribute('aria-labelledby'));
		assert.equal(nameOf(first), 'First');
		assert.equal(nameOf(second), 'Second');
		const ids = [...document.querySelectorAll('[id]')].map((node) => node.id);
		assert.equal(new Set(ids).size, ids.length, 'duplicate ids');
	});

	it('keeps a caller-supplied aria-labelledby', async () => {
		await render({
			title: 'Publish',
			'aria-labelledby': 'caller-heading',
			children: React.createElement('h1', { id: 'caller-heading' }, 'Caller heading')
		});
		assert.ok(document.getElementById('caller-heading'));
		const element = dialog();
		assert.equal(element.getAttribute('aria-labelledby'), 'caller-heading');
		assert.equal(nameOf(element), 'Caller heading');
	});

	it('keeps a caller-supplied aria-label', async () => {
		await render({ title: 'Publish', 'aria-label': 'Publish the selected items' });
		const element = dialog();
		assert.equal(element.getAttribute('aria-label'), 'Publish the selected items');
		assert.equal(element.hasAttribute('aria-labelledby'), false);
		assert.equal(nameOf(element), 'Publish the selected items');
	});

	it('keeps a caller-supplied aria-labelledby passed through the paper slot', async () => {
		await render({
			title: 'Publish',
			slotProps: { paper: { 'aria-labelledby': 'slot-heading' } },
			children: React.createElement('h1', { id: 'slot-heading' }, 'Slot heading')
		});
		assert.ok(document.getElementById('slot-heading'));
		assert.equal(dialog().getAttribute('aria-labelledby'), 'slot-heading');
		assert.equal(nameOf(dialog()), 'Slot heading');
	});

	it('has no dangling aria-labelledby when there is no title', async () => {
		await render({ subtitle: 'Nothing to name this by' });
		const element = dialog();
		assert.equal(element.hasAttribute('aria-labelledby'), false);
		assert.equal(nameOf(element), null);
	});

	it('has no dangling aria-labelledby when the header is omitted', async () => {
		await render({ title: 'Publish', omitHeader: true });
		assert.equal(dialog().hasAttribute('aria-labelledby'), false);
	});
});
