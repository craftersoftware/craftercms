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

/** Drop a pending focus that the moved zone button never satisfied. */
const STALE_FOCUS_MS = 5000;
const STALE_IDENTITY_CHANGES = 4;

interface PendingZoneFocus {
	iceId?: number;
	address?: ZoneAddress;
	/** Wait for the element registry to change before preferring the post-move address. */
	afterRegistryChange: boolean;
	requestedAt: number;
	seenIdentity?: string;
	identityChanges: number;
}

let pending: PendingZoneFocus | null = null;

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
			button.getAttribute('data-craftercms-index') === address.index
		) {
			return button instanceof HTMLElement ? button : null;
		}
	}
	return null;
}

function dropIfStale(): boolean {
	if (pending && Date.now() - pending.requestedAt > STALE_FOCUS_MS) {
		pending = null;
		return true;
	}
	return false;
}

/** Focus a pending zone button. Returns true when a button was focused. */
export function tryFocusPendingZone(): boolean {
	if (!pending || dropIfStale()) {
		return false;
	}
	if (pending.afterRegistryChange) {
		const moved = pending.address ? buttonByAddress(pending.address) : null;
		if (moved) {
			focusElement(moved);
			pending = null;
			return true;
		}
		return false;
	}
	const button =
		(pending.iceId != null ? buttonByIceId(pending.iceId) : null) ??
		(pending.address ? buttonByAddress(pending.address) : null);
	if (!button) {
		return false;
	}
	focusElement(button);
	pending = null;
	return true;
}

/**
 * Remember which zone button should receive focus after a menu unmounts or a move.
 * `afterRegistryChange` keeps the current ice button focused immediately (so focus
 * does not fall to the body) and moves to the new address once the registry updates.
 */
export function requestZoneFocus(target: { iceId?: number; address?: ZoneAddress; afterRegistryChange?: boolean }) {
	pending = {
		iceId: target.iceId,
		address: target.address,
		afterRegistryChange: Boolean(target.afterRegistryChange),
		requestedAt: Date.now(),
		identityChanges: 0
	};
	if (pending.afterRegistryChange && pending.iceId != null) {
		const current = buttonByIceId(pending.iceId);
		if (current) {
			focusElement(current);
		}
		return;
	}
	if (!tryFocusPendingZone()) {
		requestAnimationFrame(() => tryFocusPendingZone());
	}
}

/**
 * Called when the zone-button list's identity changes and the pending address was not found.
 * Position-only updates must not count, or scrolling would expire the request.
 */
export function noteZoneFocusIdentity(identity: string) {
	if (!pending?.afterRegistryChange || dropIfStale()) {
		return;
	}
	if (pending.seenIdentity === undefined) {
		pending.seenIdentity = identity;
		return;
	}
	if (pending.seenIdentity === identity) {
		return;
	}
	pending.seenIdentity = identity;
	pending.identityChanges += 1;
	if (pending.identityChanges >= STALE_IDENTITY_CHANGES) {
		pending = null;
	}
}

/** Called when ICE elements register or deregister. */
export function notifyZoneRegistryChange() {
	if (!pending?.afterRegistryChange) {
		tryFocusPendingZone();
		return;
	}
	if (tryFocusPendingZone()) {
		return;
	}
}

export function shiftedCollectionIndex(index: number | string, delta: number): string {
	const parts = String(index).split('.');
	const last = parseInt(parts[parts.length - 1], 10);
	parts[parts.length - 1] = String((Number.isNaN(last) ? 0 : last) + delta);
	return parts.join('.');
}
