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

import { getElementRecords } from '../elementRegistry';

export interface ZoneAddress {
	modelId: string;
	fieldId: string;
	index: string;
}

/**
 * One pending focus. The target is an address the operation just produced.
 * Focus runs after the element registry contains that address and the zone
 * buttons have been painted. A single timeout falls back to the parent zone.
 *
 * Not tracked: per-button attribute snapshots, identity-change counts, a
 * staleness clock checked on every call, or an origin-vs-neighbour guess.
 */
const FOCUS_FALLBACK_MS = 1500;
const SETTLE_MS = 150;
/** After the fallback leaves focus on the moved item, keep listening this long for a late re-render. */
const HOLD_MS = 5000;

interface PendingZoneFocus {
	token: number;
	iceId?: number;
	addresses: ZoneAddress[];
	afterRegistryChange: boolean;
	originEl: HTMLElement | null;
	sawRegistryChange: boolean;
	/** The registry has been quiet for SETTLE_MS since its last change. */
	settled: boolean;
	/** The origin item is being removed, so there is no moved item to wait for. */
	removal: boolean;
	/** The fallback expired with focus still on the moved item's button. Act only once that focus is lost. */
	holding?: boolean;
}

let pending: PendingZoneFocus | null = null;
let fallbackTimer: number | undefined;
let settleTimer: number | undefined;
let nextToken = 0;
let openedFromKeyboard = false;

function clearTimer() {
	if (fallbackTimer !== undefined) {
		window.clearTimeout(fallbackTimer);
		fallbackTimer = undefined;
	}
	if (settleTimer !== undefined) {
		window.clearTimeout(settleTimer);
		settleTimer = undefined;
	}
}

function clearPending() {
	clearTimer();
	pending = null;
}

function focusElement(element: HTMLElement) {
	element.focus({ preventScroll: true });
}

function buttonByIceId(iceId: number): HTMLElement | null {
	const button = document.querySelector(`[data-craftercms-zone-button="${iceId}"]`);
	return button instanceof HTMLElement ? button : null;
}

function buttonByAddress(address: ZoneAddress): HTMLElement | null {
	const buttons = document.querySelectorAll('[data-craftercms-zone-button]');
	for (const button of buttons) {
		if (
			button.getAttribute('data-craftercms-model-id') === address.modelId &&
			button.getAttribute('data-craftercms-field-id') === address.fieldId &&
			button.getAttribute('data-craftercms-index') === address.index &&
			button instanceof HTMLElement
		) {
			return button;
		}
	}
	return null;
}

function registryHasAddress(address: ZoneAddress): boolean {
	return getElementRecords().some((record) => {
		const fieldId = record.fieldId?.join('.') ?? '';
		const index = record.index == null ? '' : String(record.index);
		return record.modelId === address.modelId && fieldId === address.fieldId && index === address.index;
	});
}

function parentAddress(address: ZoneAddress): ZoneAddress {
	return { modelId: address.modelId, fieldId: address.fieldId, index: '' };
}

/** The author focused something else. Do not pull focus back. */
function userMovedOn(): boolean {
	const active = document.activeElement;
	if (!active || active === document.body || active === document.documentElement) {
		return false;
	}
	if (!(active instanceof Element)) {
		return false;
	}
	if (pending?.originEl && active === pending.originEl) {
		return false;
	}
	if (active.closest('[data-craftercms-zone-menu]')) {
		return false;
	}
	return true;
}

function itemAddresses(): ZoneAddress[] {
	return (pending?.addresses ?? []).filter((address) => address.index !== '');
}

function findTargetButton(): HTMLElement | null {
	if (!pending) {
		return null;
	}
	const targetIndex = itemAddresses()[0]?.index;
	const own = pending.iceId != null ? buttonByIceId(pending.iceId) : null;
	// The moved item's own button is still in the document. Trust it only after its
	// index attribute is the post-move index. A neighbour may already sit at the
	// target index; focusing that neighbour is the bug this wait exists to avoid.
	if (own) {
		if (targetIndex != null && own.getAttribute('data-craftercms-index') === targetIndex) {
			return own;
		}
		// Some re-renders keep this button's ice id for its old address and give the moved item a new
		// one (the neighbour now owns the old address). Once the registry has been quiet, the button
		// at the target address is the final one.
		if (!pending.settled) {
			return null;
		}
	}
	// The origin button is gone (the item was removed). Match the replacement by address
	// once the registry contains it.
	for (const address of itemAddresses()) {
		if (!registryHasAddress(address)) {
			continue;
		}
		const button = buttonByAddress(address);
		if (button) {
			return button;
		}
	}
	return null;
}

function focusIsAlreadyOnMovedItem(): boolean {
	const active = document.activeElement;
	if (!(active instanceof HTMLElement) || !active.hasAttribute('data-craftercms-zone-button') || !pending) {
		return false;
	}
	return pending.iceId != null && active.getAttribute('data-craftercms-zone-button') === String(pending.iceId);
}

function focusFallback() {
	if (!pending || userMovedOn()) {
		clearPending();
		return;
	}
	// A move that never repaints still leaves focus on the moved item's zone button. Do not
	// send that focus to the parent zone when the timeout expires.
	if (focusIsAlreadyOnMovedItem()) {
		// Keep the request for a bounded time. A slow re-render can still replace this button, and
		// focus would fall to the body with nothing left to recover it.
		const token = pending.token;
		pending.holding = true;
		// The 1500ms timer may still be armed when the settle path reaches this branch.
		// Drop it before arming the hold, and clearPending() drops the hold when a new request replaces this one.
		if (fallbackTimer !== undefined) {
			window.clearTimeout(fallbackTimer);
		}
		fallbackTimer = window.setTimeout(() => {
			if (pending?.token === token) {
				clearPending();
			}
		}, HOLD_MS);
		return;
	}
	const first = pending.addresses[0];
	const parent = first ? buttonByAddress(parentAddress(first)) : null;
	const current = pending.iceId != null ? buttonByIceId(pending.iceId) : null;
	const button = parent ?? current;
	if (button) {
		focusElement(button);
	}
	clearPending();
}

function armFallback(token: number) {
	clearTimer();
	fallbackTimer = window.setTimeout(() => {
		if (pending?.token !== token) {
			return;
		}
		focusFallback();
	}, FOCUS_FALLBACK_MS);
}

/** Focus a pending zone button. Returns true when a button was focused. */
export function tryFocusPendingZone(): boolean {
	if (!pending) {
		return false;
	}
	if (userMovedOn()) {
		clearPending();
		return false;
	}
	if (pending.afterRegistryChange && !pending.sawRegistryChange) {
		return false;
	}
	if (pending.holding && pending.originEl?.isConnected && document.activeElement === pending.originEl) {
		return false;
	}
	const button = findTargetButton();
	if (!button) {
		return false;
	}
	focusElement(button);
	clearPending();
	return true;
}

/**
 * Remember which zone button should receive focus after a menu unmounts or a move.
 * `afterRegistryChange` keeps the current ice button focused (so focus does not fall
 * to the body) and moves to the new address once that address is in the registry
 * and the zone buttons have been painted.
 */
export function requestZoneFocus(target: {
	iceId?: number;
	address?: ZoneAddress;
	addresses?: ZoneAddress[];
	afterRegistryChange?: boolean;
	/** Focus the current ice button immediately. Skip when that button is about to be removed. */
	focusCurrent?: boolean;
}) {
	const addresses = target.addresses ?? (target.address ? [target.address] : []);
	const token = ++nextToken;
	const originEl = target.iceId != null ? buttonByIceId(target.iceId) : null;
	pending = {
		token,
		iceId: target.iceId,
		addresses,
		afterRegistryChange: Boolean(target.afterRegistryChange),
		originEl,
		sawRegistryChange: false,
		settled: false,
		removal: target.focusCurrent === false
	};
	armFallback(token);
	if (pending.afterRegistryChange && target.focusCurrent !== false && originEl) {
		focusElement(originEl);
		return;
	}
	if (!pending.afterRegistryChange) {
		const button = originEl ?? (addresses[0] ? buttonByAddress(addresses[0]) : null);
		if (button) {
			focusElement(button);
			clearPending();
			return;
		}
		window.requestAnimationFrame(() => {
			if (pending?.token === token) {
				tryFocusPendingZone();
			}
		});
	}
}

/**
 * The zone-button list committed. Focus only after a registry update so the
 * indexes on the buttons are the post-move ones.
 */
export function noteZoneButtonsRendered() {
	if (!pending?.afterRegistryChange || !pending.sawRegistryChange) {
		return;
	}
	tryFocusPendingZone();
}

/**
 * Previously counted identity changes to guess a stale neighbour button.
 * Callers may still invoke it after a zone-button render; the argument is ignored.
 */
export function noteZoneFocusIdentity(identity?: string) {
	void identity;
	noteZoneButtonsRendered();
}

/** Called when ICE elements register or deregister. */
export function notifyZoneRegistryChange() {
	if (!pending) {
		return;
	}
	if (!pending.afterRegistryChange) {
		tryFocusPendingZone();
		return;
	}
	pending.sawRegistryChange = true;
	const token = pending.token;
	window.clearTimeout(settleTimer);
	settleTimer = window.setTimeout(() => {
		settleTimer = undefined;
		if (pending?.token === token) {
			pending.settled = true;
			// A removed item with no neighbour left (the only item) has no address to wait for.
			if (!tryFocusPendingZone() && pending?.removal) {
				focusFallback();
			}
		}
	}, SETTLE_MS);
}

/** Same index, then the previous item, then the next. Used after the current item is removed. */
export function focusAddressesAfterRemoval(modelId: string, fieldId: string, index: number | string): ZoneAddress[] {
	const parts = String(index).split('.');
	const last = parseInt(parts[parts.length - 1], 10);
	const at = Number.isNaN(last) ? 0 : last;
	const atIndex = (value: number) => {
		const copy = parts.slice();
		copy[copy.length - 1] = String(value);
		return copy.join('.');
	};
	const addresses: ZoneAddress[] = [{ modelId, fieldId, index: atIndex(at) }];
	if (at > 0) {
		addresses.push({ modelId, fieldId, index: atIndex(at - 1) });
	}
	addresses.push({ modelId, fieldId, index: atIndex(at + 1) });
	return addresses;
}

export function shiftedCollectionIndex(index: number | string, delta: number): string {
	const parts = String(index).split('.');
	const last = parseInt(parts[parts.length - 1], 10);
	parts[parts.length - 1] = String((Number.isNaN(last) ? 0 : last) + delta);
	return parts.join('.');
}

/** Zone menu autofocus follows a keyboard zone button, not a mouse selection. */
export function markZoneOpenedFromKeyboard() {
	openedFromKeyboard = true;
}

export function wasZoneOpenedFromKeyboard(): boolean {
	return openedFromKeyboard;
}

export function clearZoneOpenedFromKeyboard() {
	openedFromKeyboard = false;
}
