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
 * shown it dismisses that tooltip and swallows the Escape, so nothing else (the
 * dialog, other Escape listeners) reacts to it and focus does not move.
 *
 * Dismissal hides the popper, because MUI's open state is not reachable from outside
 * the component. The next pointer or focus entry clears it, so the tooltip can show
 * again: MUI cancels a pending close when the pointer re-enters within `leaveDelay`,
 * which would otherwise leave the popper hidden while MUI still considers it open.
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

/** Hides the shown tooltip. Returns whether one was showing. */
export function dismissShownTooltip(root: TooltipEscapeRoot): boolean {
	const popper = findShownTooltip(root)?.closest('.MuiTooltip-popper');
	if (!popper?.style) return false;
	popper.style.display = 'none';
	return true;
}

/** Lets a dismissed tooltip be shown by the next hover or focus. */
export function clearTooltipDismissals(root: TooltipEscapeRoot): void {
	const poppers = root.querySelectorAll('.MuiTooltip-popper');
	for (let index = 0; index < poppers.length; index += 1) {
		const popper = poppers[index];
		if (popper.style?.display === 'none') popper.style.display = '';
	}
}

export function onTooltipEscapeKeyDown(event: KeyboardEvent, doc: Document): void {
	if (event.key !== 'Escape' || !dismissShownTooltip(doc as unknown as TooltipEscapeRoot)) return;
	// Swallow this one Escape: the tooltip is dismissed and the dialog or menu behind it stays open.
	event.stopPropagation();
	event.preventDefault();
}

let installs = 0;
let removeListeners: (() => void) | null = null;

/**
 * Installs the capture-phase Escape handling once for every mounted handler.
 * Pointer and focus entry clear a dismissal, so the tooltip shows again on the next hover or focus.
 */
export function installTooltipEscapeHandler(doc: Document = document): () => void {
	installs += 1;
	if (installs === 1) {
		const onKeyDown = (event: KeyboardEvent) => onTooltipEscapeKeyDown(event, doc);
		const onEnter = () => clearTooltipDismissals(doc as unknown as TooltipEscapeRoot);
		doc.addEventListener('keydown', onKeyDown, true);
		doc.addEventListener('pointerover', onEnter, true);
		doc.addEventListener('focusin', onEnter, true);
		removeListeners = () => {
			doc.removeEventListener('keydown', onKeyDown, true);
			doc.removeEventListener('pointerover', onEnter, true);
			doc.removeEventListener('focusin', onEnter, true);
		};
	}
	return () => {
		installs -= 1;
		if (installs === 0 && removeListeners) {
			removeListeners();
			removeListeners = null;
		}
	};
}
