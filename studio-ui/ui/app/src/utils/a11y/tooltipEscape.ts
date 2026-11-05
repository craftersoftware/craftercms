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
 * the component. It is undone only by the dismissed tooltip's own trigger: the pointer
 * or focus has to leave that trigger and come back. Unrelated pointer or focus activity
 * leaves the tooltip dismissed. This covers a re-entry within `leaveDelay`, where MUI
 * cancels its pending close and would otherwise keep the popper hidden while it still
 * considers the tooltip open.
 */

/** MUI 9 wraps the tooltip in this popper and fades this child. */
const POPPER_SELECTOR = '.MuiTooltip-popper';
const TOOLTIP_SELECTOR = '.MuiTooltip-tooltip';

/** What a dismissal needs to undo itself. */
export interface DismissedTooltip {
	popper: HTMLElement;
	/** The element the tooltip belongs to, when it can be identified. */
	trigger: Element | null;
}

/**
 * MUI 9.4 fades `.MuiTooltip-tooltip`, not the popper. `MuiTooltip-popperClose` is not
 * applied: the popper slot classes are `popper` and, when interactive, `popperInteractive`.
 * Grow writes inline opacity 0 as soon as the tooltip leaves, while computed opacity
 * stays above 0 for the fade. Escape during that fade must reach the parent dialog.
 */
function isTooltipElementShown(node: HTMLElement): boolean {
	const style = node.ownerDocument.defaultView?.getComputedStyle(node);
	if (!style) return false;
	if (style.display === 'none' || style.visibility === 'hidden') return false;
	if (node.style.opacity === '0') return false;
	return Number(style.opacity) !== 0;
}

/** The tooltip that is currently visible, if any. A dismissed one is hidden and skipped. */
export function findShownTooltip(doc: Document): HTMLElement | null {
	const tooltips = doc.querySelectorAll<HTMLElement>(TOOLTIP_SELECTOR);
	for (let index = 0; index < tooltips.length; index += 1) {
		const tooltip = tooltips[index];
		const popper = tooltip.closest<HTMLElement>(POPPER_SELECTOR);
		if (!popper) continue;
		// A dismissed tooltip hides its popper, so check the popper too.
		if (getComputedStyle(popper).display === 'none') continue;
		if (!isTooltipElementShown(tooltip)) continue;
		return tooltip;
	}
	return null;
}

/** True when `target` is `container` or inside it. */
export function isWithin(container: Element | null, target: EventTarget | null): boolean {
	return Boolean(container && target instanceof Element && container.contains(target));
}

/**
 * The element a tooltip belongs to. MUI only references the popper from the trigger while the
 * title is not a string, so fall back to what opened the tooltip: the focused element, or the
 * control the pointer was last over.
 */
function resolveTrigger(doc: Document, popper: HTMLElement, lastPointerTarget: Element | null): Element | null {
	const tooltip = popper.querySelector<HTMLElement>(TOOLTIP_SELECTOR);
	const referenced = tooltip?.id
		? doc.querySelector(`[aria-describedby~="${tooltip.id}"], [aria-labelledby~="${tooltip.id}"]`)
		: null;
	if (referenced && !popper.contains(referenced)) return referenced;
	const active = doc.activeElement;
	if (active && active !== doc.body && active !== doc.documentElement && !popper.contains(active)) return active;
	if (lastPointerTarget && !isWithin(popper, lastPointerTarget)) {
		return (
			lastPointerTarget.closest('button, a, [role="button"], [tabindex], input, select, textarea') ?? lastPointerTarget
		);
	}
	return null;
}

/**
 * Hides the tooltip that is showing and reports which trigger can bring it back.
 * `lastPointerTarget` is the deepest element the pointer was over, for pointer-opened tooltips.
 */
export function dismissShownTooltip(doc: Document, lastPointerTarget: Element | null = null): DismissedTooltip | null {
	const popper = findShownTooltip(doc)?.closest<HTMLElement>(POPPER_SELECTOR);
	if (!popper) return null;
	const trigger = resolveTrigger(doc, popper, lastPointerTarget);
	popper.style.display = 'none';
	return { popper, trigger };
}

/** Undoes a dismissal so the tooltip can be shown again. */
export function restoreDismissedTooltip(dismissed: DismissedTooltip): void {
	// MUI unmounts the popper when it closes, so a detached one needs no restoring.
	if (dismissed.popper.isConnected) dismissed.popper.style.display = '';
}

/** Stops one Escape from reaching the dialog behind the tooltip, and reports whether it did. */
export function onTooltipEscapeKeyDown(
	event: KeyboardEvent,
	doc: Document,
	lastPointerTarget: Element | null = null
): boolean {
	const dismissed = event.key === 'Escape' ? dismissShownTooltip(doc, lastPointerTarget) : null;
	if (!dismissed) return false;
	// Swallow this Escape: the tooltip is dismissed and the dialog or menu behind it stays open.
	event.stopPropagation();
	event.preventDefault();
	lastDismissal = dismissed;
	return true;
}

let lastDismissal: DismissedTooltip | null = null;
let installs = 0;
let removeListeners: (() => void) | null = null;

/**
 * Installs the capture-phase Escape handling once for every mounted handler.
 * A dismissal is undone only when the pointer or focus leaves that tooltip's trigger and returns.
 */
export function installTooltipEscapeHandler(doc: Document = document): () => void {
	installs += 1;
	if (installs === 1) {
		let lastPointerTarget: Element | null = null;
		// Whether the pointer or focus has left the dismissed tooltip's trigger since the Escape.
		let leftTrigger = false;

		const onKeyDown = (event: KeyboardEvent) => {
			onTooltipEscapeKeyDown(event, doc, lastPointerTarget);
			leftTrigger = false;
		};
		const onPointerOut = (event: Event) => {
			if (
				lastDismissal &&
				isWithin(lastDismissal.trigger, event.target) &&
				!isWithin(lastDismissal.trigger, (event as PointerEvent).relatedTarget)
			) {
				leftTrigger = true;
			}
		};
		const onPointerOver = (event: Event) => {
			const target = event.target;
			if (target instanceof Element) lastPointerTarget = target;
			if (lastDismissal && leftTrigger && isWithin(lastDismissal.trigger, target)) {
				restoreDismissedTooltip(lastDismissal);
				lastDismissal = null;
				leftTrigger = false;
			}
		};
		const onFocusOut = (event: Event) => {
			if (lastDismissal && isWithin(lastDismissal.trigger, event.target)) leftTrigger = true;
		};
		const onFocusIn = (event: Event) => {
			if (lastDismissal && leftTrigger && isWithin(lastDismissal.trigger, event.target)) {
				restoreDismissedTooltip(lastDismissal);
				lastDismissal = null;
				leftTrigger = false;
			}
		};
		// A new dismissal replaces the previous one, so nothing else needs clearing.
		doc.addEventListener('keydown', onKeyDown, true);
		doc.addEventListener('pointerout', onPointerOut, true);
		doc.addEventListener('pointerover', onPointerOver, true);
		doc.addEventListener('focusout', onFocusOut, true);
		doc.addEventListener('focusin', onFocusIn, true);
		removeListeners = () => {
			doc.removeEventListener('keydown', onKeyDown, true);
			doc.removeEventListener('pointerout', onPointerOut, true);
			doc.removeEventListener('pointerover', onPointerOver, true);
			doc.removeEventListener('focusout', onFocusOut, true);
			doc.removeEventListener('focusin', onFocusIn, true);
			lastDismissal = null;
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
