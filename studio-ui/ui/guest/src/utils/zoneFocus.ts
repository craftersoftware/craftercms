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

interface ButtonSnap {
	modelId: string;
	fieldId: string;
	index: string;
}

interface PendingZoneFocus {
	iceId?: number;
	/** Tried in order. The first is the preferred index; later entries are fallbacks. */
	addresses: ZoneAddress[];
	/** Wait for the element registry to change before preferring the post-move address. */
	afterRegistryChange: boolean;
	requestedAt: number;
	/**
	 * Zone buttons present when focus was requested. An unchanged button at the
	 * target index is the pre-move neighbour, not the item that just moved.
	 */
	staleById: Map<string, ButtonSnap>;
	seenIdentity?: string;
	identityChanges: number;
	/** False when the current button is about to be removed (trash). */
	focusCurrent: boolean;
}

let pending: PendingZoneFocus | null = null;

function focusElement(element: HTMLElement) {
	element.focus({ preventScroll: true });
}

function buttonByIceId(iceId: number): HTMLElement | null {
	const button = document.querySelector(`[data-craftercms-zone-button="${iceId}"]`);
	return button instanceof HTMLElement ? button : null;
}

function buttonSnap(button: Element): ButtonSnap & { id: string } {
	return {
		id: button.getAttribute('data-craftercms-zone-button') ?? '',
		modelId: button.getAttribute('data-craftercms-model-id') ?? '',
		fieldId: button.getAttribute('data-craftercms-field-id') ?? '',
		index: button.getAttribute('data-craftercms-index') ?? ''
	};
}

function snapshotButtons(): Map<string, ButtonSnap> {
	const snaps = new Map<string, ButtonSnap>();
	document.querySelectorAll('[data-craftercms-zone-button]').forEach((button) => {
		const snap = buttonSnap(button);
		snaps.set(snap.id, { modelId: snap.modelId, fieldId: snap.fieldId, index: snap.index });
	});
	return snaps;
}

function isUnchanged(button: Element, staleById: Map<string, ButtonSnap>): boolean {
	const current = buttonSnap(button);
	const previous = staleById.get(current.id);
	if (!previous) {
		return false;
	}
	return (
		previous.modelId === current.modelId && previous.fieldId === current.fieldId && previous.index === current.index
	);
}

function buttonByAddress(address: ZoneAddress, accept?: (button: Element) => boolean): HTMLElement | null {
	const buttons = document.querySelectorAll('[data-craftercms-zone-button]');
	for (const button of buttons) {
		if (
			button.getAttribute('data-craftercms-model-id') === address.modelId &&
			button.getAttribute('data-craftercms-field-id') === address.fieldId &&
			button.getAttribute('data-craftercms-index') === address.index &&
			(!accept || accept(button)) &&
			button instanceof HTMLElement
		) {
			return button;
		}
	}
	return null;
}

/** The moved or deleted item's button is no longer in the document. */
function originButtonGone(): boolean {
	if (pending?.iceId == null) {
		return false;
	}
	return buttonByIceId(pending.iceId) == null;
}

/**
 * Reject the neighbour that still occupies the target index. Accept the moved item's
 * own button once its address matches (including when the re-render keeps that button's
 * id), a newly created button, or a pre-existing button whose address was rewritten.
 * An unchanged pre-move button is accepted only after the origin button is gone
 * (trash successor, or a move-to destination that kept its id).
 */
function acceptAfterMove(button: Element): boolean {
	if (!pending) {
		return false;
	}
	const id = button.getAttribute('data-craftercms-zone-button') ?? '';
	const ownButton = pending.iceId != null && id === String(pending.iceId);
	if (ownButton) {
		// Same element id: the index attribute has to show the target. An unchanged own button is still
		// the pre-move item, or the item being deleted.
		return !isUnchanged(button, pending.staleById);
	}
	if (!pending.staleById.has(id) || !isUnchanged(button, pending.staleById)) {
		return true;
	}
	return originButtonGone();
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
		for (const address of pending.addresses) {
			const moved = buttonByAddress(address, (button) => acceptAfterMove(button));
			if (moved) {
				focusElement(moved);
				pending = null;
				return true;
			}
		}
		return false;
	}
	const button =
		(pending.iceId != null ? buttonByIceId(pending.iceId) : null) ??
		(pending.addresses[0] ? buttonByAddress(pending.addresses[0]) : null);
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
export function requestZoneFocus(target: {
	iceId?: number;
	address?: ZoneAddress;
	addresses?: ZoneAddress[];
	afterRegistryChange?: boolean;
	/** Focus the current ice button immediately. Skip when that button is about to be removed. */
	focusCurrent?: boolean;
}) {
	const addresses = target.addresses ?? (target.address ? [target.address] : []);
	pending = {
		iceId: target.iceId,
		addresses,
		afterRegistryChange: Boolean(target.afterRegistryChange),
		requestedAt: Date.now(),
		staleById: snapshotButtons(),
		identityChanges: 0,
		focusCurrent: target.focusCurrent !== false
	};
	if (pending.afterRegistryChange && pending.focusCurrent && pending.iceId != null) {
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
