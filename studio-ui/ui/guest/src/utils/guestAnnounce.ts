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

type Listener = (message: string) => void;

const listeners = new Set<Listener>();

/** Polite status text for the guest live region. No-op until a region is mounted. */
export function announceGuestStatus(message: string) {
	listeners.forEach((listener) => listener(message));
}

export function subscribeGuestStatus(listener: Listener): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

/** Delay before a repeated message is set again. Matches the other polite live regions. */
export const STATUS_REPEAT_DELAY_MS = 40;

/**
 * Drives a live region's text. A different message is set right away. An identical repeat of the current
 * message is cleared first and set after a short delay so the region's text still changes and is announced
 * again. A timeout (not a microtask) survives React batching when an epic announces.
 */
export function createStatusAnnouncer(setText: (text: string) => void, delay = STATUS_REPEAT_DELAY_MS) {
	let current = '';
	let timer: ReturnType<typeof setTimeout> | undefined;
	return {
		announce(next: string) {
			clearTimeout(timer);
			timer = undefined;
			if (next === current) {
				setText('');
				timer = setTimeout(() => {
					timer = undefined;
					setText(next);
				}, delay);
			} else {
				current = next;
				setText(next);
			}
		},
		dispose() {
			clearTimeout(timer);
			timer = undefined;
		}
	};
}
