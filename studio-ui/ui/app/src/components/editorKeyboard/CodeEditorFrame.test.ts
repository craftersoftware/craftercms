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

const React = await import('react');
const { createRoot } = await import('react-dom/client');
const { act } = await import('react');
const { IntlProvider } = await import('react-intl');
const { CodeEditorFrame } = await import('./CodeEditorFrame.tsx');
const { codeEditorKeyboardMessages } = await import('./messages.ts');

function render(props: { onActivate(): boolean; readOnly?: boolean; onParentKeyDown?(key: string): void }) {
	const host = document.createElement('div');
	// React handles events at its root, so an ancestor of the root sees what React let through.
	const outer = document.createElement('div');
	outer.addEventListener('keydown', (event) => props.onParentKeyDown?.(event.key));
	document.body.append(outer);
	outer.append(host);
	const root = createRoot(host);
	act(() => {
		root.render(
			React.createElement(
				IntlProvider,
				{ locale: 'en' },
				React.createElement(
					CodeEditorFrame,
					{ frameRef: null, onActivate: props.onActivate, readOnly: props.readOnly },
					React.createElement('textarea')
				)
			)
		);
	});
	const frame = host.querySelector<HTMLElement>('[role="group"]');
	const inner = host.querySelector('textarea');
	return { host, frame, inner };
}

function press(target: Element, key: string) {
	const event = new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
	act(() => {
		target.dispatchEvent(event);
	});
	return event;
}

describe('CodeEditorFrame', () => {
	it('is one tab stop named "Code editor" and described by the exit instruction', () => {
		const { frame, host } = render({ onActivate: () => true });
		assert.equal(frame.tabIndex, 0);
		assert.equal(frame.getAttribute('aria-label'), codeEditorKeyboardMessages.groupLabel.defaultMessage);
		const hint = document.getElementById(frame.getAttribute('aria-describedby'));
		assert.equal(hint.textContent, codeEditorKeyboardMessages.instructions.defaultMessage);
		assert.ok(hint.parentElement === frame, 'hint stays in the DOM so aria-describedby resolves');
	});

	it('describes a read-only editor with the read-only sentence', () => {
		const { frame, host } = render({ onActivate: () => true, readOnly: true });
		const hint = document.getElementById(frame.getAttribute('aria-describedby'));
		assert.equal(hint.textContent, codeEditorKeyboardMessages.instructionsReadOnly.defaultMessage);
	});

	it('moves into the editor on Enter on the frame', () => {
		let activated = 0;
		const { frame } = render({
			onActivate: () => {
				activated++;
				return true;
			}
		});
		const event = press(frame, 'Enter');
		assert.equal(activated, 1);
		assert.equal(event.defaultPrevented, true);
		assert.equal(frame.dataset.craftercmsPendingEnter, undefined);
	});

	it('remembers an Enter pressed before the editor exists', () => {
		const { frame } = render({ onActivate: () => false });
		press(frame, 'Enter');
		assert.equal(frame.dataset.craftercmsPendingEnter, 'true');
	});

	it('does not activate on Enter typed inside the editor', () => {
		let activated = 0;
		const { inner } = render({
			onActivate: () => {
				activated++;
				return true;
			}
		});
		press(inner, 'Enter');
		assert.equal(activated, 0);
	});

	it('keeps Esc from the editor inside the frame, but lets Esc on the frame bubble', () => {
		const reached: string[] = [];
		const { frame, inner } = render({ onActivate: () => true, onParentKeyDown: (key) => reached.push(key) });
		press(inner, 'Escape');
		assert.deepEqual(reached, [], 'Esc inside the editor must not close a surrounding dialog');
		press(frame, 'Escape');
		assert.deepEqual(reached, ['Escape'], 'Esc on the frame still closes the dialog');
	});

	it('does not trap Tab', () => {
		const reached: string[] = [];
		const { frame } = render({ onActivate: () => true, onParentKeyDown: (key) => reached.push(key) });
		const event = press(frame, 'Tab');
		assert.equal(event.defaultPrevented, false);
		assert.deepEqual(reached, ['Tab']);
	});
});
