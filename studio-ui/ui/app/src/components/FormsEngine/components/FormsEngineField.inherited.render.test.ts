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
 * The Edit button of an inherited value opens the source item, so its name carries that item's label. Every
 * inherited field repeats the button.
 */

import '../../../../test/stringListDomSetup.mjs';
import '../../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const {
	React,
	FormHost,
	createEntry,
	createItemsStore,
	baseItems,
	fieldFor,
	mountTree,
	settle,
	sourcePath,
	unmountAll
} = await import('../lib/formItemTestHarness');
const { act } = await import('react');
const { Provider: JotaiProvider, createStore } = await import('jotai');
const { FormsEngineField } = await import('./FormsEngineField.tsx');

afterEach(() => {
	unmountAll();
});

async function render(items = baseItems()) {
	const host = await mountTree(
		createItemsStore(items),
		React.createElement(
			JotaiProvider,
			{ store: createStore() },
			React.createElement(
				FormHost,
				{ entry: createEntry(['title_s']), sourceMap: { title_s: sourcePath } },
				React.createElement(FormsEngineField, { field: fieldFor('title_s'), isValid: true })
			)
		)
	);
	await settle();
	return host;
}

const labelsOf = (host: HTMLElement) =>
	Array.from(host.querySelectorAll('button[aria-label]'), (button) => button.getAttribute('aria-label'));

describe('FormsEngineField inherited value Edit button', () => {
	it('is named for the source item label', async () => {
		const labels = labelsOf(await render());
		assert.ok(labels.includes('Edit Source'), labels.join(' | '));
		assert.equal(labels.includes('Edit'), false);
	});

	it('falls back to the source path when the item has no stored label', async () => {
		const { [sourcePath]: _omitted, ...items } = baseItems();
		const labels = labelsOf(await render(items));
		assert.ok(labels.includes(`Edit ${sourcePath}`), labels.join(' | '));
	});
});

describe('FormsEngineField help text', () => {
	it('is a static note, not an alert, once opened from the help button', async () => {
		const host = await mountTree(
			createItemsStore(baseItems()),
			React.createElement(
				JotaiProvider,
				{ store: createStore() },
				React.createElement(
					FormHost,
					{ entry: createEntry(['title_s']), sourceMap: null },
					React.createElement(FormsEngineField, {
						field: { ...fieldFor('title_s'), helpText: '<p>Pick a title</p>' },
						isValid: true
					})
				)
			)
		);
		await settle();
		const button = host.querySelector<HTMLButtonElement>('button[aria-label="Help for Label of title_s"]');
		assert.ok(button, 'the help button is missing');
		await act(async () => {
			button.click();
		});
		await settle();
		const help = host.querySelector('section');
		assert.ok(help?.textContent?.includes('Pick a title'), 'the help text is not shown');
		assert.equal(help.closest('.MuiAlert-root')?.getAttribute('role'), 'note');
		assert.equal(host.querySelectorAll('[role="alert"]').length, 0);
	});
});
