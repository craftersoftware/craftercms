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
 * Escape dismisses a real MUI Tooltip without closing the dialog around it. Ownership comes from the
 * tooltip, never from whatever happens to be focused, and every dismissal is tracked on its own.
 * Uses MUI's actual Tooltip, Dialog and timers so the lifecycle asserted here is the one users get.
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
	inDialog?: boolean;
	/** A second tooltip whose trigger stays mounted. */
	withSecondTooltip?: boolean;
	/** The second tooltip is controlled with `open`, so both poppers stay mounted at once. */
	controlled?: boolean;
	/** Leave the Escape handler to the caller, so a test can own its install and removal. */
	installHandler?: boolean;
}

/**
 * A real toolbar: an unrelated input (to hold focus), an unrelated button, and one or two tooltips.
 * String titles are the case where MUI gives the trigger no ARIA reference at all.
 */
async function mountScene({
	inDialog = false,
	withSecondTooltip = false,
	controlled = false,
	installHandler = true
}: SceneOptions = {}) {
	const container = document.createElement('div');
	document.body.appendChild(container);
	const root = createRoot(container);
	const onDialogClose = [];
	const tooltip = (id: string, label: string, title: string, open?: boolean) =>
		React.createElement(
			Tooltip,
			{ key: id, title, enterDelay: 0, leaveDelay: 200, ...(open === undefined ? {} : { open }) },
			React.createElement(Button, { id }, label)
		);
	const scene = React.createElement(
		'div',
		null,
		React.createElement('input', { id: 'unrelated-input', 'aria-label': 'Unrelated field' }),
		React.createElement(Button, { id: 'unrelated' }, 'Unrelated'),
		tooltip('trigger', 'Save', 'Save your work'),
		withSecondTooltip ? tooltip('second-trigger', 'Publish', 'Publish it', controlled ? false : undefined) : null,
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
	const uninstall = installHandler ? installTooltipEscapeHandler(document) : () => undefined;
	mounted.push({ root, container, uninstall });
	return { onDialogClose, root };
}

/** The popper showing the given tooltip text, if it is showing. */
const popperFor = (text: string) => {
	const tooltips = [...document.querySelectorAll<HTMLElement>('.MuiTooltip-tooltip')];
	const tip = tooltips.find((node) => node.textContent?.trim() === text);
	const popper = tip?.closest<HTMLElement>('.MuiTooltip-popper') ?? null;
	return popper && getComputedStyle(popper).display !== 'none' ? popper : null;
};
const isShown = (text: string) => popperFor(text) !== null;
const trigger = () => document.getElementById('trigger');
const unrelated = () => document.getElementById('unrelated');
const input = () => document.getElementById('unrelated-input');

/** Opens a tooltip the way MUI does: a real pointerover on the trigger, then its enterDelay timer. */
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
		assert.equal(isShown('Save your work'), false);
		await hover(trigger());
		assert.equal(isShown('Save your work'), true);
	});

	it('Escape dismisses the tooltip and unrelated activity does not revive it', async () => {
		await mountScene();
		await hover(trigger());
		assert.equal(isShown('Save your work'), true);

		assert.equal(await pressEscape(), true, 'Escape is swallowed so the dialog behind stays open');
		assert.equal(isShown('Save your work'), false, 'Escape hides the tooltip');

		await pointer(unrelated(), 'pointerover');
		await wait(50);
		assert.equal(isShown('Save your work'), false, 'an unrelated pointerover does not revive it');

		await act(async () => unrelated().focus());
		await wait(50);
		assert.equal(isShown('Save your work'), false, 'an unrelated focusin does not revive it');

		await wait(400);
		assert.equal(isShown('Save your work'), false, 'and it stays dismissed while time passes');
	});

	it('leaving and re-entering the trigger shows the tooltip again', async () => {
		await mountScene();
		await hover(trigger());
		await pressEscape();
		assert.equal(isShown('Save your work'), false);

		await pointer(trigger(), 'pointerout', document.body);
		await pointer(unrelated(), 'pointerover');
		assert.equal(isShown('Save your work'), false, 'still hidden while the pointer is away');
		await pointer(trigger(), 'pointerover');
		await wait(60);
		assert.equal(isShown('Save your work'), true, 're-entry on the trigger shows it again');
	});

	it('keyboard focus leaving and returning the trigger shows the tooltip again', async () => {
		await mountScene();
		await act(async () => trigger().focus());
		await wait(60);
		assert.equal(isShown('Save your work'), true);
		await pressEscape();
		assert.equal(isShown('Save your work'), false);

		await act(async () => unrelated().focus());
		await wait(50);
		assert.equal(isShown('Save your work'), false);
		await act(async () => trigger().focus());
		await wait(60);
		assert.equal(isShown('Save your work'), true, 'focus returning to the trigger shows it again');
	});

	it('the pointer can rest on the tooltip and it stays open', async () => {
		await mountScene();
		await hover(trigger());
		const popper = popperFor('Save your work');
		assert.ok(popper);

		// MUI keeps an interactive tooltip open when the pointer moves onto the popper itself.
		await pointer(popper.firstElementChild ?? popper, 'pointerover');
		await wait(300);
		assert.equal(isShown('Save your work'), true, 'moving onto the tooltip keeps it open (WCAG 1.4.13)');
	});

	it('Escape does not close the dialog containing the tooltip on the first press', async () => {
		const { onDialogClose } = await mountScene({ inDialog: true });
		await hover(trigger());
		assert.equal(isShown('Save your work'), true);

		assert.equal(await pressEscape(), true);
		assert.equal(isShown('Save your work'), false);
		await wait(100);
		assert.deepEqual(onDialogClose, [], 'the first Escape stopped at the tooltip');

		assert.equal(await pressEscape(document.querySelector('.MuiDialog-container') ?? document.body), false);
		await wait(100);
		assert.equal(onDialogClose.length, 1, 'the second Escape closes the dialog');
	});
});

describe('tooltip ownership', () => {
	it('a hovered tooltip belongs to its trigger, not to the unrelated focused control', async () => {
		await mountScene();
		// An input holds focus while a different, string-titled tooltip is hovered.
		await act(async () => input().focus());
		await hover(trigger());
		assert.equal(isShown('Save your work'), true);

		assert.equal(await pressEscape(), true);
		assert.equal(isShown('Save your work'), false);

		// Returning focus to the unrelated input must not restore it.
		await act(async () => unrelated().focus());
		await act(async () => input().focus());
		await wait(100);
		assert.equal(isShown('Save your work'), false, 'the unrelated input is not the owner');

		// Leaving and re-entering the real trigger stays within the cancelled leaveDelay, where MUI keeps
		// the tooltip open, so this is the case the owner must get right.
		await pointer(trigger(), 'pointerout', document.body);
		await pointer(unrelated(), 'pointerover');
		assert.equal(isShown('Save your work'), false, 'still dismissed while the pointer is away');
		await pointer(trigger(), 'pointerover');
		await wait(60);
		assert.equal(isShown('Save your work'), true, 'the hovered trigger is the owner');
	});

	it('Escape pressed while the pointer rests on the popper still records the trigger as owner', async () => {
		await mountScene();
		await hover(trigger());
		const popper = popperFor('Save your work');
		await pointer(popper.firstElementChild ?? popper, 'pointerover');
		await wait(100);

		await pressEscape();
		assert.equal(isShown('Save your work'), false);

		// The popper is not the owner, so leaving it and coming back is not a re-entry.
		await pointer(popper.firstElementChild ?? popper, 'pointerout', document.body);
		await pointer(popper.firstElementChild ?? popper, 'pointerover');
		await wait(80);
		assert.equal(isShown('Save your work'), false, 'the popper never becomes the owner');

		await pointer(trigger(), 'pointerout', document.body);
		await pointer(trigger(), 'pointerover');
		await wait(60);
		assert.equal(isShown('Save your work'), true, 'the trigger restores it');
	});

	it('focus entering the popper is not treated as a trigger re-entry', async () => {
		await mountScene();
		await hover(trigger());
		const popper = popperFor('Save your work');
		await pressEscape();
		assert.equal(isShown('Save your work'), false);

		// Focus cannot normally reach the popper, but a focusable child (a link in a rich title) can.
		await act(async () => (popper as HTMLElement).focus?.());
		await wait(80);
		assert.equal(isShown('Save your work'), false, 'focus inside the popper does not restore it');
	});

	it('a non-string title is owned through the reference MUI puts on the trigger', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const root = createRoot(container);
		await act(async () => {
			root.render(
				React.createElement(
					'div',
					null,
					React.createElement(
						Tooltip,
						{ title: React.createElement('span', null, 'Rich title'), enterDelay: 0, leaveDelay: 200 },
						React.createElement(Button, { id: 'rich-trigger' }, 'Rich')
					),
					React.createElement(Button, { id: 'rich-unrelated' }, 'Elsewhere')
				)
			);
		});
		const uninstall = installTooltipEscapeHandler(document);
		mounted.push({ root, container, uninstall });

		const richTrigger = document.getElementById('rich-trigger');
		await hover(richTrigger);
		const popper = popperFor('Rich title');
		assert.ok(popper);
		// MUI points the trigger at the popper id, which is what ownership reads.
		assert.equal(richTrigger.getAttribute('aria-labelledby'), popper.id);

		await pressEscape();
		assert.equal(isShown('Rich title'), false);
		await act(async () => document.getElementById('rich-unrelated').focus());
		await wait(60);
		assert.equal(isShown('Rich title'), false, 'an unrelated control does not own it');

		await pointer(richTrigger, 'pointerout', document.body);
		await pointer(richTrigger, 'pointerover');
		await wait(80);
		assert.equal(isShown('Rich title'), true, 'the referenced trigger restores it');
	});
});

describe('independent dismissals', () => {
	it('dismissing a second tooltip keeps the first one dismissed and restorable', async () => {
		await mountScene({ withSecondTooltip: true });
		const first = document.getElementById('trigger');
		const second = document.getElementById('second-trigger');

		await hover(first);
		assert.equal(isShown('Save your work'), true);
		await pressEscape();
		assert.equal(isShown('Save your work'), false);

		// The pointer leaves the first trigger, so it is eligible to be restored, but nothing comes back yet.
		await pointer(first, 'pointerout', document.body);
		await wait(250);

		await hover(second);
		assert.equal(isShown('Publish it'), true);
		await pressEscape();
		assert.equal(isShown('Publish it'), false);

		// The first record survived the second dismissal.
		await pointer(second, 'pointerout', document.body);
		await pointer(first, 'pointerover');
		await wait(80);
		assert.equal(isShown('Save your work'), true, 'the first dismissal is still tracked');

		// And the second is restorable on its own trigger.
		await pointer(first, 'pointerout', document.body);
		await pointer(second, 'pointerover');
		await wait(80);
		assert.equal(isShown('Publish it'), true, 'the second dismissal is still tracked');
	});

	it('a controlled tooltip that stays mounted is not left hidden after its close and reopen', async () => {
		// `open={false}` keeps the popper mounted, which is when an inline hide could survive a reopen.
		const { root } = await mountScene({ withSecondTooltip: true, controlled: true });
		const controlledButton = () => document.getElementById('second-trigger');

		// Not open while `open` is false, so there is nothing to dismiss yet.
		assert.equal(isShown('Publish it'), false);

		await act(async () => {
			root.render(
				React.createElement(
					'div',
					null,
					React.createElement('input', { id: 'unrelated-input', 'aria-label': 'Unrelated field' }),
					React.createElement(Button, { id: 'unrelated' }, 'Unrelated'),
					React.createElement(
						Tooltip,
						{ title: 'Save your work', enterDelay: 0, leaveDelay: 200 },
						React.createElement(Button, { id: 'trigger' }, 'Save')
					),
					React.createElement(
						Tooltip,
						{ title: 'Publish it', enterDelay: 0, leaveDelay: 200, open: true },
						React.createElement(Button, { id: 'second-trigger' }, 'Publish')
					),
					React.createElement(Button, { id: 'other-trigger' }, 'Another')
				)
			);
		});
		await wait(60);
		assert.equal(isShown('Publish it'), true);
		assert.ok(controlledButton());
		// A controlled tooltip has no MUI-owned open event to observe, so the pointer records ownership.
		await pointer(controlledButton(), 'pointerover');
		await wait(40);

		// Escape dismisses the controlled tooltip; MUI still considers it open, so the popper stays mounted.
		await pressEscape();
		assert.equal(isShown('Publish it'), false);
		await wait(300);
		assert.equal(isShown('Publish it'), false, 'and stays dismissed while it is still open');

		// A real trigger interaction restores it, so an inline hide does not outlive a legit reopen.
		await pointer(controlledButton(), 'pointerout', document.body);
		await pointer(unrelated(), 'pointerover');
		assert.equal(isShown('Publish it'), false, 'unrelated activity does not restore it');
		await pointer(controlledButton(), 'pointerover');
		await wait(80);
		assert.equal(isShown('Publish it'), true, 'the controlled tooltip is visible again');
	});
});

describe('teardown', () => {
	it('uninstalling removes every document listener it added', async () => {
		// This scene leaves the handler to the test, so the listener set belongs to one install.
		await mountScene({ installHandler: false });

		const added: string[] = [];
		const removed: string[] = [];
		const originalAdd = document.addEventListener.bind(document);
		const originalRemove = document.removeEventListener.bind(document);
		document.addEventListener = ((
			type: string,
			listener: EventListenerOrEventListenerObject,
			options?: boolean | AddEventListenerOptions
		) => {
			added.push(type);
			return originalAdd(type, listener, options);
		}) as typeof document.addEventListener;
		document.removeEventListener = ((
			type: string,
			listener: EventListenerOrEventListenerObject,
			options?: boolean | AddEventListenerOptions
		) => {
			removed.push(type);
			return originalRemove(type, listener, options);
		}) as typeof document.removeEventListener;

		const uninstall = installTooltipEscapeHandler(document);
		uninstall();
		document.addEventListener = originalAdd;
		document.removeEventListener = originalRemove;

		assert.deepEqual(added.slice().sort(), ['focusin', 'focusout', 'keydown', 'pointerout', 'pointerover']);
		assert.deepEqual(removed.slice().sort(), added.slice().sort(), 'every listener added is removed');
	});

	it('a dismissed tooltip whose trigger unmounts is dropped and does not throw', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const root = createRoot(container);
		const render = (showTrigger: boolean) =>
			React.createElement(
				'div',
				null,
				showTrigger
					? React.createElement(
							Tooltip,
							{ title: 'Removable', enterDelay: 0, leaveDelay: 200 },
							React.createElement(Button, { id: 'removable-trigger' }, 'Remove me')
						)
					: null,
				React.createElement(Button, { id: 'stay' }, 'Stay')
			);
		await act(async () => root.render(render(true)));
		const uninstall = installTooltipEscapeHandler(document);
		mounted.push({ root, container, uninstall });

		await hover(document.getElementById('removable-trigger'));
		const popper = popperFor('Removable');
		await pressEscape();
		assert.equal(isShown('Removable'), false);

		// Removing the trigger and its tooltip leaves a dangling record; later activity must not throw.
		await act(async () => root.render(render(false)));
		await wait(80);
		await pointer(document.getElementById('stay'), 'pointerover');
		await wait(50);
		assert.equal(popper.isConnected, false, 'the popper went away with its tooltip');
		await pressEscape();
		await pointer(document.getElementById('stay'), 'pointerout', document.body);
		await pointer(document.getElementById('stay'), 'pointerover');
		await wait(50);
	});
});
