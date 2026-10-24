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
 * Ace keyboard-exit behaviour (WCAG 2.1.2).
 *
 * Bundled Ace (ace-builds 1.44) implements this as `enableKeyboardAccessibility`:
 * the scroller is the tab stop, Enter moves into the textarea, Esc returns to the
 * scroller, and Tab still indents while the textarea is focused. This helper turns
 * that mode on once, then overlays localized labels and a visible hint.
 *
 * Keep in sync with `studio-ui/static-assets/js/tinymce-plugins/ace/plugin.js`.
 * The plugin cannot import this module; it carries its own copy.
 */

export const ACE_HINT_CLASS = 'craftercms-code-editor-hint';
export const ACE_HINT_STYLE_ID = 'craftercms-code-editor-hint-styles';
/** Room for a wrapped two-line hint so the last code line stays visible. */
export const ACE_HINT_SCROLL_MARGIN = 48;

export interface AceKeyboardLabels {
	instructions: string;
	gutterLabel: string;
}

const HINT_CSS = `
.${ACE_HINT_CLASS} {
	position: absolute;
	left: 0;
	right: 0;
	bottom: 0;
	z-index: 6;
	box-sizing: border-box;
	margin: 0;
	padding: 4px 8px;
	pointer-events: none;
	overflow: hidden;
	max-height: ${ACE_HINT_SCROLL_MARGIN}px;
	font-family: system-ui, -apple-system, "Segoe UI", sans-serif !important;
	font-size: 12px !important;
	font-weight: 400 !important;
	line-height: 20px !important;
	white-space: normal !important;
	background: #f4f4f5;
	color: #333333;
	border-top: 1px solid #d0d0d0;
}
.ace_editor.ace_dark > .${ACE_HINT_CLASS},
.ace_editor.ace-tomorrow-night > .${ACE_HINT_CLASS},
.ace_editor.ace-nord-dark > .${ACE_HINT_CLASS} {
	background: #252526;
	color: #e6e6e6;
	border-top-color: #3c3c3c;
}
`;

interface AceKeyboardEditor {
	container: HTMLElement;
	setOption(name: string, value: unknown): void;
	getOption(name: string): unknown;
	focus(): void;
	blur(): void;
	renderer: {
		scroller?: HTMLElement;
		$gutter?: HTMLElement;
		setScrollMargin?(top: number, bottom: number, left: number, right: number): void;
	};
	textInput?: { getElement(): HTMLTextAreaElement };
	commands: {
		addCommand(command: {
			name: string;
			bindKey: { win: string; mac: string };
			readOnly: boolean;
			exec(editor: AceKeyboardEditor): void;
		}): void;
	};
}

const applied = new WeakSet<object>();

function ensureHintStyles(doc: Document) {
	if (doc.getElementById(ACE_HINT_STYLE_ID)) {
		return;
	}
	const style = doc.createElement('style');
	style.id = ACE_HINT_STYLE_ID;
	style.textContent = HINT_CSS;
	(doc.head || doc.documentElement).appendChild(style);
}

function installLegacyExit(editor: AceKeyboardEditor, scroller: HTMLElement | undefined) {
	if (applied.has(editor)) {
		return;
	}
	applied.add(editor);
	const textInput = editor.textInput?.getElement();
	if (textInput) {
		textInput.tabIndex = -1;
	}
	if (scroller) {
		scroller.tabIndex = 0;
		scroller.setAttribute('role', 'group');
		scroller.addEventListener('keyup', (event) => {
			if (event.key === 'Enter') {
				editor.focus();
			}
		});
	}
	editor.commands.addCommand({
		name: 'crafterExitEditor',
		bindKey: { win: 'Esc', mac: 'Esc' },
		readOnly: true,
		exec(ed) {
			ed.blur();
			scroller?.focus();
		}
	});
}

/**
 * Enables Ace's tab-stop mode when the bundled build supports it, labels the
 * scroller and gutter, reserves space for a persistent hint, and stops Escape
 * from the textarea from bubbling into a surrounding dialog. Escape on the
 * scroller itself is left alone so the next Tab can leave the editor.
 */
export function applyAceKeyboardAccessibility(editor: AceAjax.Editor, labels: AceKeyboardLabels) {
	const aceEditor = editor as unknown as AceKeyboardEditor;
	const scroller = aceEditor.renderer?.scroller;
	const gutter = aceEditor.renderer?.$gutter;
	const container = aceEditor.container;

	let keyboardMode = false;
	try {
		keyboardMode = aceEditor.getOption('enableKeyboardAccessibility') === true;
		if (!keyboardMode) {
			// Set before enabling so Ace copies it onto the textarea when the mode turns on.
			aceEditor.setOption('textInputAriaLabel', labels.instructions);
			aceEditor.setOption('enableKeyboardAccessibility', true);
			keyboardMode = aceEditor.getOption('enableKeyboardAccessibility') === true;
		}
	} catch {
		keyboardMode = false;
	}
	if (!keyboardMode) {
		installLegacyExit(aceEditor, scroller);
	}

	scroller?.setAttribute('aria-label', labels.instructions);
	gutter?.setAttribute('aria-label', labels.gutterLabel);
	const textInput = aceEditor.textInput?.getElement();
	textInput?.setAttribute('aria-label', labels.instructions);
	aceEditor.renderer?.setScrollMargin?.(0, ACE_HINT_SCROLL_MARGIN, 0, 0);

	if (container) {
		ensureHintStyles(container.ownerDocument);
		let hint = container.querySelector<HTMLElement>(`:scope > .${ACE_HINT_CLASS}`);
		if (!hint) {
			hint = container.ownerDocument.createElement('div');
			hint.className = ACE_HINT_CLASS;
			// The scroller and textarea already expose the same instructions.
			hint.setAttribute('aria-hidden', 'true');
			container.appendChild(hint);
		}
		hint.textContent = labels.instructions;
		hint.title = labels.instructions;

		if (!container.dataset.craftercmsEsc) {
			container.dataset.craftercmsEsc = 'true';
			container.addEventListener('keydown', (event) => {
				if (event.key === 'Escape' && event.target !== scroller) {
					event.stopPropagation();
				}
			});
		}
	}
}
