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
 * The hint is a sibling under the Ace node, in normal flow. Do not set
 * `renderer.$extraHeight`: Ace subtracts that value again from its own cached
 * height every time the horizontal scrollbar appears or disappears, and the
 * editor collapses.
 *
 * Keep in sync with `studio-ui/static-assets/js/tinymce-plugins/ace/plugin.js`.
 */

export const ACE_HINT_CLASS = 'craftercms-code-editor-hint';
export const ACE_FRAME_CLASS = 'craftercms-code-editor-frame';
export const ACE_HINT_STYLE_ID = 'craftercms-code-editor-hint-styles';
/** Id prefix so a React editor and the TinyMCE plugin cannot share a hint id. */
const HINT_ID_PREFIX = 'craftercms-code-editor-hint-react';

export interface AceKeyboardLabels {
	/** Short accessible name. Not the instruction sentence. */
	name: string;
	instructions: string;
	instructionsReadOnly: string;
	gutterLabel: string;
}

const HINT_CSS = `
.${ACE_FRAME_CLASS} {
	display: flex;
	flex-direction: column;
	box-sizing: border-box;
	min-height: 0;
	width: 100%;
}
.${ACE_FRAME_CLASS} > .ace_editor {
	position: relative;
	flex: 1 1 auto;
	min-height: 0;
	width: 100%;
}
.${ACE_FRAME_CLASS} > .${ACE_HINT_CLASS},
.tox-dialog .${ACE_FRAME_CLASS} > .${ACE_HINT_CLASS},
.acecode-inline .${ACE_FRAME_CLASS} > .${ACE_HINT_CLASS} {
	flex: 0 0 auto;
	position: static;
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
.${ACE_FRAME_CLASS}:has(> .ace_editor.ace_dark) > .${ACE_HINT_CLASS},
.${ACE_FRAME_CLASS}:has(> .ace_editor.ace-tomorrow-night) > .${ACE_HINT_CLASS},
.${ACE_FRAME_CLASS}:has(> .ace_editor.ace-nord-dark) > .${ACE_HINT_CLASS} {
	background: #252526;
	color: #e6e6e6;
	border-top-color: #3c3c3c;
}
/* Ace's own inset shadow sits under the text layer. Draw the ring above it. */
.ace_scroller.ace_keyboard-focus:focus,
.ace_gutter.ace_keyboard-focus:focus {
	outline: none;
}
.ace_scroller.ace_keyboard-focus:focus::after,
.ace_gutter.ace_keyboard-focus:focus::after {
	content: "";
	position: absolute;
	inset: 0;
	box-sizing: border-box;
	pointer-events: none;
	z-index: 20;
	box-shadow: inset 0 0 0 2px #5E9ED6;
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

function createHintId() {
	const random =
		typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
			? crypto.randomUUID()
			: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
	return `${HINT_ID_PREFIX}-${random}`;
}

function editorAutosizes(editor: AceKeyboardEditor) {
	const maxLines = editor.getOption('maxLines');
	return typeof maxLines === 'number' && maxLines > 0;
}

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
 * Puts a column frame around the Ace node and returns it. The hint is appended
 * to the frame, under the editor, so Ace's own height math is left alone.
 * An absolutely positioned editor (Studio dialogs) keeps that fill on the frame.
 */
function ensureEditorFrame(editor: AceKeyboardEditor): HTMLElement | null {
	const container = editor.container;
	const parent = container?.parentElement;
	if (!container || !parent) {
		return container ?? null;
	}
	if (parent.classList.contains(ACE_FRAME_CLASS)) {
		return parent;
	}
	const view = container.ownerDocument.defaultView;
	const position = view?.getComputedStyle(container).position;
	const wasAbsolute = position === 'absolute' || position === 'fixed';
	const previousHeight = container.getBoundingClientRect().height;
	const frame = container.ownerDocument.createElement('div');
	frame.className = ACE_FRAME_CLASS;
	parent.insertBefore(frame, container);
	frame.appendChild(container);

	frame.style.display = 'flex';
	frame.style.flexDirection = 'column';
	frame.style.boxSizing = 'border-box';
	frame.style.minHeight = '0';
	frame.style.width = '100%';
	if (wasAbsolute) {
		frame.style.position = 'absolute';
		frame.style.top = '0';
		frame.style.right = '0';
		frame.style.bottom = '0';
		frame.style.left = '0';
	} else {
		frame.style.position = 'relative';
		frame.style.flex = '1 1 auto';
		frame.style.height = '100%';
	}

	container.style.position = 'relative';
	container.style.flex = '1 1 auto';
	container.style.minHeight = '0';
	container.style.width = '100%';
	container.style.top = 'auto';
	container.style.right = 'auto';
	container.style.bottom = 'auto';
	container.style.left = 'auto';
	// Autosize (min/max lines) writes its own pixel height. Everyone else must
	// give the remaining frame space to the editor instead of height:100% plus a hint.
	if (!editorAutosizes(editor)) {
		container.style.height = 'auto';
	}

	// If the parent has no definite height, percentage sizing collapses the editor.
	// Put the previous pixel height back on the Ace node and let the frame grow.
	view?.requestAnimationFrame(() => {
		if (!editorAutosizes(editor) && previousHeight > 24 && container.clientHeight < 24) {
			frame.style.height = 'auto';
			frame.style.flex = '0 0 auto';
			container.style.flex = '0 0 auto';
			container.style.height = `${Math.round(previousHeight)}px`;
		}
		editor.resize?.(true);
	});
	return frame;
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

	if (!container) {
		return;
	}
	const frame = ensureEditorFrame(aceEditor) ?? container;
	ensureHintStyles(container.ownerDocument);
	let hint = frame.querySelector<HTMLElement>(`:scope > .${ACE_HINT_CLASS}`);
	if (!hint) {
		hint = container.ownerDocument.createElement('div');
		hint.className = ACE_HINT_CLASS;
		hint.id = createHintId();
		frame.appendChild(hint);
	}
	hint.textContent = instructions;
	hint.removeAttribute('title');
	hint.removeAttribute('aria-hidden');
	scroller?.setAttribute('aria-describedby', hint.id);
	textInput?.setAttribute('aria-describedby', hint.id);

	if (!container.dataset.craftercmsEsc) {
		container.dataset.craftercmsEsc = 'true';
		let escFromEditor = false;
		const resetEscFlag = () => {
			escFromEditor = false;
		};
		// Capture only records the key. Stopping it here would run before Ace's own Esc command.
		// Assign on every keydown so a stale flag from a missed keyup cannot swallow the next Esc.
		container.addEventListener(
			'keydown',
			(event) => {
				if (event.key === 'Escape') {
					escFromEditor = event.target !== scroller;
				} else {
					resetEscFlag();
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
		// Esc keydown focuses the scroller before keyup. Only drop the flag when focus leaves the editor.
		container.addEventListener('focusout', (event) => {
			const next = event.relatedTarget;
			if (!(next instanceof Node) || !container.contains(next)) {
				resetEscFlag();
			}
		});
	}
	// Flush the flex layout so the first resize sees the editor height above the hint.
	frame.getBoundingClientRect();
	aceEditor.resize?.(true);
}
