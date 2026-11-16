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
import { afterEach, describe, it } from 'node:test';
import { createRequire } from 'node:module';

const { applyAceKeyboardAccessibility } = await import('./aceKeyboard.ts');
const { codeEditorKeyboardMessages } = await import('./messages.ts');
const { createIntl, createIntlCache } = await import('react-intl');

const require = createRequire(import.meta.url);
const ace = require('ace-builds/src-noconflict/ace.js');
// The mode registers Ace's HTML fold rules, which is what makes a fold widget render.
require('ace-builds/src-noconflict/mode-html.js');

const labels = {
	name: 'Code editor',
	instructions: 'Press Esc then Tab to leave.',
	instructionsReadOnly: 'Press Enter to move in.',
	gutterLabel:
		'From the editor, {next} goes to the next problem, {previous} to the previous, and {fold} toggles a fold.'
};

const SOURCE = '<div>\n  <p>a</p>\n</div>\n<div>\n  <p>b</p>\n</div>\n';

/** A real Ace on the requested platform. `useragent.isMac` is what Ace reads to pick `commands.platform`. */
function createAce(mac: boolean) {
	const useragent = ace.require('ace/lib/useragent');
	useragent.isMac = mac;
	const container = document.createElement('div');
	document.body.append(container);
	const editor = ace.edit(container);
	editor.session.setMode('ace/mode/html');
	editor.setValue(SOURCE, 1);
	editor.session.setAnnotations([{ row: 3, column: 0, text: 'Bad tag', type: 'error' }]);
	editor.gotoLine(1, 0);
	editor.textInput.getElement().focus();
	applyAceKeyboardAccessibility(editor, labels);
	return { editor, container, gutter: container.querySelector<HTMLElement>('.ace_gutter') };
}

const created: Array<ReturnType<typeof createAce>> = [];
function open(mac: boolean) {
	const ace = createAce(mac);
	created.push(ace);
	return ace;
}

afterEach(() => {
	created.splice(0).forEach(({ editor, container }) => {
		editor.destroy();
		container.remove();
	});
	ace.require('ace/lib/useragent').isMac = false;
});

/** Dispatches a real key event at Ace's text input, as a browser would; Ace maps keyCode + modifiers itself. */
function pressKey(target: HTMLElement, init: KeyboardEventInit) {
	const event = new window.KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
	target.dispatchEvent(event);
	return event;
}

describe('Ace gutter label names the keys the bundled Ace binds', () => {
	it('on Windows and Linux: Alt+E, Alt+Shift+E and F2', () => {
		const { gutter } = open(false);
		assert.equal(
			gutter.getAttribute('aria-label'),
			'From the editor, Alt+E goes to the next problem, Alt+Shift+E to the previous, and F2 toggles a fold.'
		);
	});

	it('on macOS: F4, Shift+F4 and F2', () => {
		const { gutter } = open(true);
		assert.equal(
			gutter.getAttribute('aria-label'),
			'From the editor, F4 goes to the next problem, Shift+F4 to the previous, and F2 toggles a fold.'
		);
	});

	it('follows the command manager rather than a hard-coded platform', () => {
		const { editor, gutter } = open(false);
		// Rebinding a command must change the sentence on the next apply.
		editor.commands.commandKeyBinding['ctrl-alt-e'] = { name: 'goToNextError' };
		delete editor.commands.commandKeyBinding['alt-e'];
		applyAceKeyboardAccessibility(editor, labels);
		assert.match(gutter.getAttribute('aria-label'), /^From the editor, Ctrl\+Alt\+E goes to the next problem/);
	});
});

describe('the React copy of the gutter sentence', () => {
	it('keeps the {next} / {previous} / {fold} slots literal so the helper can fill them', () => {
		const intl = createIntl({ locale: 'en', messages: {} }, createIntlCache());
		const text = intl.formatMessage(codeEditorKeyboardMessages.gutterLabel);
		// ICU would read an unescaped {next} as a variable and fall back to the message id.
		assert.match(text, /\{next\}/);
		assert.match(text, /\{previous\}/);
		assert.match(text, /\{fold\}/);
		assert.doesNotMatch(text, /codeEditor\.gutterLabel/);
	});

	it('fills the slots with the platform keys in the editor', () => {
		const { gutter } = open(true);
		const text = gutter.getAttribute('aria-label');
		assert.doesNotMatch(text, /\{next\}|\{previous\}|\{fold\}/);
		assert.match(text, /F4 goes to the next problem, Shift\+F4 to the previous, and F2 toggles a fold\./);
	});
});

describe('Ace gutter label matches the keys that really work', () => {
	it('on Windows and Linux: Alt+E and Alt+Shift+E move between annotations, F2 folds', () => {
		const { editor } = open(false);
		const input = editor.textInput.getElement();

		pressKey(input, { key: 'e', code: 'KeyE', keyCode: 69, altKey: true });
		assert.equal(editor.getCursorPosition().row, 3, 'Alt+E moved to the annotated row');
		pressKey(input, { key: 'E', code: 'KeyE', keyCode: 69, altKey: true, shiftKey: true });
		assert.equal(editor.getCursorPosition().row, 3, 'nothing above, so Alt+Shift+E stays put');

		editor.gotoLine(1, 0);
		pressKey(input, { key: 'F2', keyCode: 113 });
		assert.equal(editor.session.getAllFolds().length, 1, 'F2 folded the block');
	});

	it('on macOS: F4 and Shift+F4 move between annotations, F2 folds', () => {
		const { editor } = open(true);
		const input = editor.textInput.getElement();

		pressKey(input, { key: 'F4', keyCode: 115 });
		assert.equal(editor.getCursorPosition().row, 3, 'F4 moved to the annotated row');

		// Two annotations, cursor below both: Shift+F4 must land on the last one at or before the cursor.
		editor.setValue(Array.from({ length: 12 }, (_, i) => `<p>line ${i}</p>`).join('\n'), 1);
		editor.session.setAnnotations([
			{ row: 1, column: 0, text: 'First', type: 'error' },
			{ row: 5, column: 0, text: 'Second', type: 'warning' }
		]);
		editor.gotoLine(10, 0);
		pressKey(input, { key: 'F4', keyCode: 115, shiftKey: true });
		assert.equal(editor.getCursorPosition().row, 5, 'Shift+F4 went back to the earlier annotation');

		editor.gotoLine(1, 0);
		pressKey(input, { key: 'F2', keyCode: 113 });
		assert.equal(editor.session.getAllFolds().length, 1, 'F2 folded the block');
	});
});
