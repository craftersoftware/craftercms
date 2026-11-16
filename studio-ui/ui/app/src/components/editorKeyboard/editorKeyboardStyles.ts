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

import { EDITOR_KEYBOARD_FALLBACK_CSS } from './editorKeyboardFallbackCss';

/** Injected only when `tinymce-ace.css` (compiled from the SCSS partial) is not linked. */
export const EDITOR_KEYBOARD_STYLE_ID = 'craftercms-editor-keyboard-styles';

export function editorKeyboardStylesheetLinked(doc: Document): boolean {
	const links = doc.querySelectorAll('link[rel="stylesheet"]');
	for (let i = 0; i < links.length; i++) {
		const href = links[i].getAttribute('href') || '';
		if (href.indexOf('tinymce-ace.css') !== -1) {
			return true;
		}
	}
	return false;
}

/**
 * Injects the generated fallback for the SCSS keyboard rules. No-op when the
 * Studio stylesheet link is already in the document, or when this style tag is.
 */
export function ensureEditorKeyboardStyles(doc: Document | null | undefined) {
	if (!doc || doc.getElementById(EDITOR_KEYBOARD_STYLE_ID) || editorKeyboardStylesheetLinked(doc)) {
		return;
	}
	const style = doc.createElement('style');
	style.id = EDITOR_KEYBOARD_STYLE_ID;
	style.textContent = EDITOR_KEYBOARD_FALLBACK_CSS;
	(doc.head || doc.documentElement).appendChild(style);
}
