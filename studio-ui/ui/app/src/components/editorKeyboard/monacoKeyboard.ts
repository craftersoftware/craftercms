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

import type Monaco from '../../models/Monaco';

/**
 * Monaco has no Ace-style keyboard-accessibility option. The frame around the
 * editor is the single tab stop (see CodeEditorFrame): Enter focuses the
 * textarea, Esc returns to the frame, and Tab still indents while editing
 * (`tabFocusMode` stays off). Ctrl+M remains Monaco's own tab-focus toggle and
 * is not the documented way out.
 *
 * `addCommand` registers at keybinding weight 1000, above Monaco's own Esc
 * handlers. The `when` clause is false while those widgets or a selection are
 * active so Esc dismisses them first. Names were checked against monaco-editor
 * 0.54. `postPasteWidgetVisible` and `hasMultipleSelections` are not keys in
 * that build (`pasteWidgetVisible` and `editorHasMultipleSelections` are).
 */

const ESCAPE_WHEN = [
	'!suggestWidgetVisible',
	'!findWidgetVisible',
	'!findInputFocussed',
	'!replaceInputFocussed',
	'!inSnippetMode',
	'!messageVisible',
	'!parameterHintsVisible',
	'!renameInputVisible',
	'!inlineSuggestionVisible',
	'!inlineEditIsVisible',
	'!markersNavigationVisible',
	'!referenceSearchVisible',
	'!dropWidgetVisible',
	'!pasteWidgetVisible',
	'!stickyScrollFocused',
	'!selectionAnchorSet',
	'!LinkedEditingInputVisible',
	'!standaloneColorPickerVisible',
	'!codeActionMenuVisible',
	'!editorHasSelection',
	'!editorHasMultipleSelections'
].join(' && ');

const ESC_BOUND = '__craftercmsEscBound';

interface MonacoCodeEditorLike {
	focus(): void;
	addCommand(keybinding: number, handler: () => void, context?: string): string | null;
	updateOptions(newOptions: { tabIndex?: number }): void;
	[ESC_BOUND]?: boolean;
}

interface MonacoDiffEditorLike {
	getOriginalEditor(): MonacoCodeEditorLike;
	getModifiedEditor(): MonacoCodeEditorLike;
}

function isDiffEditor(editor: object): editor is MonacoDiffEditorLike {
	return typeof (editor as MonacoDiffEditorLike).getModifiedEditor === 'function';
}

function codeEditorsOf(editor: object): MonacoCodeEditorLike[] {
	if (isDiffEditor(editor)) {
		return [editor.getOriginalEditor(), editor.getModifiedEditor()];
	}
	return [editor as MonacoCodeEditorLike];
}

/** Takes the textarea out of the tab order. Does not touch caller padding; the hint is outside the editor. */
export function withEditorKeyboardOptions<T extends object>(options?: T) {
	return {
		...options,
		tabIndex: -1 as const
	};
}

/**
 * Keeps each Monaco textarea out of the tab order and, once `monaco` and a frame
 * getter are provided, binds Esc to return focus to that frame.
 */
export function enforceMonacoKeyboardOptions(
	editor: object | null | undefined,
	monaco?: Monaco,
	getFrame?: () => HTMLElement | null
) {
	if (!editor) {
		return;
	}
	codeEditorsOf(editor).forEach((codeEditor) => {
		codeEditor.updateOptions({ tabIndex: -1 });
		if (monaco && getFrame && !codeEditor[ESC_BOUND]) {
			codeEditor[ESC_BOUND] = true;
			codeEditor.addCommand(monaco.KeyCode.Escape, () => getFrame()?.focus(), ESCAPE_WHEN);
		}
	});
}

/**
 * True when Enter was pressed on the frame before the editor existed and focus
 * is still on that frame. Clears the flag either way, so a user who already
 * tabbed away is not pulled back when the editor loads.
 */
export function takePendingCodeEditorEnter(frame: HTMLElement | null): boolean {
	if (!frame) {
		return false;
	}
	const pending = frame.dataset.craftercmsPendingEnter === 'true';
	delete frame.dataset.craftercmsPendingEnter;
	return pending && frame.ownerDocument.activeElement === frame;
}

export function focusMonacoEditor(editor: object | null | undefined) {
	if (!editor) {
		return;
	}
	if (isDiffEditor(editor)) {
		editor.getModifiedEditor().focus();
		return;
	}
	(editor as MonacoCodeEditorLike).focus();
}
