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
 * Same breakpoint as #1428 `PREVIEW_TOOLBAR_WRAP_QUERY` (`@media (max-width: 480px)`).
 * Duplicated so this branch does not import that module.
 */
export const PREVIEW_TOOLBAR_NARROW_QUERY = '(max-width: 480px)';

export const PREVIEW_TOOLBAR_SELECTOR = '[data-preview-toolbar]';

const ROW_SLOP_PX = 4;
const CLEARANCE_GAP_PX = 8;

/**
 * How far a bottom-placed tooltip must move down so it clears the preview toolbar.
 * Zero when the trigger is already on the last row (its bottom edge is the toolbar's).
 */
export function toolbarTooltipClearance(
	referenceBottom: number,
	toolbarBottom: number,
	gap = CLEARANCE_GAP_PX
): number {
	const extra = toolbarBottom - referenceBottom;
	if (extra <= ROW_SLOP_PX) return 0;
	return extra + gap;
}

interface NarrowTooltipState {
	placement: string;
	elements: {
		reference: {
			closest?(selector: string): Element | null;
			getBoundingClientRect(): { bottom: number };
		};
	};
	rects: { reference: { y: number; height: number } };
	modifiersData: { popperOffsets?: { x: number; y: number } | null };
}

/**
 * At the wrapped-toolbar width, a hoverable tooltip under a control on an upper row
 * covers the next row and takes its click. Push that tooltip to just below the toolbar.
 * It stays hoverable, Escape still dismisses it, and focus behaviour is unchanged.
 * Wider viewports, and triggers outside `[data-preview-toolbar]`, are left alone.
 */
export const previewToolbarNarrowTooltip = {
	name: 'previewToolbarNarrowTooltip',
	enabled: true,
	phase: 'main' as const,
	requires: ['preventOverflow'],
	fn({ state }: { state: NarrowTooltipState }) {
		if (typeof window === 'undefined' || !window.matchMedia(PREVIEW_TOOLBAR_NARROW_QUERY).matches) return;
		const reference = state.elements.reference;
		const toolbar = reference.closest?.(PREVIEW_TOOLBAR_SELECTOR);
		const offsets = state.modifiersData.popperOffsets;
		if (!toolbar || !offsets) return;
		const clearance = toolbarTooltipClearance(
			reference.getBoundingClientRect().bottom,
			toolbar.getBoundingClientRect().bottom
		);
		if (clearance === 0) return;
		offsets.y = state.rects.reference.y + state.rects.reference.height + clearance;
		state.placement = 'bottom';
	}
};
