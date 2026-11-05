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

import assert from 'node:assert/strict';
import test from 'node:test';
import {
	clearTooltipDismissals,
	dismissShownTooltip,
	findShownTooltip,
	installTooltipEscapeHandler,
	type TooltipEscapeNode,
	type TooltipEscapeRoot
} from './tooltipEscape.ts';

type FakeNode = TooltipEscapeNode & { parent: FakeNode | null; className: string };

function node(className: string, parent: FakeNode | null = null, inlineOpacity?: string): FakeNode {
	const element: FakeNode = {
		parent,
		className,
		style: inlineOpacity === undefined ? {} : { opacity: inlineOpacity },
		closest(selector: string) {
			const token = selector.slice(1);
			let current: FakeNode | null = element;
			while (current) {
				if (current.className.split(/\s+/).includes(token)) return current;
				current = current.parent;
			}
			return null;
		}
	};
	return element;
}

/** Real MUI 9.4 shape: popper (no popperClose class) > .MuiTooltip-tooltip, which is the faded node. */
function root(
	tooltips: Array<{ display?: string; visibility?: string; opacity?: string; inlineOpacity?: string }>
): TooltipEscapeRoot & { poppers: FakeNode[] } {
	const tips = tooltips.map((tooltip) => {
		const popper = node('MuiTooltip-popper MuiTooltip-popperInteractive');
		const tip = node('MuiTooltip-tooltip', popper, tooltip.inlineOpacity);
		return { popper, tip, tooltip };
	});
	return {
		poppers: tips.map((entry) => entry.popper),
		querySelectorAll(selector: string) {
			if (selector === '.MuiTooltip-tooltip') return tips.map((entry) => entry.tip);
			if (selector === '.MuiTooltip-popper') return tips.map((entry) => entry.popper);
			return [];
		},
		defaultView: {
			getComputedStyle(element: TooltipEscapeNode) {
				const match = tips.find((entry) => entry.tip === element);
				const popper = tips.find((entry) => entry.popper === element);
				return {
					display: popper ? (popper.popper.style?.display ?? 'block') : (match?.tooltip.display ?? 'block'),
					visibility: match?.tooltip.visibility ?? 'visible',
					opacity: match?.tooltip.opacity ?? '1'
				};
			}
		}
	};
}

test('findShownTooltip uses the inner tooltip, including a fade that has not reached opacity 0', () => {
	assert.ok(findShownTooltip(root([{}])));
	assert.equal(findShownTooltip(root([{ display: 'none' }])), null);
	assert.equal(findShownTooltip(root([{ visibility: 'hidden' }])), null);
	assert.equal(findShownTooltip(root([{ opacity: '0' }])), null);
	assert.equal(findShownTooltip(root([{ inlineOpacity: '0', opacity: '1' }])), null);
});

test('dismissShownTooltip hides the shown popper once and ignores a tooltip that is already leaving', () => {
	const shown = root([{}]);
	assert.equal(dismissShownTooltip(shown), true);
	assert.equal(shown.poppers[0].style?.display, 'none');
	// The next Escape is no longer ours, so a parent dialog can handle it.
	assert.equal(dismissShownTooltip(shown), false);
	assert.equal(dismissShownTooltip(root([{ opacity: '0' }])), false);
	assert.equal(dismissShownTooltip(root([])), false);
});

test('a dismissed tooltip can show again once the pointer or focus moves', () => {
	const shown = root([{}]);
	assert.equal(dismissShownTooltip(shown), true);
	assert.equal(shown.poppers[0].style?.display, 'none');
	clearTooltipDismissals(shown);
	assert.notEqual(shown.poppers[0].style?.display, 'none');
	assert.ok(findShownTooltip(shown));
});

test('the installed listener re-shows a dismissed tooltip on the next pointer or focus entry', () => {
	const shown = root([{}]);
	const { doc } = fakeDocument(shown);
	const uninstall = installTooltipEscapeHandler(doc as unknown as Document);
	doc.fire('keydown', { key: 'Escape' });
	assert.equal(shown.poppers[0].style?.display, 'none');
	doc.fire('pointerover', {});
	assert.notEqual(shown.poppers[0].style?.display, 'none');
	uninstall();
});

/** Minimal document double for the installed capture listener: records listeners and delivers events. */
function fakeDocument(shown: TooltipEscapeRoot) {
	const listeners: Array<{ type: string; capture: boolean; listener: (event: unknown) => void }> = [];
	const doc = {
		...shown,
		addEventListener(type: string, listener: (event: unknown) => void, capture?: boolean) {
			listeners.push({ type, capture: Boolean(capture), listener });
		},
		removeEventListener(type: string, listener: (event: unknown) => void, capture?: boolean) {
			const index = listeners.findIndex(
				(entry) => entry.type === type && entry.listener === listener && entry.capture === Boolean(capture)
			);
			if (index >= 0) listeners.splice(index, 1);
		},
		fire(type: string, event: Record<string, unknown>) {
			const entry = listeners.find((candidate) => candidate.type === type);
			let stopped = false;
			entry?.listener(Object.assign(event, { stopPropagation: () => (stopped = true), preventDefault: () => {} }));
			return stopped;
		}
	};
	return { doc, listeners };
}

test('the installed listener dismisses a shown tooltip and swallows that Escape', () => {
	const shown = root([{}]);
	const { doc, listeners } = fakeDocument(shown);
	const uninstall = installTooltipEscapeHandler(doc as unknown as Document);
	assert.equal(listeners.find((entry) => entry.type === 'keydown')?.capture, true);

	assert.equal(doc.fire('keydown', { key: 'Escape' }), true);
	assert.equal(shown.poppers[0].style?.display, 'none');

	// Handled: the second Escape belongs to the dialog again.
	assert.equal(doc.fire('keydown', { key: 'Escape' }), false);
	uninstall();
});

test('the installed listener leaves Escape alone when no tooltip is shown', () => {
	const { doc, listeners } = fakeDocument(root([]));
	const uninstall = installTooltipEscapeHandler(doc as unknown as Document);
	assert.equal(doc.fire('keydown', { key: 'Escape' }), false);
	assert.equal(doc.fire('keydown', { key: 'Enter' }), false);
	uninstall();
	assert.equal(listeners.length, 0);
});
