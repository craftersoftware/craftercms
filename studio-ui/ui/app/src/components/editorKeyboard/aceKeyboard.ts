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
 * The TinyMCE Ace plugin bundles this module (`yarn build:editor-keyboard`).
 * Do not copy the frame, hint, or Escape logic into plugin.js.
 */

import { ensureEditorKeyboardStyles } from './editorKeyboardStyles';

export const ACE_HINT_CLASS = 'craftercms-code-editor-hint';
export const ACE_FRAME_CLASS = 'craftercms-code-editor-frame';
/** Id prefix so a React editor and the TinyMCE plugin cannot share a hint id. */
const HINT_ID_PREFIX = 'craftercms-code-editor-hint';

export interface AceKeyboardLabels {
	/** Short accessible name. Not the instruction sentence. */
	name: string;
	instructions: string;
	instructionsReadOnly: string;
	gutterLabel: string;
	/** Defaults to `craftercms-code-editor-hint`. The plugin uses its own prefix. */
	hintIdPrefix?: string;
}

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

const hintState = new WeakMap<
	HTMLElement,
	{ editor: AceKeyboardEditor; labels: AceKeyboardLabels; hint: HTMLElement }
>();

/** Ace emits no option event, so a direct setReadOnly() is picked up on the next focus. */
function refreshHintText(container: HTMLElement) {
	const state = hintState.get(container);
	if (!state) {
		return;
	}
	const text =
		state.editor.getOption('readOnly') === true ? state.labels.instructionsReadOnly : state.labels.instructions;
	if (state.hint.textContent !== text) {
		state.hint.textContent = text;
	}
}

function createHintId(prefix: string) {
	const random =
		typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
			? crypto.randomUUID()
			: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
	return `${prefix}-${random}`;
}

function editorAutosizes(editor: AceKeyboardEditor) {
	const maxLines = editor.getOption('maxLines');
	return typeof maxLines === 'number' && maxLines > 0;
}

/** True when the Ace node is shorter than its parent, so a caller set an explicit height. */
function keepsCallerHeight(previousHeight: number, parent: HTMLElement, view: Window | null | undefined) {
	if (!(previousHeight > 24) || !view) {
		return false;
	}
	// AceEditor's root element is display: contents, so measure the nearest ancestor that has a box.
	let box: HTMLElement | null = parent;
	while (box && view.getComputedStyle(box).display === 'contents') {
		box = box.parentElement;
	}
	if (!box) {
		return false;
	}
	const style = view.getComputedStyle(box);
	const padding = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
	const parentHeight = box.clientHeight - padding;
	return parentHeight > previousHeight + 1;
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
 * React renders the frame itself; this still sizes that frame on the first call.
 */
function ensureEditorFrame(editor: AceKeyboardEditor): HTMLElement | null {
	const container = editor.container;
	const parent = container?.parentElement;
	if (!container || !parent) {
		return container ?? null;
	}
	ensureEditorKeyboardStyles(container.ownerDocument);
	const alreadyFramed = parent.classList.contains(ACE_FRAME_CLASS);
	if (alreadyFramed && parent.dataset.craftercmsFrameSized === 'true') {
		return parent;
	}
	const view = container.ownerDocument.defaultView;
	const position = view?.getComputedStyle(container).position;
	const wasAbsolute = position === 'absolute' || position === 'fixed';
	// A frame that is already in the document can flex-grow the editor before we
	// read the caller height. Pin flex so the used height is the caller's.
	if (alreadyFramed) {
		container.style.flex = '0 0 auto';
	}
	const previousHeight = container.getBoundingClientRect().height;
	const layoutParent = alreadyFramed ? (parent.parentElement ?? parent) : parent;
	const explicitHeight = !editorAutosizes(editor) && keepsCallerHeight(previousHeight, layoutParent, view);
	let frame: HTMLElement;
	if (alreadyFramed) {
		frame = parent;
	} else {
		frame = container.ownerDocument.createElement('div');
		frame.className = ACE_FRAME_CLASS;
		parent.insertBefore(frame, container);
		frame.appendChild(container);
	}

	if (explicitHeight) {
		// Keep a caller pixel height (for example sxs.editorRoot height: 300px). The hint sits under it.
		frame.style.flex = '0 0 auto';
		frame.style.height = 'auto';
	} else if (wasAbsolute) {
		frame.style.position = 'absolute';
		frame.style.top = '0';
		frame.style.right = '0';
		frame.style.bottom = '0';
		frame.style.left = '0';
	} else {
		frame.style.height = '100%';
	}

	container.style.position = 'relative';
	container.style.minHeight = '0';
	container.style.minWidth = '0';
	container.style.width = '100%';
	container.style.top = 'auto';
	container.style.right = 'auto';
	container.style.bottom = 'auto';
	container.style.left = 'auto';
	if (explicitHeight) {
		container.style.flex = '0 0 auto';
		container.style.height = `${Math.round(previousHeight)}px`;
	} else if (!editorAutosizes(editor)) {
		// Fill the frame. height:auto beats a stylesheet height:100% that would stack with the hint.
		container.style.flex = '1 1 auto';
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
	frame.dataset.craftercmsFrameSized = 'true';
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

	let keyboardMode: boolean;
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
	let hint = frame.querySelector<HTMLElement>(`:scope > .${ACE_HINT_CLASS}`);
	if (!hint) {
		hint = container.ownerDocument.createElement('div');
		hint.className = ACE_HINT_CLASS;
		hint.id = createHintId(labels.hintIdPrefix || HINT_ID_PREFIX);
		frame.appendChild(hint);
	} else if (!hint.id) {
		hint.id = createHintId(labels.hintIdPrefix || HINT_ID_PREFIX);
	}
	hint.textContent = instructions;
	hint.removeAttribute('title');
	hint.removeAttribute('aria-hidden');
	scroller?.setAttribute('aria-describedby', hint.id);
	textInput?.setAttribute('aria-describedby', hint.id);

	hintState.set(container, { editor: aceEditor, labels, hint });

	if (!container.dataset.craftercmsEsc) {
		container.dataset.craftercmsEsc = 'true';
		container.addEventListener('focusin', () => refreshHintText(container));
		let escFromEditor = false;
		const resetEscFlag = () => {
			escFromEditor = false;
		};
		// Capture only records the key. Stopping it here would run before Ace's own Esc command.
		// A fresh keydown reassigns the flag. Ignore repeats: after the first Esc, focus is on the
		// scroller, and a repeat keydown there would clear the flag before keyup.
		container.addEventListener(
			'keydown',
			(event) => {
				if (event.key === 'Escape') {
					if (!event.repeat) {
						escFromEditor = event.target !== scroller;
					}
				} else {
					resetEscFlag();
				}
			},
			true
		);
		container.addEventListener('keydown', (event) => {
			if (event.key !== 'Escape') {
				return;
			}
			// Repeats follow the first Esc onto the scroller and would reach a dialog
			// that closes on keydown before keyup. A later non-repeat Esc on the scroller still bubbles.
			if (event.target !== scroller || (event.repeat && escFromEditor)) {
				event.stopPropagation();
			}
		});
		container.addEventListener('keyup', (event) => {
			if (event.key === 'Escape' && escFromEditor) {
				escFromEditor = false;
				event.stopPropagation();
			}
		});
		// Ace blurs the textarea before focusing the scroller, and that focusout has a null
		// relatedTarget. Wait until the focus move finishes, then drop the flag only if focus left.
		container.addEventListener('focusout', () => {
			container.ownerDocument.defaultView?.setTimeout(() => {
				if (!container.contains(container.ownerDocument.activeElement)) {
					resetEscFlag();
				}
			}, 0);
		});
	}
	// Flush the flex layout so the first resize sees the editor height above the hint.
	frame.getBoundingClientRect();
	aceEditor.resize?.(true);
}
