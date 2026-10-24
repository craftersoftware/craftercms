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
 * TinyMCE keyboard and target-size adjustments (WCAG 2.1.1 / 2.5.8).
 *
 * Alt+F10 (focus toolbar) and toolbar Esc (back to the content) are implemented
 * by the bundled TinyMCE 8 silver theme. This helper does not rebind them.
 * It does stop Escape that originates in the editor chrome from also closing a
 * surrounding dialog, collapses the classic-mode iframe/body pair toward a
 * single tab stop, and widens split-button carets that the oxide skin draws at
 * 16px.
 *
 * Keep in sync with `studio-ui/static-assets/js/editor-keyboard-a11y.js` and the
 * copy in `content-type-propsheet/richText.js`. Those legacy scripts cannot
 * import this module.
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

export interface TinyMceKeyboardEditor {
	inline?: boolean;
	iframeElement?: HTMLIFrameElement | null;
	editorContainer?: HTMLElement | null;
	on(name: string, callback: () => void): void;
	off?(name: string, callback: () => void): void;
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

function collapseClassicTabStop(editor: TinyMceKeyboardEditor) {
	if (editor.inline) {
		return;
	}
	const iframe = editor.iframeElement;
	const body = editor.getBody?.();
	if (!iframe || !body) {
		return;
	}
	// One tab stop on the iframe. The content body stays out of the tab order;
	// focusing the iframe moves the caret into the body. Setting the iframe to
	// tabindex -1 would remove the editor from the page tab order entirely.
	iframe.tabIndex = 0;
	if (body.getAttribute('contenteditable') === 'true') {
		body.tabIndex = -1;
	}
}

/**
 * Idempotent. Call from a TinyMCE `setup` function, before the editor UI is shown.
 * Inline editors (Experience Builder) have no iframe pair; only the caret size
 * and chrome Escape handling apply there.
 */
export function installTinyMceKeyboard(editor: TinyMceKeyboardEditor) {
	if (installed.has(editor)) {
		return;
	}
	installed.add(editor);

	const doc = editor.getElement()?.ownerDocument ?? document;
	ensureTinyMceTargetSizeStyles(doc);

	let focusingContent = false;
	const onIframeFocus = () => {
		if (focusingContent) {
			return;
		}
		focusingContent = true;
		try {
			collapseClassicTabStop(editor);
			editor.focus();
		} finally {
			focusingContent = false;
		}
	};

	const onChromeKeyDown = (event: KeyboardEvent) => {
		if (event.key !== 'Escape') {
			return;
		}
		const body = editor.getBody?.();
		const target = event.target;
		if (body && target instanceof Node && (target === body || body.contains(target))) {
			return;
		}
		event.stopPropagation();
	};

	const roots = new Set<HTMLElement>();
	const addRoot = (root: HTMLElement | null | undefined) => {
		if (!root || roots.has(root)) {
			return;
		}
		roots.add(root);
		root.addEventListener('keydown', onChromeKeyDown);
	};

	const onInit = () => {
		collapseClassicTabStop(editor);
		editor.iframeElement?.addEventListener('focus', onIframeFocus);
		addRoot(editor.getContainer());
		addRoot(editor.editorContainer);
	};

	const onRemove = () => {
		editor.iframeElement?.removeEventListener('focus', onIframeFocus);
		roots.forEach((root) => root.removeEventListener('keydown', onChromeKeyDown));
		roots.clear();
	};

	editor.on('init', onInit);
	editor.on('remove', onRemove);
}
