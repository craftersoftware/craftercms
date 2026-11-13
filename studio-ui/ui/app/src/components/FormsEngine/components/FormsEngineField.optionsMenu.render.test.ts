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

/** Renders one field per entry, each with the given control, or no control at all. */
async function renderControls(
	controls: Record<string, ReturnType<typeof React.createElement> | null>,
	fieldOverrides: Record<string, unknown> = {}
) {
	const ids = Object.keys(controls);
	const host = await mountTree(
		createItemsStore(baseItems()),
		React.createElement(
			JotaiProvider,
			{ store: createStore() },
			React.createElement(
				FormHost,
				{ entry: createEntry(ids) },
				ids.map((id) =>
					React.createElement(
						FormsEngineField,
						{ key: id, field: { ...fieldFor(id), ...fieldOverrides }, htmlFor: `${id}-input`, isValid: true },
						controls[id]
					)
				)
			)
		)
	);
	await settle();
	return host;
}
const disabledInput = (id: string) => React.createElement('input', { id: `${id}-input`, disabled: true });
const enabledInput = (id: string) => React.createElement('input', { id: `${id}-input` });
const mutate = (change: () => void) =>
	act(async () => {
		change();
		await new Promise((resolve) => setTimeout(resolve, 0));
	});

const optionsButton = (host: HTMLElement, id: string) =>
	host.querySelector<HTMLButtonElement>(`[data-field-id="${id}"] button[aria-haspopup]`)!;
const input = (host: HTMLElement, id: string) => host.querySelector<HTMLInputElement>(`#${id}-input`)!;
/** Elements the Tab key can reach, in DOM order. */
const tabOrder = (host: HTMLElement) =>
	Array.from(host.querySelectorAll<HTMLElement>('button, input')).filter(
		(el) => el.tabIndex >= 0 && !el.matches(':disabled')
	);
const helpButton = (host: HTMLElement, id: string) =>
	host.querySelector<HTMLButtonElement>(`[data-field-id="${id}"] button[aria-label^="Help for"]`)!;
const focusIn = (element: HTMLElement) =>
	act(async () => {
		element.focus();
	});
// jsdom has no sequential focus navigation, so Tab and Shift+Tab move through the elements the tab order holds now.
const tab = (host: HTMLElement, { backwards = false } = {}) =>
	act(async () => {
		const order = tabOrder(host);
		const index = order.indexOf(document.activeElement as HTMLElement);
		order[backwards ? index - 1 : index + 1].focus();
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

	it('drops out of the tab order when the focused control is removed', async () => {
		const host = await renderControls({
			a_s: React.createElement(
				React.Fragment,
				null,
				enabledInput('a_s'),
				React.createElement('input', { id: 'a_s-other' })
			)
		});
		await focusIn(input(host, 'a_s'));
		assert.equal(optionsButton(host, 'a_s').tabIndex, 0);
		await mutate(() => {
			input(host, 'a_s').remove();
		});
		assert.notEqual(document.activeElement, optionsButton(host, 'a_s'));
		assert.equal(optionsButton(host, 'a_s').tabIndex, -1);
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

	describe('in a field with help text', () => {
		const helpText = { helpText: 'Some help' };

		it('tabs from Help straight to the control, with no stop on Options between them', async () => {
			const host = await renderControls({ a_s: enabledInput('a_s'), b_s: enabledInput('b_s') }, helpText);
			assert.deepEqual(tabOrder(host), [
				helpButton(host, 'a_s'),
				input(host, 'a_s'),
				helpButton(host, 'b_s'),
				input(host, 'b_s')
			]);
			await focusIn(helpButton(host, 'a_s'));
			assert.equal(optionsButton(host, 'a_s').tabIndex, -1);
			await tab(host);
			assert.equal(document.activeElement, input(host, 'a_s'));
			assert.equal(optionsButton(host, 'a_s').tabIndex, 0);
			await tab(host);
			assert.equal(document.activeElement, helpButton(host, 'b_s'));
			assert.equal(optionsButton(host, 'a_s').tabIndex, -1);
			assert.equal(optionsButton(host, 'b_s').tabIndex, -1);
			await tab(host);
			assert.equal(document.activeElement, input(host, 'b_s'));
		});

		it('reaches Options with Shift+Tab from the control, and Help beyond it', async () => {
			const host = await renderControls({ a_s: enabledInput('a_s') }, helpText);
			await focusIn(helpButton(host, 'a_s'));
			await tab(host);
			assert.equal(document.activeElement, input(host, 'a_s'));
			await tab(host, { backwards: true });
			assert.equal(document.activeElement, optionsButton(host, 'a_s'));
			assert.equal(optionsButton(host, 'a_s').tabIndex, 0);
			await tab(host, { backwards: true });
			assert.equal(document.activeElement, helpButton(host, 'a_s'));
			assert.equal(optionsButton(host, 'a_s').tabIndex, -1);
		});

		it('keeps Options reachable after Help when the control cannot take focus', async () => {
			const host = await renderControls({ a_s: disabledInput('a_s'), b_s: enabledInput('b_s') }, helpText);
			assert.equal(optionsButton(host, 'a_s').tabIndex, 0);
			assert.deepEqual(tabOrder(host).slice(0, 3), [
				helpButton(host, 'a_s'),
				optionsButton(host, 'a_s'),
				helpButton(host, 'b_s')
			]);
			await focusIn(helpButton(host, 'a_s'));
			await tab(host);
			assert.equal(document.activeElement, optionsButton(host, 'a_s'));
			await activate(optionsButton(host, 'a_s'), 'Enter');
			assert.ok(menuOf());
		});

		it('does not count a link inside the collapsed help as a tab stop', async () => {
			// jsdom has no checkVisibility, so it answers from the computed style, as a browser does.
			const proto = window.HTMLElement.prototype as { checkVisibility?: (this: HTMLElement) => boolean };
			proto.checkVisibility = function (this: HTMLElement) {
				return window.getComputedStyle(this).visibility !== 'hidden';
			};
			try {
				const host = await renderControls(
					{ a_s: disabledInput('a_s') },
					{ helpText: '<a href="https://example.com">More</a>' }
				);
				const link = host.querySelector<HTMLElement>('[data-field-id="a_s"] section a')!;
				assert.equal(window.getComputedStyle(link).visibility, 'hidden');
				assert.equal(optionsButton(host, 'a_s').tabIndex, 0);
				await activate(helpButton(host, 'a_s'), 'Enter');
				assert.equal(window.getComputedStyle(link).visibility, 'visible');
				assert.equal(optionsButton(host, 'a_s').tabIndex, -1);
			} finally {
				delete proto.checkVisibility;
			}
		});

		it('keeps the menu items counted as inside while the menu is open', async () => {
			const host = await renderControls({ a_s: enabledInput('a_s') }, helpText);
			await focusIn(input(host, 'a_s'));
			await focusIn(optionsButton(host, 'a_s'));
			await activate(optionsButton(host, 'a_s'), 'Enter');
			assert.ok(menuOf()!.contains(document.activeElement));
			assert.equal(optionsButton(host, 'a_s').tabIndex, 0);
		});
	});

	describe('when its field has no other tab stop', () => {
		it('stays in the tab order', async () => {
			const host = await renderControls({ a_s: disabledInput('a_s'), b_s: enabledInput('b_s') });
			assert.equal(optionsButton(host, 'a_s').tabIndex, 0);
			assert.equal(optionsButton(host, 'b_s').tabIndex, -1);
			assert.deepEqual(tabOrder(host), [optionsButton(host, 'a_s'), input(host, 'b_s')]);
		});

		it('stays in the tab order for a field with no control', async () => {
			const host = await renderControls({ a_s: null, b_s: enabledInput('b_s') });
			assert.equal(optionsButton(host, 'a_s').tabIndex, 0);
			assert.equal(optionsButton(host, 'b_s').tabIndex, -1);
		});

		it('stays in the tab order for a control that is only removed from the tab order', async () => {
			const host = await renderControls({
				a_s: React.createElement('input', { id: 'a_s-input', tabIndex: -1 })
			});
			assert.equal(optionsButton(host, 'a_s').tabIndex, 0);
		});

		it('opens its menu from the keyboard', async () => {
			const host = await renderControls({ a_s: disabledInput('a_s') });
			const button = optionsButton(host, 'a_s');
			await focusIn(button);
			await activate(button, 'Enter');
			assert.ok(menuOf());
			assert.equal(button.getAttribute('aria-expanded'), 'true');
		});

		it('leaves the tab order once the control becomes focusable', async () => {
			const host = await renderControls({ a_s: disabledInput('a_s') });
			assert.equal(optionsButton(host, 'a_s').tabIndex, 0);
			await mutate(() => {
				input(host, 'a_s').disabled = false;
			});
			assert.equal(optionsButton(host, 'a_s').tabIndex, -1);
		});

		it('joins the tab order once the control is disabled', async () => {
			const host = await renderControls({ a_s: enabledInput('a_s') });
			assert.equal(optionsButton(host, 'a_s').tabIndex, -1);
			await mutate(() => {
				input(host, 'a_s').disabled = true;
			});
			assert.equal(optionsButton(host, 'a_s').tabIndex, 0);
		});

		it('leaves the tab order once a focusable control is added to the field', async () => {
			const host = await renderControls({ a_s: disabledInput('a_s') });
			assert.equal(optionsButton(host, 'a_s').tabIndex, 0);
			await mutate(() => {
				const extra = document.createElement('input');
				extra.id = 'a_s-extra';
				host.querySelector('[data-field-id="a_s"]')!.appendChild(extra);
			});
			assert.equal(optionsButton(host, 'a_s').tabIndex, -1);
		});

		it('counts a button after the Options button as the way in', async () => {
			const host = await renderControls({ a_s: disabledInput('a_s') });
			const field = host.querySelector('[data-field-id="a_s"]')!;
			await mutate(() => {
				const help = document.createElement('button');
				field.appendChild(help);
			});
			assert.equal(optionsButton(host, 'a_s').tabIndex, -1);
			await focusIn(field.querySelector<HTMLElement>('button:not([aria-haspopup])')!);
			assert.equal(optionsButton(host, 'a_s').tabIndex, 0);
		});
	});
});
