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
 * the component. MUI keeps calling the tooltip open when the pointer re-enters within
 * `leaveDelay`, so the popper stays mounted and hidden; the dismissal is therefore
 * undone when the pointer or focus leaves that tooltip's own trigger and returns.
 *
 * Ownership is resolved from the tooltip itself first. MUI puts its id on the popper
 * (not on the inner `.MuiTooltip-tooltip`), and points the trigger at it with
 * `aria-describedby`/`aria-labelledby` while the tooltip is open. A string `title`
 * takes that away, so the fallback is the interaction that most recently opened the
 * tooltip: the last pointer target outside any popper, or the focused element,
 * whichever came last. It is never "whatever is focused" alone.
 */

const POPPER_SELECTOR = '.MuiTooltip-popper';
const TOOLTIP_SELECTOR = '.MuiTooltip-tooltip';

/** One dismissed tooltip, tracked independently of every other dismissal. */
export interface DismissedTooltip {
	/** The hidden popper, and the tooltip's identity while it stays mounted. */
	popper: HTMLElement;
	/** The element whose next leave-and-return shows the tooltip again. */
	owner: Element | null;
	/** Whether the pointer or focus has left the owner since the Escape. */
	leftOwner: boolean;
}

/** True when `target` is `container` or inside it. */
export function isWithin(container: Element | null, target: EventTarget | null): boolean {
	return Boolean(container && target instanceof Element && container.contains(target));
}

function isInsidePopper(target: EventTarget | null): boolean {
	return target instanceof Element && Boolean(target.closest(POPPER_SELECTOR));
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

/** The popper of the tooltip that is currently visible. A hidden or dismissed one is skipped. */
export function findShownTooltipPopper(doc: Document): HTMLElement | null {
	const tooltips = doc.querySelectorAll<HTMLElement>(TOOLTIP_SELECTOR);
	for (let index = 0; index < tooltips.length; index += 1) {
		const tooltip = tooltips[index];
		const popper = tooltip.closest<HTMLElement>(POPPER_SELECTOR);
		if (!popper) continue;
		// A dismissed tooltip hides its popper, so check the popper too.
		if (popper.style.display === 'none') continue;
		if (!isTooltipElementShown(tooltip)) continue;
		return popper;
	}
	return null;
}

/**
 * The element MUI pointed at this popper, if it did. The id lives on the popper; only a
 * non-string `title` (or `describeChild`) makes MUI reference it from the trigger.
 */
export function findReferencedOwner(doc: Document, popper: HTMLElement): Element | null {
	if (!popper.id) return null;
	const owner = doc.querySelector(`[aria-describedby~="${popper.id}"], [aria-labelledby~="${popper.id}"]`);
	return owner && !popper.contains(owner) ? owner : null;
}

/** What the handler has seen, so a dismissal can decide who owns the tooltip. */
export interface InteractionTrace {
	/** The last element the pointer entered outside any popper, and when. */
	lastPointerTarget: Element | null;
	lastPointerAt: number;
	/** The last element focused outside any popper, and when. */
	lastFocusTarget: Element | null;
	lastFocusAt: number;
}

/**
 * The interaction that most recently opened something, which is the one that opened this
 * tooltip: a hovered control or a focused one. Never "whatever is focused" on its own, so a
 * tooltip hovered while an unrelated input holds focus belongs to the hovered control.
 */
export function pickLatestInteraction(trace: InteractionTrace): Element | null {
	if (trace.lastPointerAt === 0 && trace.lastFocusAt === 0) return null;
	return trace.lastPointerAt > trace.lastFocusAt ? trace.lastPointerTarget : trace.lastFocusTarget;
}

/** Resolves who owns the shown tooltip: the element MUI referenced, else the latest interaction. */
export function resolveOwner(doc: Document, popper: HTMLElement, trace: InteractionTrace): Element | null {
	const referenced = findReferencedOwner(doc, popper);
	if (referenced) return referenced;
	const latest = pickLatestInteraction(trace);
	return latest && latest.isConnected ? latest : null;
}

/** A trace with nothing recorded yet. */
export function emptyInteractionTrace(): InteractionTrace {
	return { lastPointerTarget: null, lastPointerAt: 0, lastFocusTarget: null, lastFocusAt: 0 };
}

/** Hides the shown tooltip and reports its owner, or null when nothing was showing. */
export function dismissShownTooltip(
	doc: Document,
	trace: InteractionTrace = emptyInteractionTrace()
): DismissedTooltip | null {
	const popper = findShownTooltipPopper(doc);
	if (!popper) return null;
	const owner = resolveOwner(doc, popper, trace);
	popper.style.display = 'none';
	return { popper, owner, leftOwner: false };
}

/** Undoes a dismissal so the tooltip can be shown again. */
export function restoreDismissedTooltip(dismissed: DismissedTooltip): void {
	// MUI unmounts the popper when it closes, so a detached one has nothing to restore.
	if (dismissed.popper.isConnected) dismissed.popper.style.display = '';
}

let dismissals: DismissedTooltip[] = [];
let installs = 0;
let removeListeners: (() => void) | null = null;

/** Drops dismissals whose popper or owner has left the document, so nothing is retained. */
function pruneDismissals(): void {
	dismissals = dismissals.filter((entry) => entry.popper.isConnected && (!entry.owner || entry.owner.isConnected));
}

/**
 * Marks the dismissed tooltip owned by `target` as left, when the pointer or focus leaves it.
 * Leaving for another element inside the same owner is not a leave.
 */
function markOwnerLeft(target: EventTarget | null, relatedTarget: EventTarget | null): void {
	for (const entry of dismissals) {
		if (entry.leftOwner || !isWithin(entry.owner, target)) continue;
		if (!isWithin(entry.owner, relatedTarget)) entry.leftOwner = true;
	}
}

/**
 * Restores the dismissed tooltip whose owner `target` is, once the pointer or focus has left
 * that owner and come back. Anything inside a popper belongs to no owner.
 */
function restoreOwnerReturned(target: EventTarget | null): void {
	if (isInsidePopper(target)) return;
	for (const entry of dismissals) {
		if (!entry.leftOwner || !isWithin(entry.owner, target)) continue;
		restoreDismissedTooltip(entry);
		dismissals = dismissals.filter((other) => other !== entry);
	}
}

export function onTooltipEscapeKeyDown(event: KeyboardEvent, doc: Document, trace: InteractionTrace): boolean {
	if (event.key !== 'Escape') return false;
	const dismissed = dismissShownTooltip(doc, trace);
	if (!dismissed) return false;
	// Swallow this Escape: the tooltip is dismissed and the dialog or menu behind it stays open.
	event.stopPropagation();
	event.preventDefault();
	pruneDismissals();
	dismissals.push(dismissed);
	return true;
}

/**
 * Installs the capture-phase Escape handling once for every mounted handler.
 * A dismissal is undone only when the pointer or focus leaves that tooltip's owner and returns.
 */
export function installTooltipEscapeHandler(doc: Document = document): () => void {
	installs += 1;
	if (installs === 1) {
		const trace = emptyInteractionTrace();
		let clock = 0;
		const onKeyDown = (event: KeyboardEvent) => {
			// Only a dismissal changes lifecycle state; any other key leaves it alone.
			onTooltipEscapeKeyDown(event, doc, trace);
		};
		const onPointerOver = (event: Event) => {
			// The popper and its children are not owners, so they never become the pointer's target.
			if (!isInsidePopper(event.target)) {
				trace.lastPointerTarget = event.target as Element;
				trace.lastPointerAt = clock += 1;
			}
			restoreOwnerReturned(event.target);
		};
		const onPointerOut = (event: Event) => {
			markOwnerLeft(event.target, (event as PointerEvent).relatedTarget);
		};
		const onFocusIn = (event: Event) => {
			// Focus entering the popper is not a trigger re-entry, so it is not recorded either.
			if (!isInsidePopper(event.target)) {
				trace.lastFocusTarget = event.target as Element;
				trace.lastFocusAt = clock += 1;
			}
			restoreOwnerReturned(event.target);
		};
		const onFocusOut = (event: Event) => markOwnerLeft(event.target, (event as FocusEvent).relatedTarget);
		doc.addEventListener('keydown', onKeyDown, true);
		doc.addEventListener('pointerover', onPointerOver, true);
		doc.addEventListener('pointerout', onPointerOut, true);
		doc.addEventListener('focusin', onFocusIn, true);
		doc.addEventListener('focusout', onFocusOut, true);
		removeListeners = () => {
			doc.removeEventListener('keydown', onKeyDown, true);
			doc.removeEventListener('pointerover', onPointerOver, true);
			doc.removeEventListener('pointerout', onPointerOut, true);
			doc.removeEventListener('focusin', onFocusIn, true);
			doc.removeEventListener('focusout', onFocusOut, true);
			// Nothing outlives the handler.
			dismissals = [];
			Object.assign(trace, emptyInteractionTrace());
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
