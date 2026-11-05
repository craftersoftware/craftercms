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
 * Escape dismisses a real MUI Tooltip without closing the dialog around it, and only that tooltip's own
 * trigger brings it back. Uses MUI's actual Tooltip, Dialog and timers rather than stand-in nodes, so the
 * lifecycle it asserts is the one users get.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

// The shared DOM setup does not expose ShadowRoot, and MUI's Modal feature-detects it while mounting.
Object.defineProperty(globalThis, 'ShadowRoot', { value: window.ShadowRoot, configurable: true, writable: true });

// MUI Tooltip opens on focus only when the target matches `:focus-visible`, which jsdom cannot evaluate.
// Teach it the one selector it asks about, so keyboard-opened tooltips behave as they do in a browser.
const nativeMatches = Element.prototype.matches;
Element.prototype.matches = function matches(selector: string) {
	if (selector === ':focus-visible') return this === this.ownerDocument.activeElement;
	return nativeMatches.call(this, selector);
};

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { default: Tooltip } = await import('@mui/material/Tooltip');
const { default: Button } = await import('@mui/material/Button');
const { default: Dialog } = await import('@mui/material/Dialog');
const { default: DialogTitle } = await import('@mui/material/DialogTitle');
const { installTooltipEscapeHandler } = await import('./tooltipEscape.ts');

const mounted: Array<{ root: ReturnType<typeof createRoot>; container: HTMLElement; uninstall(): void }> = [];

afterEach(async () => {
	for (const { root, container, uninstall } of mounted.splice(0)) {
		await act(async () => root.unmount());
		uninstall();
		container.remove();
	}
});

const wait = (ms: number) => act(async () => new Promise((resolve) => setTimeout(resolve, ms)));

/**
 * Moves the pointer, sending both events a browser sends: `pointerover`/`pointerout` for our capture
 * listeners, and `mouseover`/`mouseout`, which is what React's `onMouseOver`/`onMouseLeave` bind to.
 */
const pointer = async (target: Element, type: 'pointerover' | 'pointerout', relatedTarget?: Element) => {
	const mouseType = type === 'pointerover' ? 'mouseover' : 'mouseout';
	await act(async () => {
		for (const name of [type, mouseType]) {
			target.dispatchEvent(new window.MouseEvent(name, { bubbles: true, relatedTarget: relatedTarget ?? null }));
		}
	});
};

interface SceneOptions {
	/** Open a MUI Dialog around the tooltip trigger, to prove Escape does not leak. */
	inDialog?: boolean;
}

/** A toolbar button with a real MUI Tooltip, plus an unrelated button, optionally inside a Dialog. */
async function mountScene({ inDialog = false }: SceneOptions = {}) {
	const container = document.createElement('div');
	document.body.appendChild(container);
	const root = createRoot(container);
	const onDialogClose = [];
	const scene = React.createElement(
		'div',
		null,
		React.createElement(Button, { id: 'unrelated' }, 'Unrelated'),
		React.createElement(
			Tooltip,
			{ title: 'Save your work', enterDelay: 0, leaveDelay: 200 },
			React.createElement(Button, { id: 'trigger' }, 'Save')
		),
		React.createElement(Button, { id: 'other-trigger' }, 'Another')
	);
	await act(async () => {
		root.render(
			inDialog
				? React.createElement(
						Dialog,
						{ open: true, onClose: () => onDialogClose.push(true) },
						React.createElement(DialogTitle, null, 'Dialog'),
						scene
					)
				: scene
		);
	});
	const uninstall = installTooltipEscapeHandler(document);
	mounted.push({ root, container, uninstall });
	return { onDialogClose };
}

const popper = () => document.querySelector<HTMLElement>('.MuiTooltip-popper');
const tooltipIsShown = () => Boolean(popper()) && getComputedStyle(popper()).display !== 'none';
const trigger = () => document.getElementById('trigger');
const unrelated = () => document.getElementById('unrelated');

/** Opens the tooltip the way MUI does: a real pointerover on the trigger, then its enterDelay timer. */
async function hover(target: Element) {
	await pointer(target, 'pointerover');
	await wait(60);
}

async function pressEscape(target: Element = document.body) {
	let prevented = false;
	await act(async () => {
		const event = new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
		target.dispatchEvent(event);
		prevented = event.defaultPrevented;
	});
	return prevented;
}

describe('Escape dismissal of a MUI Tooltip', () => {
	it('shows on hover, so the dismissal below is measured against a real open tooltip', async () => {
		await mountScene();
		assert.equal(tooltipIsShown(), false);
		await hover(trigger());
		assert.equal(tooltipIsShown(), true);
	});

	it('Escape dismisses the tooltip and unrelated activity does not revive it', async () => {
		await mountScene();
		await hover(trigger());
		assert.equal(tooltipIsShown(), true);

		assert.equal(await pressEscape(), true, 'Escape is swallowed so the dialog behind stays open');
		assert.equal(tooltipIsShown(), false, 'Escape hides the tooltip');

		// Unrelated pointer and focus activity must leave the dismissal alone.
		await pointer(unrelated(), 'pointerover');
		await wait(50);
		assert.equal(tooltipIsShown(), false, 'an unrelated pointerover does not revive it');

		await act(async () => unrelated().focus());
		await wait(50);
		assert.equal(tooltipIsShown(), false, 'an unrelated focusin does not revive it');

		// The trigger is still focused/hovered from before, so MUI still considers this tooltip open.
		await wait(400);
		assert.equal(tooltipIsShown(), false, 'and it stays dismissed while time passes');
	});

	it('leaving and re-entering the trigger shows the tooltip again', async () => {
		await mountScene();
		await hover(trigger());
		await pressEscape();
		assert.equal(tooltipIsShown(), false);

		// Pointer leaves the trigger and comes back before MUI's leaveDelay elapses.
		await pointer(trigger(), 'pointerout', document.body);
		await pointer(unrelated(), 'pointerover');
		assert.equal(tooltipIsShown(), false, 'still hidden while the pointer is away');
		await pointer(trigger(), 'pointerover');
		await wait(60);
		assert.equal(tooltipIsShown(), true, 're-entry on the trigger shows it again');
	});

	it('keyboard focus leaving and returning the trigger shows the tooltip again', async () => {
		await mountScene();
		await act(async () => trigger().focus());
		await wait(60);
		assert.equal(tooltipIsShown(), true);
		await pressEscape();
		assert.equal(tooltipIsShown(), false);

		await act(async () => unrelated().focus());
		await wait(50);
		assert.equal(tooltipIsShown(), false);
		await act(async () => trigger().focus());
		await wait(60);
		assert.equal(tooltipIsShown(), true, 'focus returning to the trigger shows it again');
	});

	it('the pointer can rest on the tooltip and it stays open', async () => {
		await mountScene();
		await hover(trigger());
		assert.equal(tooltipIsShown(), true);

		// MUI keeps an interactive tooltip open when the pointer moves onto the popper itself.
		await pointer(popper().firstElementChild ?? popper(), 'pointerover');
		await wait(300);
		assert.equal(tooltipIsShown(), true, 'moving onto the tooltip keeps it open (WCAG 1.4.13)');
	});

	it('Escape does not close the dialog containing the tooltip on the first press', async () => {
		const { onDialogClose } = await mountScene({ inDialog: true });
		await hover(trigger());
		assert.equal(tooltipIsShown(), true);

		assert.equal(await pressEscape(), true);
		assert.equal(tooltipIsShown(), false);
		await wait(100);
		assert.deepEqual(onDialogClose, [], 'the first Escape stopped at the tooltip');

		// The next Escape is not the tooltip's, so it reaches the dialog.
		assert.equal(await pressEscape(document.querySelector('.MuiDialog-container') ?? document.body), false);
		await wait(100);
		assert.equal(onDialogClose.length, 1, 'the second Escape closes the dialog');
	});
});
