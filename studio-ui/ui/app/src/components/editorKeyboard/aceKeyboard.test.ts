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

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const { applyAceKeyboardAccessibility } = await import('./aceKeyboard.ts');

const labels = {
	name: 'Code editor',
	instructions: 'Press Esc then Tab to leave.',
	instructionsReadOnly: 'Press Enter to move in.',
	gutterLabel: 'Editor gutter'
};

/**
 * Just enough of Ace for the helper. `supportsKeyboardMode: false` models a build whose
 * `enableKeyboardAccessibility` option is unknown, which selects the legacy exit.
 */
function createFakeAce(options: { supportsKeyboardMode?: boolean; readOnly?: boolean } = {}) {
	const { supportsKeyboardMode = true, readOnly = false } = options;
	const container = document.createElement('div');
	const gutter = document.createElement('div');
	const scroller = document.createElement('div');
	const textarea = document.createElement('textarea');
	container.append(gutter, scroller, textarea);
	document.body.append(container);
	const values: Record<string, unknown> = { readOnly };
	const commands: Array<{ name: string; exec(editor: unknown): void }> = [];
	const calls = { blur: 0, focus: 0 };
	const editor = {
		container,
		renderer: { scroller, $gutter: gutter },
		textInput: { getElement: () => textarea },
		setOption(name: string, value: unknown) {
			if (name === 'enableKeyboardAccessibility' && !supportsKeyboardMode) return;
			values[name] = value;
		},
		getOption: (name: string) => values[name],
		focus() {
			calls.focus++;
			textarea.focus();
		},
		blur() {
			calls.blur++;
			textarea.blur();
		},
		commands: { addCommand: (command: (typeof commands)[number]) => commands.push(command) }
	};
	return {
		editor: editor as unknown as AceAjax.Editor,
		container,
		gutter,
		scroller,
		textarea,
		values,
		commands,
		calls
	};
}

function key(type: 'keydown' | 'keyup', init: KeyboardEventInit) {
	return new window.KeyboardEvent(type, { bubbles: true, cancelable: true, ...init });
}

/** Records which Escape events reach an ancestor, as a dialog's close handler would. */
function watchAncestor(container: HTMLElement) {
	const seen: string[] = [];
	const handler = (event: Event) => {
		if ((event as KeyboardEvent).key === 'Escape') seen.push(event.type);
	};
	container.parentElement.addEventListener('keydown', handler);
	container.parentElement.addEventListener('keyup', handler);
	return seen;
}

describe('applyAceKeyboardAccessibility labels', () => {
	it('enables keyboard mode, names the tab stops and points them at one hint', () => {
		const ace = createFakeAce();
		applyAceKeyboardAccessibility(ace.editor, labels);
		const hint = ace.container.querySelector<HTMLElement>(':scope > .craftercms-code-editor-hint');
		assert.ok(hint, 'hint is the last child of the Ace node');
		assert.equal(hint.textContent, labels.instructions);
		assert.equal(ace.values.enableKeyboardAccessibility, true);
		assert.equal(ace.values.textInputAriaLabel, labels.name);
		assert.equal(ace.scroller.getAttribute('aria-label'), labels.name);
		assert.equal(ace.gutter.getAttribute('aria-label'), labels.gutterLabel);
		assert.equal(ace.textarea.getAttribute('aria-label'), labels.name);
		assert.equal(ace.scroller.getAttribute('aria-describedby'), hint.id);
		assert.equal(ace.textarea.getAttribute('aria-describedby'), hint.id);
		assert.equal(hint.hasAttribute('aria-hidden'), false);
		// A11Y-09: one tab stop per editor. The gutter stays reachable from code, not by Tab.
		assert.equal(ace.gutter.tabIndex, -1);
		assert.equal(ace.gutter.getAttribute('aria-hidden'), 'true');
	});

	it('uses the read-only sentence for a read-only editor', () => {
		const ace = createFakeAce({ readOnly: true });
		applyAceKeyboardAccessibility(ace.editor, labels);
		assert.equal(ace.container.querySelector('.craftercms-code-editor-hint').textContent, labels.instructionsReadOnly);
	});

	it('re-applies a new locale without a second hint, and refreshes Ace source label', () => {
		const ace = createFakeAce();
		applyAceKeyboardAccessibility(ace.editor, labels);
		const [hint] = ace.container.querySelectorAll('.craftercms-code-editor-hint');
		const next = { ...labels, name: 'Editor de código', instructions: 'Pulse Esc y Tab.' };
		applyAceKeyboardAccessibility(ace.editor, next);
		const hints = ace.container.querySelectorAll('.craftercms-code-editor-hint');
		assert.equal(hints.length, 1);
		assert.equal(hints[0], hint);
		assert.equal(hint.textContent, next.instructions);
		// Ace rebuilds the textarea label from textInputAriaLabel on focus, so that option must follow the locale.
		assert.equal(ace.values.textInputAriaLabel, next.name);
		assert.equal(ace.scroller.getAttribute('aria-label'), next.name);
	});

	it('picks up a direct readOnly change on the next focusin', () => {
		const ace = createFakeAce();
		applyAceKeyboardAccessibility(ace.editor, labels);
		const hint = ace.container.querySelector('.craftercms-code-editor-hint');
		ace.values.readOnly = true;
		ace.container.dispatchEvent(new window.FocusEvent('focusin', { bubbles: true }));
		assert.equal(hint.textContent, labels.instructionsReadOnly);
	});

	it('gives two editors different hint ids', () => {
		const a = createFakeAce();
		const b = createFakeAce();
		applyAceKeyboardAccessibility(a.editor, labels);
		applyAceKeyboardAccessibility(b.editor, labels);
		assert.notEqual(
			a.container.querySelector('.craftercms-code-editor-hint').id,
			b.container.querySelector('.craftercms-code-editor-hint').id
		);
	});
});

describe('applyAceKeyboardAccessibility legacy exit', () => {
	it('is not installed when Ace provides keyboard mode', () => {
		const ace = createFakeAce();
		applyAceKeyboardAccessibility(ace.editor, labels);
		assert.equal(ace.commands.length, 0);
	});

	it('makes the scroller the tab stop and binds Esc to return to it', () => {
		const ace = createFakeAce({ supportsKeyboardMode: false });
		applyAceKeyboardAccessibility(ace.editor, labels);
		applyAceKeyboardAccessibility(ace.editor, labels);
		assert.equal(ace.scroller.tabIndex, 0);
		assert.equal(ace.textarea.tabIndex, -1);
		assert.equal(ace.commands.length, 1, 'installed once');
		ace.textarea.focus();
		ace.commands[0].exec(ace.editor);
		assert.equal(ace.calls.blur, 1);
		assert.equal(document.activeElement, ace.scroller);
		ace.scroller.dispatchEvent(key('keyup', { key: 'Enter' }));
		assert.equal(ace.calls.focus, 1, 'Enter moves back into the editor');
	});
});

describe('applyAceKeyboardAccessibility Escape handling', () => {
	function setup() {
		const ace = createFakeAce();
		const wrapper = document.createElement('div');
		ace.container.replaceWith(wrapper);
		wrapper.append(ace.container);
		applyAceKeyboardAccessibility(ace.editor, labels);
		return { ...ace, seen: watchAncestor(ace.container) };
	}

	it('keeps Escape from the textarea, keydown and keyup, from closing a dialog', () => {
		const { textarea, scroller, seen } = setup();
		textarea.dispatchEvent(key('keydown', { key: 'Escape' }));
		// Ace moves focus to the scroller on keydown, so the keyup lands there.
		scroller.dispatchEvent(key('keyup', { key: 'Escape' }));
		assert.deepEqual(seen, []);
	});

	it('stops auto-repeated Escape on the scroller until keyup', () => {
		const { textarea, scroller, seen } = setup();
		textarea.dispatchEvent(key('keydown', { key: 'Escape' }));
		scroller.dispatchEvent(key('keydown', { key: 'Escape', repeat: true }));
		scroller.dispatchEvent(key('keyup', { key: 'Escape' }));
		assert.deepEqual(seen, []);
	});

	it('lets a fresh Escape on the scroller reach the dialog', () => {
		const { textarea, scroller, seen } = setup();
		textarea.dispatchEvent(key('keydown', { key: 'Escape' }));
		scroller.dispatchEvent(key('keyup', { key: 'Escape' }));
		scroller.dispatchEvent(key('keydown', { key: 'Escape' }));
		scroller.dispatchEvent(key('keyup', { key: 'Escape' }));
		assert.deepEqual(seen, ['keydown', 'keyup']);
	});

	it('does not touch other keys', () => {
		const { textarea, seen } = setup();
		const tabs: string[] = [];
		textarea.parentElement.parentElement.addEventListener('keydown', (event) => tabs.push(event.key));
		textarea.dispatchEvent(key('keydown', { key: 'Tab' }));
		textarea.dispatchEvent(key('keyup', { key: 'Tab' }));
		assert.deepEqual(tabs, ['Tab']);
		assert.deepEqual(seen, []);
	});
});
