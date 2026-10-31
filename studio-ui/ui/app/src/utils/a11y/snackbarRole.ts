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

export type SnackbarLiveRole = 'alert' | 'status';

/**
 * WCAG 4.1.3: errors and warnings are alerts. Success, info, and the default
 * toast are polite status messages.
 */
export function snackbarLiveRole(variant: string | undefined): SnackbarLiveRole {
	return variant === 'error' || variant === 'warning' ? 'alert' : 'status';
}

export function applySnackbarLiveRole(element: HTMLElement, variant: string | undefined): void {
	const role = snackbarLiveRole(variant);
	element.setAttribute('role', role);
	element.setAttribute('aria-live', role === 'alert' ? 'assertive' : 'polite');
	element.setAttribute('aria-atomic', 'true');
}
