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
 * Keep in sync with `studio-ui/static-assets/js/editor-keyboard-a11y.js` and the
 * fallback in `content-type-propsheet/richText.js`.
 */

export const TINYMCE_TARGET_SIZE_STYLE_ID = 'craftercms-tinymce-target-size';

/**
 * Oxide skin (tinymce 8.9): `.tox-tbtn` is 34×28. `.tox-split-button__chevron`
 * is its own 16×28 button (20px in the touch rule). Select/listbox chevrons are
 * 16px wide inside a larger control; they are widened with the split caret so
 * the visible target matches. `!important` beats the skin stylesheet TinyMCE
 * injects when the editor loads, including `.tox.tox-platform-touch`.
 */
export const TINYMCE_TARGET_SIZE_CSS = `
.tox .tox-split-button__chevron,
.tox.tox-platform-touch .tox-split-button__chevron,
.tox .tox-tbtn__select-chevron,
.tox .tox-listbox__select-chevron {
	width: 24px !important;
	min-width: 24px !important;
}
`;

const MENUBAR_SELECTOR = '.tox-menubar';
const TOOLBAR_SELECTOR = '.tox-toolbar, .tox-toolbar-overlord, .tox-toolbar__overflow';

export interface TinyMceKeyboardEditor {
	inline?: boolean;
	editorContainer?: HTMLElement | null;
	on(name: string, callback: () => void): void;
	getElement(): HTMLElement | null;
	getBody(): HTMLElement | null;
	getContainer(): HTMLElement | null;
	focus(): void;
}

const installed = new WeakSet<object>();

export function ensureTinyMceTargetSizeStyles(doc: Document | null | undefined) {
	if (!doc || doc.getElementById(TINYMCE_TARGET_SIZE_STYLE_ID)) {
		return;
	}
	const style = doc.createElement('style');
	style.id = TINYMCE_TARGET_SIZE_STYLE_ID;
	style.textContent = TINYMCE_TARGET_SIZE_CSS;
	(doc.head || doc.documentElement).appendChild(style);
}

function isIn(target: EventTarget | null, selector: string) {
	return target instanceof Element && Boolean(target.closest(selector));
}

/**
 * Idempotent. Call from a TinyMCE `setup` function. Does not change the iframe
 * or body tabindex.
 */
export function installTinyMceKeyboard(editor: TinyMceKeyboardEditor) {
	if (installed.has(editor)) {
		return;
	}
	installed.add(editor);

	const doc = editor.getElement()?.ownerDocument ?? document;
	ensureTinyMceTargetSizeStyles(doc);

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
}
