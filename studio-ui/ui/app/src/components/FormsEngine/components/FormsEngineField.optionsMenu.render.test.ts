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
 * The field Options button is reachable by keyboard (WCAG 2.1.1) without a tab stop per field: it is in the tab
 * order only while focus is inside its field. It names and describes its menu, and gives focus back on close.
 */

import '../../../../test/stringListDomSetup.mjs';
import '../../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const { React, act, FormHost, createEntry, createItemsStore, baseItems, fieldFor, mountTree, settle, unmountAll } =
	await import('../lib/formItemTestHarness');
const { Provider: JotaiProvider, createStore } = await import('jotai');
const { FormsEngineField } = await import('./FormsEngineField.tsx');

afterEach(() => {
	unmountAll();
});

async function render() {
	const field = (id: string) =>
		React.createElement(
			FormsEngineField,
			{ key: id, field: fieldFor(id), htmlFor: `${id}-input`, isValid: true },
			React.createElement('input', { id: `${id}-input` })
		);
	const host = await mountTree(
		createItemsStore(baseItems()),
		React.createElement(
			JotaiProvider,
			{ store: createStore() },
			React.createElement(FormHost, { entry: createEntry(['a_s', 'b_s']) }, [field('a_s'), field('b_s')])
		)
	);
	await settle();
	return host;
}

const optionsButton = (host: HTMLElement, id: string) =>
	host.querySelector<HTMLButtonElement>(`[data-field-id="${id}"] button[aria-haspopup]`)!;
const input = (host: HTMLElement, id: string) => host.querySelector<HTMLInputElement>(`#${id}-input`)!;
/** Elements the Tab key can reach, in DOM order. */
const tabOrder = (host: HTMLElement) =>
	Array.from(host.querySelectorAll<HTMLElement>('button, input')).filter((el) => el.tabIndex >= 0);
const focusIn = (element: HTMLElement) =>
	act(async () => {
		element.focus();
	});
const menuOf = () => document.querySelector<HTMLElement>('[role="menu"]');
// jsdom runs no default actions, so a key that activates a native button is followed by the click a browser fires.
const activate = (button: HTMLElement, key: 'Enter' | ' ') =>
	act(async () => {
		button.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
		if (key === ' ') button.dispatchEvent(new window.KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }));
		button.click();
	});
const press = (element: Element, key: string) =>
	act(async () => {
		element.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
	});
const waitForMenuToClose = () =>
	act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 400));
	});

describe('FormsEngineField Options button keyboard access', () => {
	it('is out of the tab order while focus is outside its field', async () => {
		const host = await render();
		assert.equal(optionsButton(host, 'a_s').tabIndex, -1);
		assert.equal(optionsButton(host, 'b_s').tabIndex, -1);
		assert.deepEqual(tabOrder(host), [input(host, 'a_s'), input(host, 'b_s')]);
	});

	it('is tabbable only in the field that contains focus', async () => {
		const host = await render();
		await focusIn(input(host, 'a_s'));
		assert.equal(optionsButton(host, 'a_s').tabIndex, 0);
		assert.equal(optionsButton(host, 'b_s').tabIndex, -1);
		assert.deepEqual(tabOrder(host), [optionsButton(host, 'a_s'), input(host, 'a_s'), input(host, 'b_s')]);
		await focusIn(input(host, 'b_s'));
		assert.equal(optionsButton(host, 'a_s').tabIndex, -1);
		assert.equal(optionsButton(host, 'b_s').tabIndex, 0);
		await act(async () => input(host, 'b_s').blur());
		assert.equal(optionsButton(host, 'b_s').tabIndex, -1);
	});

	it('stays tabbable while the button itself has focus', async () => {
		const host = await render();
		await focusIn(input(host, 'a_s'));
		await focusIn(optionsButton(host, 'a_s'));
		assert.equal(optionsButton(host, 'a_s').tabIndex, 0);
		await focusIn(input(host, 'a_s'));
		assert.equal(optionsButton(host, 'a_s').tabIndex, 0);
	});

	it('has a name and describes its menu', async () => {
		const host = await render();
		const button = optionsButton(host, 'a_s');
		assert.equal(button.getAttribute('aria-label'), 'Options for Label of a_s');
		assert.equal(button.getAttribute('aria-haspopup'), 'menu');
		assert.equal(button.getAttribute('aria-expanded'), 'false');
		assert.equal(button.hasAttribute('aria-controls'), false);
		await focusIn(button);
		await activate(button, 'Enter');
		const menu = menuOf();
		assert.ok(menu);
		assert.equal(button.getAttribute('aria-expanded'), 'true');
		assert.equal(button.getAttribute('aria-controls'), menu.id);
		assert.equal(menu.getAttribute('aria-labelledby'), button.id);
	});

	for (const key of ['Enter', ' '] as const) {
		it(`opens its menu with ${key === ' ' ? 'Space' : key} and returns focus to the button on Escape`, async () => {
			const host = await render();
			const button = optionsButton(host, 'a_s');
			await focusIn(input(host, 'a_s'));
			await focusIn(button);
			assert.equal(menuOf(), null);
			await activate(button, key);
			const menu = menuOf();
			assert.ok(menu);
			assert.ok(
				Array.from(menu.querySelectorAll('[role="menuitem"]')).some((item) =>
					/Field Information/.test(item.textContent ?? '')
				)
			);
			assert.ok(menu.contains(document.activeElement), 'focus moves into the menu');
			assert.equal(optionsButton(host, 'a_s').tabIndex, 0);
			await press(document.activeElement!, 'Escape');
			await waitForMenuToClose();
			assert.equal(menuOf(), null);
			assert.equal(button.getAttribute('aria-expanded'), 'false');
			assert.equal(document.activeElement, button);
			assert.equal(button.tabIndex, 0);
		});
	}

	it('drops out of the tab order again once focus leaves after the menu closes', async () => {
		const host = await render();
		const button = optionsButton(host, 'a_s');
		await focusIn(button);
		await activate(button, 'Enter');
		await press(document.activeElement!, 'Escape');
		await waitForMenuToClose();
		await focusIn(input(host, 'b_s'));
		assert.equal(button.tabIndex, -1);
	});
});
