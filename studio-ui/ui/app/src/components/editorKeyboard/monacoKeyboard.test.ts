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

const { enforceMonacoKeyboardOptions, focusMonacoEditor, takePendingCodeEditorEnter, withEditorKeyboardOptions } =
	await import('./monacoKeyboard.ts');

const ESCAPE = 9;
const monaco = { KeyCode: { Escape: ESCAPE } } as never;

function createCodeEditor() {
	const commands: Array<{ keybinding: number; handler: () => void; context?: string }> = [];
	const calls = { focus: 0, updateOptions: [] as object[] };
	return {
		commands,
		calls,
		focus: () => calls.focus++,
		addCommand(keybinding: number, handler: () => void, context?: string) {
			commands.push({ keybinding, handler, context });
			return 'id';
		},
		updateOptions: (options: object) => calls.updateOptions.push(options)
	};
}

function createFrame() {
	const frame = document.createElement('div');
	frame.tabIndex = 0;
	document.body.append(frame);
	return frame;
}

describe('withEditorKeyboardOptions', () => {
	it('takes the textarea out of the tab order and keeps the caller options, including padding', () => {
		const padding = { top: 4, bottom: 120 };
		assert.deepEqual(withEditorKeyboardOptions({ readOnly: true, padding }), { readOnly: true, padding, tabIndex: -1 });
		assert.deepEqual(withEditorKeyboardOptions(undefined), { tabIndex: -1 });
	});
});

describe('enforceMonacoKeyboardOptions', () => {
	it('returns focus to the frame on Esc, and only when no Monaco widget owns Esc', () => {
		const editor = createCodeEditor();
		const frame = createFrame();
		enforceMonacoKeyboardOptions(editor, monaco, () => frame);
		assert.equal(editor.commands.length, 1);
		const [command] = editor.commands;
		assert.equal(command.keybinding, ESCAPE);
		for (const clause of ['!suggestWidgetVisible', '!findWidgetVisible', '!editorHasSelection', '!inSnippetMode']) {
			assert.ok(command.context.split(' && ').includes(clause), `${clause} lets Monaco handle Esc first`);
		}
		command.handler();
		assert.equal(document.activeElement, frame);
	});

	it('binds Esc once per editor but refreshes tabIndex every call', () => {
		const editor = createCodeEditor();
		const frame = createFrame();
		enforceMonacoKeyboardOptions(editor, monaco, () => frame);
		enforceMonacoKeyboardOptions(editor, monaco, () => frame);
		enforceMonacoKeyboardOptions(editor);
		assert.equal(editor.commands.length, 1);
		assert.deepEqual(editor.calls.updateOptions, [{ tabIndex: -1 }, { tabIndex: -1 }, { tabIndex: -1 }]);
	});

	it('covers both sides of a diff editor', () => {
		const original = createCodeEditor();
		const modified = createCodeEditor();
		const frame = createFrame();
		const diff = { getOriginalEditor: () => original, getModifiedEditor: () => modified };
		enforceMonacoKeyboardOptions(diff, monaco, () => frame);
		assert.equal(original.commands.length, 1);
		assert.equal(modified.commands.length, 1);
		focusMonacoEditor(diff);
		assert.equal(modified.calls.focus, 1);
		assert.equal(original.calls.focus, 0);
	});
});

describe('takePendingCodeEditorEnter', () => {
	it('is true once when Enter was pressed early and focus is still on the frame', () => {
		const frame = createFrame();
		frame.focus();
		frame.dataset.craftercmsPendingEnter = 'true';
		assert.equal(takePendingCodeEditorEnter(frame), true);
		assert.equal(takePendingCodeEditorEnter(frame), false);
	});

	it('is false, and clears the flag, when focus already moved on', () => {
		const frame = createFrame();
		frame.dataset.craftercmsPendingEnter = 'true';
		document.body.focus();
		assert.equal(takePendingCodeEditorEnter(frame), false);
		assert.equal(frame.dataset.craftercmsPendingEnter, undefined);
		assert.equal(takePendingCodeEditorEnter(null), false);
	});
});
