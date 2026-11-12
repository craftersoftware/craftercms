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

export interface ZoneAddress {
	modelId: string;
	fieldId: string;
	index: string;
}

/**
 * One pending focus request. Targets are zone addresses (model, field, index), never ice ids, because an
 * operation can re-register the moved item under a different ice id. While waiting for the registry to
 * produce the target, the origin zone button keeps focus so it does not drop to the body. A single timeout
 * is the fallback if the target never shows up.
 */
const FOCUS_FALLBACK_MS = 1500;

interface PendingZoneFocus {
	token: number;
	iceId?: number;
	addresses: ZoneAddress[];
	/** Wait for the element registry to change before looking for the target (moves, removals). */
	afterRegistryChange: boolean;
	originEl: HTMLElement | null;
	sawRegistryChange: boolean;
}

let pending: PendingZoneFocus | null = null;
let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
let nextToken = 0;
let openedFromKeyboard = false;

function clearPending() {
	clearTimeout(fallbackTimer);
	fallbackTimer = undefined;
	pending = null;
}

function focusElement(element: HTMLElement) {
	element.focus({ preventScroll: true });
}

function buttonByIceId(iceId: number): HTMLElement | null {
	return document.querySelector<HTMLElement>(`[data-craftercms-zone-button="${iceId}"]`);
}

function buttonByAddress(address: ZoneAddress): HTMLElement | null {
	for (const button of document.querySelectorAll<HTMLElement>('[data-craftercms-zone-button]')) {
		if (
			button.getAttribute('data-craftercms-model-id') === address.modelId &&
			button.getAttribute('data-craftercms-field-id') === address.fieldId &&
			button.getAttribute('data-craftercms-index') === address.index
		) {
			return button;
		}
	}
	return null;
}

/** The author focused something else. Do not pull focus back. */
function userMovedOn(): boolean {
	const active = document.activeElement;
	if (!active || active === document.body || active === document.documentElement) {
		return false;
	}
	return active !== pending?.originEl && !active.closest('[data-craftercms-zone-menu]');
}

function focusFallback() {
	if (!pending || userMovedOn()) {
		clearPending();
		return;
	}
	const { originEl, iceId, addresses } = pending;
	// The move never repainted and focus is still on the origin button. Leave it there.
	if (originEl?.isConnected && document.activeElement === originEl) {
		clearPending();
		return;
	}
	const first = addresses[0];
	// The field zone's index is the container's: the item index without its last piece.
	const parent = first ? buttonByAddress({ ...first, index: first.index.split('.').slice(0, -1).join('.') }) : null;
	const button = parent ?? (iceId != null ? buttonByIceId(iceId) : null);
	if (button) {
		focusElement(button);
	}
	clearPending();
}

/** Focus the first pending address that has a zone button. Returns true when a button was focused. */
function tryFocusPendingZone(): boolean {
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
	for (const address of pending.addresses) {
		const button = buttonByAddress(address);
		if (button) {
			focusElement(button);
			clearPending();
			return true;
		}
	}
	return false;
}

/**
 * Remember which zone button should receive focus after a menu unmounts or an operation completes.
 * Without `afterRegistryChange` the origin button (or the first address) is focused right away.
 * With it, the origin button keeps focus until the registry changes and a button exists at one of
 * the addresses, in order. `focusCurrent: false` skips focusing the origin button, which is about to be removed.
 */
export function requestZoneFocus(target: {
	iceId?: number;
	addresses?: ZoneAddress[];
	afterRegistryChange?: boolean;
	focusCurrent?: boolean;
}) {
	const token = ++nextToken;
	const addresses = target.addresses ?? [];
	const originEl = target.iceId != null ? buttonByIceId(target.iceId) : null;
	clearPending();
	pending = {
		token,
		iceId: target.iceId,
		addresses,
		afterRegistryChange: Boolean(target.afterRegistryChange),
		originEl,
		sawRegistryChange: false
	};
	fallbackTimer = setTimeout(() => {
		if (pending?.token === token) {
			focusFallback();
		}
	}, FOCUS_FALLBACK_MS);
	if (pending.afterRegistryChange) {
		if (target.focusCurrent !== false && originEl) {
			focusElement(originEl);
		}
		return;
	}
	const button = originEl ?? (addresses[0] ? buttonByAddress(addresses[0]) : null);
	if (button) {
		focusElement(button);
		clearPending();
		return;
	}
	// The zone buttons may not be rendered yet (the menu just closed).
	requestAnimationFrame(() => {
		if (pending?.token === token) {
			tryFocusPendingZone();
		}
	});
}

/** The zone button list committed. Index attributes on the buttons are now the post-change ones. */
export function noteZoneButtonsRendered() {
	if (pending?.afterRegistryChange && pending.sawRegistryChange) {
		tryFocusPendingZone();
	}
}

/** Called when ICE elements register or deregister. */
export function notifyZoneRegistryChange() {
	if (!pending) {
		return;
	}
	if (pending.afterRegistryChange) {
		pending.sawRegistryChange = true;
	} else {
		tryFocusPendingZone();
	}
}

/**
 * Same index first (the next item shifts down into the removed index), then the previous item, then the
 * field zone itself so focus lands on it right away when the removed item was the only one.
 */
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
	// The field zone's index is the container's (the item index without its last piece, empty when not nested).
	addresses.push({ modelId, fieldId, index: parts.slice(0, -1).join('.') });
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
