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
 * MUI Tooltip 9.4 listens for Escape on `document` in the bubble phase and does not
 * stop the event. MUI Modal handles Escape on the dialog root during bubble and
 * calls `stopPropagation()`, so the tooltip listener never runs and the dialog
 * closes instead. A capture listener on `document` runs first: when a tooltip is
 * shown it hides that tooltip directly and swallows the Escape, so nothing else
 * (the dialog, other Escape listeners) reacts to it and focus does not move.
 */

export interface TooltipEscapeNode {
	closest(selector: string): TooltipEscapeNode | null;
	/** Inline style. MUI Grow sets this opacity to 0 when the tooltip starts leaving. */
	style?: { opacity?: string; display?: string };
}

export interface TooltipEscapeRoot {
	querySelectorAll(selector: string): ArrayLike<TooltipEscapeNode>;
	defaultView: {
		getComputedStyle(element: TooltipEscapeNode): { display: string; visibility: string; opacity: string };
	} | null;
}

/**
 * MUI 9.4 fades `.MuiTooltip-tooltip`, not the popper. `MuiTooltip-popperClose` is not
 * applied: the popper slot classes are `popper` and, when interactive, `popperInteractive`.
 * Grow writes inline opacity 0 as soon as the tooltip leaves, while computed opacity
 * stays above 0 for the fade. Escape during that fade must reach the parent dialog.
 */
function isTooltipElementShown(
	node: TooltipEscapeNode,
	style: { display: string; visibility: string; opacity: string }
): boolean {
	if (style.display === 'none' || style.visibility === 'hidden') return false;
	if (node.style?.opacity === '0') return false;
	return Number(style.opacity) !== 0;
}

export function findShownTooltip(root: TooltipEscapeRoot): TooltipEscapeNode | null {
	const nodes = root.querySelectorAll('.MuiTooltip-tooltip');
	for (let index = 0; index < nodes.length; index += 1) {
		const node = nodes[index];
		const popper = node.closest('.MuiTooltip-popper');
		if (!popper) continue;
		const view = root.defaultView;
		if (!view) continue;
		// A dismissed tooltip hides its popper, so check the popper too.
		if (view.getComputedStyle(popper).display === 'none') continue;
		if (!isTooltipElementShown(node, view.getComputedStyle(node))) continue;
		return node;
	}
	return null;
}

/**
 * Hides the shown tooltip's popper. MUI keeps its own open state until the pointer leaves or the trigger
 * blurs, which is when it closes normally; until then the tooltip stays dismissed.
 */
export function dismissShownTooltip(root: TooltipEscapeRoot): boolean {
	const popper = findShownTooltip(root)?.closest('.MuiTooltip-popper');
	if (!popper?.style) return false;
	popper.style.display = 'none';
	return true;
}

export function onTooltipEscapeKeyDown(event: KeyboardEvent, doc: Document): void {
	if (event.key !== 'Escape' || !dismissShownTooltip(doc as unknown as TooltipEscapeRoot)) return;
	event.stopPropagation();
	event.preventDefault();
}

let installs = 0;
let removeListener: (() => void) | null = null;

export function installTooltipEscapeHandler(doc: Document = document): () => void {
	installs += 1;
	if (installs === 1) {
		const listener = (event: KeyboardEvent) => onTooltipEscapeKeyDown(event, doc);
		doc.addEventListener('keydown', listener, true);
		removeListener = () => doc.removeEventListener('keydown', listener, true);
	}
	return () => {
		installs -= 1;
		if (installs === 0 && removeListener) {
			removeListener();
			removeListener = null;
		}
	};
}
