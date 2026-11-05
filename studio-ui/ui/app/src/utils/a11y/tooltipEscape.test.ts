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
 * Visibility, ownership and dismissal rules on real elements. The lifecycle against MUI's own Tooltip,
 * Dialog and timers is covered in tooltipEscape.render.test.ts.
 */

import '../../../test/stringListDomSetup.mjs';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
	dismissShownTooltip,
	emptyInteractionTrace,
	findReferencedOwner,
	findShownTooltipPopper,
	installTooltipEscapeHandler,
	isWithin,
	pickLatestInteraction,
	restoreDismissedTooltip
} from './tooltipEscape.ts';

const created: HTMLElement[] = [];

afterEach(() => {
	for (const element of created.splice(0)) element.remove();
});

function append<T extends HTMLElement>(element: T): T {
	document.body.append(element);
	created.push(element);
	return element;
}

/** Mounts MUI 9.4's real structure: a popper (which carries the id) holding the faded `.MuiTooltip-tooltip`. */
function mountTooltip(id: string, style: Record<string, string> = {}) {
	const popper = document.createElement('div');
	popper.className = 'MuiTooltip-popper MuiTooltip-popperInteractive';
	popper.id = id;
	const tooltip = document.createElement('div');
	tooltip.className = 'MuiTooltip-tooltip';
	Object.assign(tooltip.style, style);
	popper.append(tooltip);
	append(popper);
	return { popper, tooltip };
}

test('a tooltip counts as shown only while it is painted', () => {
	const { popper, tooltip } = mountTooltip('tip');
	assert.equal(findShownTooltipPopper(document), popper);

	// A dismissed tooltip hides its popper; it is no longer showing.
	popper.style.display = 'none';
	assert.equal(findShownTooltipPopper(document), null);
	assert.equal(tooltip.isConnected, true, 'hiding the popper leaves it mounted for MUI to reuse');

	popper.style.display = '';
	Object.assign(tooltip.style, { visibility: 'hidden' });
	assert.equal(findShownTooltipPopper(document), null, 'visibility:hidden is not shown');

	Object.assign(tooltip.style, { visibility: 'visible', opacity: '0' });
	assert.equal(findShownTooltipPopper(document), null, 'opacity 0 is not shown');

	// MUI's Grow writes inline opacity 0 as the tooltip fades, while computed opacity is still above 0.
	// That fade must not count as shown, or Escape during it would be swallowed and the dialog kept open.
	Object.assign(tooltip.style, { opacity: '1' });
	assert.equal(findShownTooltipPopper(document), popper, 'a fade that has not reached 0 still counts as shown');
	Object.assign(tooltip.style, { opacity: '0' });
	assert.equal(findShownTooltipPopper(document), null);
});

test('ownership is read from the popper id, which is where MUI puts it', () => {
	const { popper, tooltip } = mountTooltip('tip-id');
	// MUI points the trigger at the popper id; the inner tooltip has no id of its own.
	tooltip.id = '';
	const trigger = append(document.createElement('button'));
	trigger.setAttribute('aria-describedby', 'tip-id');

	assert.equal(findReferencedOwner(document, popper), trigger);
	assert.equal(dismissShownTooltip(document)?.owner, trigger);

	// An id on the inner element is not the association MUI uses.
	tooltip.id = 'inner';
	trigger.setAttribute('aria-describedby', 'inner');
	assert.equal(findReferencedOwner(document, popper), null);
	tooltip.id = '';
	trigger.setAttribute('aria-describedby', 'tip-id');

	// `aria-labelledby` is the other form MUI uses, for a non-string title.
	trigger.removeAttribute('aria-describedby');
	trigger.setAttribute('aria-labelledby', 'tip-id');
	assert.equal(findReferencedOwner(document, popper), trigger);
});

test('with no reference, ownership is the latest outside-popper interaction', () => {
	const { popper } = mountTooltip('tip');
	const trace = emptyInteractionTrace();
	const hovered = append(document.createElement('button'));
	const focused = append(document.createElement('input'));

	// Focus the input, then hover the button: the hover is later, so it owns the tooltip.
	trace.lastFocusTarget = focused;
	trace.lastFocusAt = 1;
	trace.lastPointerTarget = hovered;
	trace.lastPointerAt = 2;
	assert.equal(pickLatestInteraction(trace), hovered);

	// Focus moving afterwards wins, as it would for a keyboard-opened tooltip.
	trace.lastFocusAt = 3;
	assert.equal(pickLatestInteraction(trace), focused);

	// Nothing recorded: no owner rather than "whatever is focused".
	assert.equal(pickLatestInteraction(emptyInteractionTrace()), null);
	assert.equal(dismissShownTooltip(document, emptyInteractionTrace())?.owner, null);
	assert.equal(popper.style.display, 'none');
});

test('a stale owner that left the document is not used', () => {
	mountTooltip('tip');
	const gone = document.createElement('button');
	const trace = emptyInteractionTrace();
	trace.lastPointerTarget = gone;
	trace.lastPointerAt = 1;
	assert.equal(dismissShownTooltip(document, trace)?.owner, null);
});

test('restoring a dismissal shows a mounted popper and skips a detached one', () => {
	const first = mountTooltip('tip');
	const dismissed = dismissShownTooltip(document);
	assert.ok(dismissed);
	assert.equal(first.popper.style.display, 'none');
	restoreDismissedTooltip(dismissed);
	assert.equal(first.popper.style.display, '');

	// Unmount the first so it cannot be the one found, then dismiss the second and detach it.
	first.popper.remove();
	const second = mountTooltip('tip-2');
	const detached = dismissShownTooltip(document);
	assert.equal(detached?.popper, second.popper);
	second.popper.remove();
	restoreDismissedTooltip(detached);
	assert.equal(second.popper.style.display, 'none', 'MUI unmounted it, so there is nothing to restore');
});

test('isWithin matches the element and its descendants only', () => {
	const container = append(document.createElement('div'));
	const child = document.createElement('span');
	const sibling = append(document.createElement('span'));
	container.append(child);

	assert.equal(isWithin(container, container), true);
	assert.equal(isWithin(container, child), true);
	assert.equal(isWithin(container, sibling), false);
	assert.equal(isWithin(null, child), false);
	assert.equal(isWithin(container, document), false);
});

test('the installed handler swaps dismissals independently and cleans up on uninstall', () => {
	mountTooltip('one');
	const uninstall = installTooltipEscapeHandler(document);
	const fire = (type: string, init: KeyboardEventInit | MouseEventInit = {}) => {
		const event =
			type === 'keydown'
				? new window.KeyboardEvent(type, { bubbles: true, cancelable: true, ...init })
				: new window.MouseEvent(type, { bubbles: true, ...init });
		document.body.dispatchEvent(event);
		return event;
	};

	const escape = fire('keydown', { key: 'Escape' }) as KeyboardEvent;
	assert.equal(escape.defaultPrevented, true, 'the first Escape belongs to the tooltip');

	// A key that is not Escape must not consume the dismissal or reset anything.
	const other = fire('keydown', { key: 'Enter' }) as KeyboardEvent;
	assert.equal(other.defaultPrevented, false);

	// With no tooltip showing, Escape is not ours.
	mountTooltip('two');
	const second = fire('keydown', { key: 'Escape' }) as KeyboardEvent;
	assert.equal(second.defaultPrevented, true);

	uninstall();
	const after = fire('keydown', { key: 'Escape' }) as KeyboardEvent;
	assert.equal(after.defaultPrevented, false, 'no listeners remain after uninstall');
});
