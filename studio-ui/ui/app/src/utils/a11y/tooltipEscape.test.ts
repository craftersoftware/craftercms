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
 * Visibility and dismissal rules on real elements. The lifecycle against MUI's own Tooltip, Dialog and
 * timers is covered in tooltipEscape.render.test.ts.
 */

import '../../../test/stringListDomSetup.mjs';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { dismissShownTooltip, findShownTooltip, isWithin, restoreDismissedTooltip } from './tooltipEscape.ts';

const created: HTMLElement[] = [];

afterEach(() => {
	for (const element of created.splice(0)) element.remove();
});

/** Mounts MUI 9.4's real structure: a popper holding the faded `.MuiTooltip-tooltip`. */
function mountTooltip(id: string, style: Record<string, string> = {}) {
	const popper = document.createElement('div');
	popper.className = 'MuiTooltip-popper MuiTooltip-popperInteractive';
	const tooltip = document.createElement('div');
	tooltip.className = 'MuiTooltip-tooltip';
	tooltip.id = id;
	Object.assign(tooltip.style, style);
	popper.append(tooltip);
	document.body.append(popper);
	created.push(popper);
	return { popper, tooltip };
}

test('a tooltip counts as shown only while it is painted', () => {
	const { popper, tooltip } = mountTooltip('tip');
	assert.equal(findShownTooltip(document), tooltip);

	popper.style.display = 'none';
	assert.equal(findShownTooltip(document), null, 'a hidden popper is dismissed, not shown');

	popper.style.display = '';
	Object.assign(tooltip.style, { visibility: 'hidden' });
	assert.equal(findShownTooltip(document), null, 'visibility:hidden is not shown');

	Object.assign(tooltip.style, { visibility: 'visible', opacity: '0' });
	assert.equal(findShownTooltip(document), null, 'computed opacity 0 is not shown');

	// MUI's Grow writes inline opacity 0 as the tooltip fades, while computed opacity is still above 0.
	// That fade must not count as shown, or Escape during it would be swallowed and the dialog kept open.
	Object.assign(tooltip.style, { opacity: '1' });
	assert.equal(findShownTooltip(document), tooltip, 'a fade that has not reached 0 still counts as shown');
	Object.assign(tooltip.style, { opacity: '0' });
	assert.equal(findShownTooltip(document), null);
});

test('dismissShownTooltip hides the shown tooltip once and reports the trigger it belongs to', () => {
	const { popper, tooltip } = mountTooltip('tip');
	const trigger = document.createElement('button');
	trigger.setAttribute('aria-describedby', 'tip');
	document.body.append(trigger);
	created.push(trigger);

	const dismissed = dismissShownTooltip(document);
	assert.equal(dismissed?.popper, popper);
	assert.equal(dismissed?.trigger, trigger, 'found from the tooltip id the trigger references');
	assert.equal(popper.style.display, 'none');

	// The next Escape is no longer ours, so a parent dialog can handle it.
	assert.equal(dismissShownTooltip(document), null);

	restoreDismissedTooltip(dismissed);
	assert.equal(popper.style.display, '');
	assert.equal(findShownTooltip(document), tooltip);
});

test('a tooltip with no referenced trigger falls back to the focused element', () => {
	const { popper } = mountTooltip('tip');
	const trigger = document.createElement('button');
	trigger.id = 'focused';
	document.body.append(trigger);
	created.push(trigger);
	trigger.focus();

	assert.equal(dismissShownTooltip(document)?.trigger, trigger);
	assert.equal(popper.style.display, 'none');
});

test('a detached popper is not restored, because MUI unmounted it', () => {
	const { popper } = mountTooltip('tip');
	const dismissed = dismissShownTooltip(document);
	popper.remove();
	created.length = 0;
	restoreDismissedTooltip(dismissed);
	assert.equal(popper.style.display, 'none');
});

test('isWithin matches the element and its descendants only', () => {
	const container = document.createElement('div');
	const child = document.createElement('span');
	const sibling = document.createElement('span');
	container.append(child);
	document.body.append(container, sibling);
	created.push(container, sibling);

	assert.equal(isWithin(container, container), true);
	assert.equal(isWithin(container, child), true);
	assert.equal(isWithin(container, sibling), false);
	assert.equal(isWithin(null, child), false);
	assert.equal(isWithin(container, document), false);
});
