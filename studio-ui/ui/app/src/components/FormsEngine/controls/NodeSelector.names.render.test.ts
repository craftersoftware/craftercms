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
 * Each row keeps a More actions button named for the item. The menu offers Edit or View, Move to field,
 * and Delete/Unlink. In a read-only field the menu only offers View.
 */

import '../../../../test/stringListDomSetup.mjs';
import '../../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const { React, FormHost, baseItems, createEntry, createItemsStore, fieldFor, formPath } =
	await import('../lib/formItemTestHarness');
const { createRoot } = await import('react-dom/client');
const { act } = await import('react');
const { RawIntlProvider, createIntl } = await import('react-intl');
const { Provider } = await import('react-redux');
const { default: NodeSelector } = await import('./NodeSelector.tsx');

// The real createIntl, not createTestIntl: the shared helper makes up an id for a descriptor that has none, which
// hides a message the app would throw on. Here a missing id fails the test.
const intl = createIntl({ locale: 'en', messages: {}, onError: () => undefined });

const articlePath = '/site/components/article.xml';
const photoPath = '/site/components/photo.xml';
const scriptPath = '/static-assets/app.js';
const dispatched: Array<{ type: string; payload?: Record<string, unknown> }> = [];

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	await act(async () => {
		for (const { unmount, host } of mounted.splice(0)) {
			unmount();
			host.remove();
		}
	});
});

function storedItem(path: string, label: string, edit: boolean) {
	return {
		...baseItems()[formPath],
		path,
		label,
		systemType: 'component',
		mimeType: 'application/xml',
		stateMap: {},
		availableActionsMap: edit ? { edit: true } : {}
	};
}

function storedAsset(path: string, label: string) {
	return {
		...storedItem(path, label, true),
		systemType: 'asset',
		mimeType: 'application/javascript'
	};
}

async function renderSelector(readonly: boolean, field = fieldFor('nodes_o', 'node-selector')) {
	const store = createItemsStore({
		...baseItems(),
		// Embedded rows display the form item. It needs a state map or the publishing icon crashes.
		[formPath]: { ...baseItems()[formPath], stateMap: {} },
		[articlePath]: storedItem(articlePath, 'Article', true),
		[photoPath]: storedItem(photoPath, 'Photo', false),
		[scriptPath]: storedAsset(scriptPath, 'app.js')
	});
	dispatched.length = 0;
	const dispatch = store.dispatch;
	store.dispatch = ((action: (typeof dispatched)[number]) => {
		dispatched.push(action);
		return dispatch(action as never);
	}) as never;
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	mounted.push({ unmount: () => root.unmount(), host });
	await act(async () => {
		root.render(
			React.createElement(
				Provider,
				{ store },
				React.createElement(
					RawIntlProvider,
					{ value: intl },
					React.createElement(
						FormHost,
						{ entry: createEntry(['nodes_o']) },
						React.createElement(NodeSelector, {
							field,
							value: [
								{ key: articlePath, value: 'Article', include: articlePath },
								{ key: 'hero', value: 'Hero', component: { 'file-name': 'hero' } },
								{ key: photoPath, value: 'Photo', include: photoPath },
								{ key: scriptPath, value: 'app.js', include: scriptPath }
							],
							setValue() {},
							readonly,
							autoFocus: false,
							inputId: 'x',
							labelId: 'y',
							contentType: { id: '/component/thing', fields: {} }
						} as never)
					)
				)
			)
		);
	});
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 50));
	});
	return host;
}

const labelsOf = (host: HTMLElement) =>
	Array.from(host.querySelectorAll('button[aria-label]'), (button) => button.getAttribute('aria-label'));

const menuLabels = () =>
	Array.from(document.body.querySelectorAll('[role="menuitem"]'), (item) => item.textContent ?? '');

async function openOptions(host: HTMLElement, itemLabel: string) {
	const button = host.querySelector<HTMLButtonElement>(`button[aria-label="Options for ${itemLabel}"]`);
	assert.ok(button, `expected Options for ${itemLabel}`);
	await act(async () => {
		button.click();
	});
}

async function chooseMenuItem(label: string) {
	const item = Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(
		(candidate) => candidate.textContent === label
	);
	assert.ok(item, `expected menu item ${label}`);
	await act(async () => {
		item.click();
	});
}

async function clickRow(host: HTMLElement, text: string) {
	const row = Array.from(host.querySelectorAll<HTMLElement>('[role="button"]')).find((element) =>
		element.textContent?.includes(text)
	);
	assert.ok(row, `expected a row containing ${text}`);
	await act(async () => {
		row.click();
	});
}

const lastCodeEditorAction = () => dispatched.findLast((action) => action.type === 'SHOW_CODE_EDITOR_DIALOG');

describe('NodeSelector row button names', () => {
	it('names the More button for each item and offers Edit, Move, and Delete/Unlink', async () => {
		const host = await renderSelector(false);
		const labels = labelsOf(host);
		assert.ok(labels.includes('Options for Article'));
		assert.ok(labels.includes('Options for Hero'));
		assert.ok(labels.includes('Options for Photo'));
		assert.ok(labels.includes('Options for app.js'));

		await openOptions(host, 'Article');
		assert.deepEqual(menuLabels(), ['Edit', 'Move to field…', 'Unlink']);

		await openOptions(host, 'Hero');
		assert.deepEqual(menuLabels(), ['Edit', 'Move to field…', 'Delete']);

		await openOptions(host, 'Photo');
		assert.deepEqual(menuLabels(), ['View', 'Move to field…', 'Unlink']);

		await openOptions(host, 'app.js');
		assert.deepEqual(menuLabels(), ['Edit', 'Move to field…', 'Unlink']);
	});

	it('offers only View in a read-only field', async () => {
		const host = await renderSelector(true);
		const labels = labelsOf(host);
		assert.ok(labels.includes('Options for Article'));
		assert.ok(labels.includes('Options for Hero'));
		assert.ok(labels.includes('Options for Photo'));
		assert.ok(labels.includes('Options for app.js'));

		await openOptions(host, 'Article');
		assert.deepEqual(menuLabels(), ['View']);

		await openOptions(host, 'Hero');
		assert.deepEqual(menuLabels(), ['View']);

		await openOptions(host, 'Photo');
		assert.deepEqual(menuLabels(), ['View']);

		await openOptions(host, 'app.js');
		assert.deepEqual(menuLabels(), ['View']);
	});

	it('opens an editable asset in the code editor, writable only when the form is editable', async () => {
		const editable = await renderSelector(false);
		await openOptions(editable, 'app.js');
		await chooseMenuItem('Edit');
		const writable = dispatched.find((action) => action.type === 'SHOW_CODE_EDITOR_DIALOG');
		assert.equal(writable?.payload?.path, scriptPath);
		assert.equal(writable?.payload?.readonly, false);

		const readonly = await renderSelector(true);
		await openOptions(readonly, 'app.js');
		await chooseMenuItem('View');
		const readOnly = dispatched.find((action) => action.type === 'SHOW_CODE_EDITOR_DIALOG');
		assert.equal(readOnly?.payload?.path, scriptPath);
		assert.equal(readOnly?.payload?.readonly, true);
	});

	it('opens an asset row writable in an editable form and read-only in a read-only form', async () => {
		const editable = await renderSelector(false);
		await clickRow(editable, scriptPath);
		assert.equal(lastCodeEditorAction()?.payload?.path, scriptPath);
		assert.equal(lastCodeEditorAction()?.payload?.readonly, false);

		const readonly = await renderSelector(true);
		await clickRow(readonly, scriptPath);
		assert.equal(lastCodeEditorAction()?.payload?.path, scriptPath);
		assert.equal(lastCodeEditorAction()?.payload?.readonly, true);
	});

	it('keeps the add button name and leaves its wrapper unnamed while the tooltip is open', async () => {
		const field = fieldFor('nodes_o', 'node-selector');
		field.validations = { maxCount: { id: 'maxCount', value: '1' } } as never;
		const host = await renderSelector(false, field);
		const button = Array.from(host.querySelectorAll<HTMLButtonElement>('button[aria-label]')).find((candidate) =>
			candidate.getAttribute('aria-label')?.startsWith('Maximum amount of items reached')
		);
		assert.ok(button, 'no add button named for the limit');
		const span = button.parentElement;
		assert.equal(span?.tagName, 'SPAN');
		await act(async () => {
			span.dispatchEvent(new window.MouseEvent('mouseover', { bubbles: true }));
			await new Promise((resolve) => setTimeout(resolve, 50));
		});
		assert.equal(span.getAttribute('aria-label'), null);
		assert.equal(span.getAttribute('aria-labelledby'), null);
	});
});
