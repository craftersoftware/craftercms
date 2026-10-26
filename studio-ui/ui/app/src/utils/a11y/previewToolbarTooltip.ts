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

/** Class on the preview toolbar root. A class, not a `ref`, so it cannot collide with other PRs that need the root's ref. */
export const PREVIEW_TOOLBAR_CLASS = 'crafter-preview-toolbar';

export const PREVIEW_TOOLBAR_SELECTOR = `.${PREVIEW_TOOLBAR_CLASS}`;

/** Wider than 480px: today's leave delay. MUI's enterNextDelay default is 0. */
export const PREVIEW_TOOLBAR_LEAVE_DELAY = 200;

/** At max-width 480px, only for tooltips inside the preview toolbar. */
export const PREVIEW_TOOLBAR_NARROW_LEAVE_DELAY = 600;
export const PREVIEW_TOOLBAR_NARROW_ENTER_NEXT_DELAY = 400;

export function previewToolbarTooltipDelays(narrow: boolean): { leaveDelay: number; enterNextDelay: number } {
	if (narrow) {
		return {
			leaveDelay: PREVIEW_TOOLBAR_NARROW_LEAVE_DELAY,
			enterNextDelay: PREVIEW_TOOLBAR_NARROW_ENTER_NEXT_DELAY
		};
	}
	return { leaveDelay: PREVIEW_TOOLBAR_LEAVE_DELAY, enterNextDelay: 0 };
}

/**
 * Copy of the theme with preview-toolbar tooltip delays applied.
 * Only `MuiTooltip` `leaveDelay` and `enterNextDelay` change; every other default stays.
 * Wide viewports get the app theme's delays (leaveDelay 200, enterNextDelay 0).
 * Callers should use the result only for the preview toolbar.
 */
export function withPreviewToolbarTooltipDelays<T extends PreviewToolbarTooltipTheme>(theme: T, narrow: boolean): T {
	const delays = previewToolbarTooltipDelays(narrow);
	const components = theme.components ?? {};
	const tooltip = components.MuiTooltip ?? {};
	return {
		...theme,
		components: {
			...components,
			MuiTooltip: {
				...tooltip,
				defaultProps: {
					...tooltip.defaultProps,
					leaveDelay: delays.leaveDelay,
					enterNextDelay: delays.enterNextDelay
				}
			}
		}
	};
}

interface PreviewToolbarTooltipTheme {
	components?: {
		MuiTooltip?: {
			defaultProps?: {
				leaveDelay?: number;
				enterNextDelay?: number;
			};
		};
	};
}

/** False when a shifted tooltip would start below the viewport (short windows, 400% zoom). */
export function tooltipShiftFitsViewport(
	referenceBottom: number,
	clearance: number,
	tooltipHeight: number,
	viewportHeight: number
): boolean {
	return referenceBottom + clearance + tooltipHeight <= viewportHeight;
}

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
	rects: { reference: { y: number; height: number }; popper: { height: number } };
	modifiersData: { popperOffsets?: { x: number; y: number } | null };
}

/**
 * At the wrapped-toolbar width, a hoverable tooltip under a control on an upper row
 * covers the next row and takes its click. Push that tooltip to just below the toolbar.
 * It stays hoverable, Escape still dismisses it, and focus behaviour is unchanged.
 * Wider viewports, and triggers outside `.crafter-preview-toolbar`, are left alone.
 * A short viewport skips the shift so the tooltip is not placed entirely off screen.
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
		const referenceBottom = reference.getBoundingClientRect().bottom;
		const clearance = toolbarTooltipClearance(referenceBottom, toolbar.getBoundingClientRect().bottom);
		if (clearance === 0) return;
		// Short viewports (e.g. 400% zoom on a laptop): below the toolbar would be off screen. Keep Popper's own placement.
		if (!tooltipShiftFitsViewport(referenceBottom, clearance, state.rects.popper.height, window.innerHeight)) return;
		offsets.y = state.rects.reference.y + state.rects.reference.height + clearance;
		state.placement = 'bottom';
	}
};
