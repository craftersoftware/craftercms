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
