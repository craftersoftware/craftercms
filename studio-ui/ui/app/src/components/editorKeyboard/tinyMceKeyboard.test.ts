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
import { describe, it } from 'node:test';

const { installTinyMceKeyboard } = await import('./tinyMceKeyboard.ts');

function createFakeTinyMce(options: { initialized?: boolean } = {}) {
	const container = document.createElement('div');
	container.innerHTML =
		'<div class="tox-menubar"><button id="menu"></button></div>' +
		'<div class="tox-toolbar"><button id="tool"></button></div>' +
		'<div class="tox-edit-area"><div id="body"></div></div>';
	document.body.append(container);
	const handlers: Record<string, Array<() => void>> = {};
	let focused = 0;
	const editor = {
		initialized: options.initialized ?? false,
		on: (name: string, callback: () => void) => (handlers[name] ??= []).push(callback),
		getElement: () => null,
		getBody: () => container.querySelector<HTMLElement>('#body'),
		getContainer: () => container,
		focus: () => focused++
	};
	return {
		editor,
		container,
		fire: (name: string) => handlers[name]?.forEach((callback) => callback()),
		focusCount: () => focused,
		escape(selector: string, type: 'keydown' | 'keyup' = 'keydown') {
			const target = container.querySelector(selector);
			const reached: string[] = [];
			const spy = (event: Event) => reached.push(event.type);
			document.body.addEventListener(type, spy);
			target.dispatchEvent(new window.KeyboardEvent(type, { key: 'Escape', bubbles: true, cancelable: true }));
			document.body.removeEventListener(type, spy);
			return reached;
		}
	};
}

describe('installTinyMceKeyboard', () => {
	it('returns focus to the content on toolbar Esc and keeps the parent dialog open', () => {
		const tiny = createFakeTinyMce();
		installTinyMceKeyboard(tiny.editor);
		tiny.fire('init');
		assert.deepEqual(tiny.escape('#tool'), []);
		assert.equal(tiny.focusCount(), 1);
		assert.deepEqual(tiny.escape('#tool', 'keyup'), []);
		assert.equal(tiny.focusCount(), 1, 'keyup does not refocus');
	});

	it('keeps menubar Esc from closing the dialog without refocusing (TinyMCE already does)', () => {
		const tiny = createFakeTinyMce();
		installTinyMceKeyboard(tiny.editor);
		tiny.fire('init');
		assert.deepEqual(tiny.escape('#menu'), []);
		assert.equal(tiny.focusCount(), 0);
	});

	it('leaves Esc in the content alone', () => {
		const tiny = createFakeTinyMce();
		installTinyMceKeyboard(tiny.editor);
		tiny.fire('init');
		assert.deepEqual(tiny.escape('#body'), ['keydown']);
		assert.equal(tiny.focusCount(), 0);
	});

	it('attaches immediately when the editor is already initialized, and only once', () => {
		const tiny = createFakeTinyMce({ initialized: true });
		installTinyMceKeyboard(tiny.editor);
		installTinyMceKeyboard(tiny.editor);
		assert.deepEqual(tiny.escape('#tool'), []);
		assert.equal(tiny.focusCount(), 1);
	});

	it('detaches on remove', () => {
		const tiny = createFakeTinyMce();
		installTinyMceKeyboard(tiny.editor);
		tiny.fire('init');
		tiny.fire('remove');
		assert.deepEqual(tiny.escape('#tool'), ['keydown']);
		assert.equal(tiny.focusCount(), 0);
	});

	it('does not set window globals when imported', () => {
		assert.equal('craftercmsEditorKeyboard' in window, false);
	});
});
