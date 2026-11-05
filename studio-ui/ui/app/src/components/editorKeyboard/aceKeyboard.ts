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
 * The hint is the `aria-describedby` target of the scroller and the textarea. It is
 * the last child of the Ace node, visually hidden until the scroller or gutter has focus
 * (see `_editor-keyboard.scss`), and positioned over the editor edge so the editor
 * height never changes.
 *
 * The TinyMCE Ace plugin bundles this module (`yarn build:editor-keyboard`).
 * Do not copy the frame, hint, or Escape logic into plugin.js.
 */

import { ensureEditorKeyboardStyles } from './editorKeyboardStyles';

const ACE_HINT_CLASS = 'craftercms-code-editor-hint';
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
	ensureEditorKeyboardStyles(container.ownerDocument);
	let hint = container.querySelector<HTMLElement>(`:scope > .${ACE_HINT_CLASS}`);
	if (!hint) {
		hint = container.ownerDocument.createElement('div');
		hint.className = ACE_HINT_CLASS;
		hint.id = createHintId(labels.hintIdPrefix || HINT_ID_PREFIX);
		container.appendChild(hint);
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
}
