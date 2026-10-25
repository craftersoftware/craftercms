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
 * TinyMCE chrome keyboard and caret target-size adjustments.
 *
 * This is the only implementation. The React forms engine imports it. Legacy
 * pages cannot import the app bundle, so `yarn build:editor-keyboard` writes
 * `static-assets/js/editor-keyboard-a11y.js` as a classic script that assigns
 * `window.craftercmsEditorKeyboard.installTinyMceKeyboard`. Do not copy this
 * function into another file.
 *
 * Classic editors are left on TinyMCE's own tab stop. Forcing the content body
 * to tabindex -1 stops keyboard users from typing in Chrome: Tab focuses the
 * iframe's content window and never fires `focus` on the `<iframe>`, so a
 * follow-up `editor.focus()` never runs.
 *
 * Alt+F10 / Alt+F9 are TinyMCE shortcuts. In 8.9.2, menubar Esc calls
 * `editor.focus()` and toolbar Esc does not. This helper focuses the content
 * on toolbar Esc and stops menubar and toolbar Esc from also dismissing a
 * parent dialog. Content Esc is left alone (the guest inline editor uses it
 * to cancel editing).
 *
 * Target-size rules live in `ui/scss/src/_editor-keyboard.scss` and are injected
 * here only when that stylesheet is not linked.
 */

import { ensureEditorKeyboardStyles } from './editorKeyboardStyles';

const MENUBAR_SELECTOR = '.tox-menubar';
const TOOLBAR_SELECTOR = '.tox-toolbar, .tox-toolbar-overlord, .tox-toolbar__overflow';

export interface TinyMceKeyboardEditor {
	inline?: boolean;
	initialized?: boolean;
	editorContainer?: HTMLElement | null;
	on(name: string, callback: () => void): void;
	getElement(): HTMLElement | null;
	getBody(): HTMLElement | null;
	getContainer(): HTMLElement | null;
	focus(): void;
}

declare global {
	interface Window {
		craftercmsEditorKeyboard?: {
			installTinyMceKeyboard: (editor: TinyMceKeyboardEditor) => void;
		};
	}
}

const installed = new WeakSet<object>();

function isIn(target: EventTarget | null, selector: string) {
	return target instanceof Element && Boolean(target.closest(selector));
}

/**
 * Idempotent. Call from a TinyMCE `setup` function. Does not change the iframe
 * or body tabindex.
 */
export function installTinyMceKeyboard(editor: TinyMceKeyboardEditor) {
	if (!editor || installed.has(editor)) {
		return;
	}
	installed.add(editor);

	const doc = editor.getElement()?.ownerDocument ?? document;
	ensureEditorKeyboardStyles(doc);

	const onChromeKey = (event: KeyboardEvent) => {
		if (event.key !== 'Escape') {
			return;
		}
		const body = editor.getBody?.();
		const target = event.target;
		if (body && target instanceof Node && (target === body || body.contains(target))) {
			return;
		}
		const inMenubar = isIn(target, MENUBAR_SELECTOR);
		const inToolbar = isIn(target, TOOLBAR_SELECTOR);
		if (!inMenubar && !inToolbar) {
			return;
		}
		// Toolbar Esc does not return to the content in TinyMCE 8.9.2. Menubar Esc does.
		if (event.type === 'keydown' && inToolbar && !inMenubar) {
			editor.focus();
		}
		event.stopPropagation();
	};

	const roots = new Set<HTMLElement>();
	const addRoot = (root: HTMLElement | null | undefined) => {
		if (!root || roots.has(root)) {
			return;
		}
		roots.add(root);
		root.addEventListener('keydown', onChromeKey);
		root.addEventListener('keyup', onChromeKey);
	};

	const onInit = () => {
		addRoot(editor.getContainer());
		addRoot(editor.editorContainer);
	};

	const onRemove = () => {
		roots.forEach((root) => {
			root.removeEventListener('keydown', onChromeKey);
			root.removeEventListener('keyup', onChromeKey);
		});
		roots.clear();
	};

	editor.on('init', onInit);
	editor.on('remove', onRemove);
	// A late call (script loaded after init) still has to attach the chrome listeners.
	if (editor.initialized) {
		onInit();
	}
}

if (typeof window !== 'undefined') {
	window.craftercmsEditorKeyboard = window.craftercmsEditorKeyboard || {
		installTinyMceKeyboard
	};
	window.craftercmsEditorKeyboard.installTinyMceKeyboard = installTinyMceKeyboard;
}
