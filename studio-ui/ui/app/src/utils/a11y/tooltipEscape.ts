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
 * closes instead. A capture listener on `document` runs first.
 */
export const TOOLTIP_ESCAPE_REDISPATCH = 'crafterTooltipEscapeRedispatch';

export interface TooltipEscapeNode {
	closest(selector: string): TooltipEscapeNode | null;
	classList: { contains(token: string): boolean };
}

export interface TooltipEscapeRoot {
	querySelectorAll(selector: string): ArrayLike<TooltipEscapeNode>;
	defaultView: {
		getComputedStyle(element: TooltipEscapeNode): { display: string; visibility: string; opacity: string };
		KeyboardEvent?: typeof KeyboardEvent;
	} | null;
	dispatchEvent?(event: Event): boolean;
}

export function findShownTooltip(root: TooltipEscapeRoot): TooltipEscapeNode | null {
	const nodes = root.querySelectorAll('.MuiTooltip-tooltip');
	for (let index = 0; index < nodes.length; index += 1) {
		const node = nodes[index];
		const popper = node.closest('.MuiTooltip-popper');
		if (!popper) continue;
		if (popper.classList.contains('MuiTooltip-popperClose')) continue;
		const view = root.defaultView;
		if (!view) continue;
		const style = view.getComputedStyle(popper);
		if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
		return node;
	}
	return null;
}

export function isTooltipEscapeRedispatch(event: object): boolean {
	return Boolean((event as { [TOOLTIP_ESCAPE_REDISPATCH]?: boolean })[TOOLTIP_ESCAPE_REDISPATCH]);
}

export function shouldInterceptTooltipEscape(event: { key: string }, root: TooltipEscapeRoot): boolean {
	if (event.key !== 'Escape' || isTooltipEscapeRedispatch(event)) return false;
	return findShownTooltip(root) != null;
}

/**
 * Stops the original Escape so a parent dialog does not close, then re-dispatches
 * Escape on `document` so MUI Tooltip's own bubble listener dismisses the tooltip.
 */
export function onTooltipEscapeKeyDown(event: KeyboardEvent, doc: Document): void {
	if (!shouldInterceptTooltipEscape(event, doc as unknown as TooltipEscapeRoot)) return;
	event.stopPropagation();
	event.preventDefault();
	const ViewKeyboardEvent = doc.defaultView?.KeyboardEvent ?? KeyboardEvent;
	const next = new ViewKeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
	Object.defineProperty(next, TOOLTIP_ESCAPE_REDISPATCH, { value: true });
	doc.dispatchEvent(next);
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
