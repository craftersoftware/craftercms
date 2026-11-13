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

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createRequire } from 'node:module';

const { applyAceKeyboardAccessibility } = await import('./aceKeyboard.ts');

const labels = {
	name: 'Code editor',
	instructions: 'Press Esc then Tab to leave.',
	instructionsReadOnly: 'Press Enter to move in.',
	gutterLabel: 'Editor gutter'
};

const require = createRequire(import.meta.url);
const ace = require('ace-builds/src-noconflict/ace.js');
// The mode registers Ace's HTML fold rules, which is what makes a fold widget render.
require('ace-builds/src-noconflict/mode-html.js');

/** The real Ace build, with a real error annotation and a real fold. Jsdom has no layout, so the gutter is rendered by hand. */
function createAnnotatedAce() {
	const container = document.createElement('div');
	document.body.append(container);
	const editor = ace.edit(container);
	editor.session.setMode('ace/mode/html');
	editor.setValue('<div>\n  <p>hello</p>\n</div>\n<div>\n  <p>two</p>\n</div>\n', 1);
	editor.session.setAnnotations([{ row: 0, column: 2, text: 'Unclosed tag', type: 'error' }]);
	editor.session.addFold('...', new ace.Range(0, 0, 2, 0));
	applyAceKeyboardAccessibility(editor, labels);
	// Jsdom reports zero size, so Ace never renders a gutter row. Feed the layer a fixed geometry.
	editor.renderer.$gutterLayer.update({
		firstRow: 0,
		lastRow: 4,
		gutterOffset: 0,
		lineHeight: 16,
		characterWidth: 8,
		height: 80,
		scrollTop: 0
	} as never);
	return {
		editor,
		container,
		gutter: container.querySelector<HTMLElement>('.ace_gutter'),
		scroller: container.querySelector<HTMLElement>('.ace_scroller'),
		annotation: container.querySelector<HTMLElement>('.ace_gutter_annotation'),
		foldWidget: container.querySelector<HTMLElement>('.ace_fold-widget')
	};
}

describe('Ace gutter semantics with real annotations and folding', () => {
	let aceEditor: ReturnType<typeof createAnnotatedAce>;

	before(() => {
		aceEditor = createAnnotatedAce();
	});

	after(() => {
		aceEditor.editor.destroy();
		aceEditor.container.remove();
	});

	it('renders a labelled error annotation and a labelled fold widget', () => {
		assert.ok(aceEditor.annotation, 'Ace renders the annotation the session holds');
		assert.equal(aceEditor.annotation.getAttribute('role'), 'button');
		assert.match(aceEditor.annotation.getAttribute('aria-label'), /^Error, read annotations row 1$/);
		assert.ok(aceEditor.foldWidget, 'Ace renders the fold widget');
		assert.equal(aceEditor.foldWidget.getAttribute('role'), 'button');
		assert.match(aceEditor.foldWidget.getAttribute('aria-label'), /^Toggle code folding, rows 1 through 3$/);
		assert.equal(aceEditor.foldWidget.getAttribute('aria-expanded'), 'false');
	});

	it('keeps the gutter and its controls exposed, out of the Tab order only', () => {
		// A11Y-09 counts tab stops, so the gutter is not one...
		assert.equal(aceEditor.gutter.tabIndex, -1);
		// ...but its role, its name and its annotation/fold subtree stay in the accessibility tree.
		assert.notEqual(aceEditor.gutter.getAttribute('aria-hidden'), 'true');
		assert.equal(aceEditor.gutter.getAttribute('role'), 'group');
		assert.equal(aceEditor.gutter.getAttribute('aria-label'), labels.gutterLabel);
		assert.equal(aceEditor.annotation.closest('[aria-hidden="true"]'), null);
		assert.equal(aceEditor.foldWidget.closest('[aria-hidden="true"]'), null);
	});

	it('has exactly one reachable Tab stop, the scroller, and the hint points at it', () => {
		// Ace leaves tabindex=0 on the hidden annotation/fold nodes, so count what a browser can reach.
		const stops = [...aceEditor.container.querySelectorAll<HTMLElement>('*')].filter(
			(element) => element.tabIndex >= 0 && getComputedStyle(element).display !== 'none'
		);
		assert.deepEqual(
			stops.map((element) => element.className),
			['ace_scroller ace_keyboard-focus']
		);
		const hint = aceEditor.container.querySelector(`#${aceEditor.scroller.getAttribute('aria-describedby')}`);
		assert.equal(hint.textContent, labels.instructions);
	});

	it('reaches the annotation and the fold from the keyboard through Ace commands', () => {
		// The route the gutter label documents. Ace's error marker ext is bundled with ace.js.
		aceEditor.editor.gotoLine(5, 0);
		aceEditor.editor.execCommand('goToNextError');
		assert.deepEqual({ ...aceEditor.editor.getCursorPosition() }, { row: 0, column: 2 });

		const foldsBefore = aceEditor.editor.session.getAllFolds().length;
		aceEditor.editor.execCommand('toggleFoldWidget');
		assert.equal(aceEditor.editor.session.getAllFolds().length, foldsBefore + 1);
	});
});
