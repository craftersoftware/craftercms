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

import { defineMessages } from 'react-intl';

/**
 * Shared copy for the Ace/Monaco keyboard exit.
 * Keep the default messages aligned with the TinyMCE Ace plugin strings
 * (`code-editor-name`, `code-editor-instructions`, `code-editor-instructions-readonly`,
 * `code-editor-gutter`) and the es/de/ko catalogues.
 */
export const codeEditorKeyboardMessages = defineMessages({
	instructions: {
		id: 'codeEditor.instructions',
		defaultMessage: 'Press Esc then Tab to leave the editor. Press Enter to edit. Tab indents while editing.'
	},
	instructionsReadOnly: {
		id: 'codeEditor.instructionsReadOnly',
		defaultMessage: 'Press Esc then Tab to leave the editor. Press Enter to move into the editor.'
	},
	groupLabel: {
		id: 'codeEditor.groupLabel',
		defaultMessage: 'Code editor'
	},
	gutterLabel: {
		id: 'codeEditor.gutterLabel',
		defaultMessage: 'Editor gutter. Press Enter to use the controls. Press Esc to leave the gutter.'
	}
});
