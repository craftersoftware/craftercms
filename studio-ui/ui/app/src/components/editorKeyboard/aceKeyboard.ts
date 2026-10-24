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
 * that mode on once, then overlays a short accessible name, a described-by hint,
 * and localized gutter text.
 *
 * TinyMCE dialogs close on Escape keyup. Ace moves focus to the scroller on
 * keydown, so the keyup lands on the scroller and would close the code dialog.
 * A capture keydown flag plus a keyup stopPropagation keeps that dialog open.
 * Keydown from the textarea is also stopped in the bubble phase so an MUI
 * dialog does not close. Escape on the scroller itself still bubbles.
 *
 * Keep in sync with `studio-ui/static-assets/js/tinymce-plugins/ace/plugin.js`.
 */

export const ACE_HINT_CLASS = 'craftercms-code-editor-hint';
export const ACE_HINT_STYLE_ID = 'craftercms-code-editor-hint-styles';

export interface AceKeyboardLabels {
	/** Short accessible name. Not the instruction sentence. */
	name: string;
	instructions: string;
	instructionsReadOnly: string;
	gutterLabel: string;
}

const HINT_CSS = `
.ace_editor > .${ACE_HINT_CLASS},
.tox-dialog .ace_editor > .${ACE_HINT_CLASS},
.acecode-inline .ace_editor > .${ACE_HINT_CLASS} {
	position: absolute;
	left: 0;
	right: 0;
	bottom: 0;
	z-index: 6;
	box-sizing: border-box;
	margin: 0;
	padding: 4px 8px;
	pointer-events: none;
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
	resize?(force?: boolean): void;
	setOption(name: string, value: unknown): void;
	getOption(name: string): unknown;
	focus(): void;
	blur(): void;
	renderer: {
		scroller?: HTMLElement;
		$gutter?: HTMLElement;
		$extraHeight?: number;
		scrollBarH?: { getHeight(): number; element?: HTMLElement };
		scrollBarV?: { element?: HTMLElement };
		setScrollMargin?(top: number, bottom: number, left: number, right: number): void;
		on?(name: string, callback: () => void): void;
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
let hintSequence = 0;

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

function pinAceHintInset(renderer: AceKeyboardEditor['renderer'], hintHeight: number) {
	const bar = renderer.scrollBarH?.getHeight?.() ?? 0;
	const bottom = `${hintHeight + bar}px`;
	if (renderer.scroller) {
		renderer.scroller.style.bottom = bottom;
	}
	if (renderer.$gutter) {
		renderer.$gutter.style.bottom = `${hintHeight}px`;
	}
	if (renderer.scrollBarH?.element) {
		renderer.scrollBarH.element.style.bottom = `${hintHeight}px`;
	}
	if (renderer.scrollBarV?.element) {
		renderer.scrollBarV.element.style.bottom = bottom;
	}
}

/** Shrinks the Ace scroller to the measured hint so the hint is not clipped and does not cover the scrollbar. */
function syncAceHintInset(editor: AceKeyboardEditor, hint: HTMLElement) {
	const renderer = editor.renderer;
	if (!renderer) {
		return;
	}
	const hintHeight = Math.ceil(hint.getBoundingClientRect().height);
	if (!hintHeight) {
		return;
	}
	if (renderer.$extraHeight !== hintHeight) {
		renderer.$extraHeight = hintHeight;
		editor.resize?.(true);
	}
	pinAceHintInset(renderer, hintHeight);
}

/**
 * Enables Ace's tab-stop mode when the bundled build supports it, labels the
 * scroller with a short name plus the hint, and keeps Escape from the textarea
 * from closing a surrounding dialog (including TinyMCE, which listens on keyup).
 */
export function applyAceKeyboardAccessibility(editor: AceAjax.Editor, labels: AceKeyboardLabels) {
	const aceEditor = editor as unknown as AceKeyboardEditor;
	const scroller = aceEditor.renderer?.scroller;
	const gutter = aceEditor.renderer?.$gutter;
	const container = aceEditor.container;
	const readOnly = aceEditor.getOption('readOnly') === true;
	const instructions = readOnly ? labels.instructionsReadOnly : labels.instructions;

	let keyboardMode = false;
	try {
		// Refresh on every apply so a locale change updates the textarea label Ace rebuilds on focus.
		aceEditor.setOption('textInputAriaLabel', labels.name);
		keyboardMode = aceEditor.getOption('enableKeyboardAccessibility') === true;
		if (!keyboardMode) {
			aceEditor.setOption('enableKeyboardAccessibility', true);
			keyboardMode = aceEditor.getOption('enableKeyboardAccessibility') === true;
		}
	} catch {
		keyboardMode = false;
	}
	if (!keyboardMode) {
		installLegacyExit(aceEditor, scroller);
	}

	scroller?.setAttribute('aria-label', labels.name);
	gutter?.setAttribute('aria-label', labels.gutterLabel);
	const textInput = aceEditor.textInput?.getElement();
	textInput?.setAttribute('aria-label', labels.name);
	// Drop a fixed scroll margin; the measured hint inset reserves the space instead.
	aceEditor.renderer?.setScrollMargin?.(0, 0, 0, 0);

	if (!container) {
		return;
	}
	ensureHintStyles(container.ownerDocument);
	let hint = container.querySelector<HTMLElement>(`:scope > .${ACE_HINT_CLASS}`);
	if (!hint) {
		hint = container.ownerDocument.createElement('div');
		hint.className = ACE_HINT_CLASS;
		hint.id = `${ACE_HINT_CLASS}-${++hintSequence}`;
		container.appendChild(hint);
	}
	hint.textContent = instructions;
	hint.removeAttribute('title');
	hint.removeAttribute('aria-hidden');
	scroller?.setAttribute('aria-describedby', hint.id);
	textInput?.setAttribute('aria-describedby', hint.id);

	if (!container.dataset.craftercmsEsc) {
		container.dataset.craftercmsEsc = 'true';
		let escFromEditor = false;
		// Capture only records the key. Stopping it here would run before Ace's own Esc command.
		container.addEventListener(
			'keydown',
			(event) => {
				if (event.key === 'Escape' && event.target !== scroller) {
					escFromEditor = true;
				}
			},
			true
		);
		container.addEventListener('keydown', (event) => {
			if (event.key === 'Escape' && event.target !== scroller) {
				event.stopPropagation();
			}
		});
		container.addEventListener('keyup', (event) => {
			if (event.key === 'Escape' && escFromEditor) {
				escFromEditor = false;
				event.stopPropagation();
			}
		});
	}

	if (!container.dataset.craftercmsHintInset) {
		container.dataset.craftercmsHintInset = 'true';
		aceEditor.renderer?.on?.('resize', () => {
			const current = container.querySelector<HTMLElement>(`:scope > .${ACE_HINT_CLASS}`);
			if (current) {
				pinAceHintInset(aceEditor.renderer, Math.ceil(current.getBoundingClientRect().height));
			}
		});
		if (typeof ResizeObserver !== 'undefined') {
			const observer = new ResizeObserver(() => syncAceHintInset(aceEditor, hint));
			observer.observe(hint);
		}
	}
	syncAceHintInset(aceEditor, hint);
}
