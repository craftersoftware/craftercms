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

interface PendingZoneFocus {
	iceId?: number;
	address?: ZoneAddress;
	/** Wait for the element registry to change before preferring the post-move address. */
	afterRegistryChange: boolean;
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

/** Focus a pending zone button. Returns true when a button was focused. */
export function tryFocusPendingZone(): boolean {
	if (!pending) {
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
		afterRegistryChange: Boolean(target.afterRegistryChange)
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
