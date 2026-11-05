/*
 * Copyright (C) 2007-2022 Crafter Software Corporation. All Rights Reserved.
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

import type { CSSObject } from '@mui/material/styles';

/**
 * The companion stroke for an overlay drawn on an authored page (WCAG 2.1 SC 1.4.11).
 *
 * Experience Builder draws zone boundaries and drop markers over the page the developer authored, so the
 * colour underneath is unknown, and the Studio mode says nothing about it: a dark Studio theme draws the
 * light `primary.tint`, and `#54A6FF` is 2.54:1 on a white page.
 *
 * So the edge that touches the page is never the state colour. A white band, a black band and then the
 * state colour are stacked inwards from the edge:
 *
 *   page | white 1px | black 1px | state colour 2px
 *
 * Whatever the page colour, one of the white and the black band is at least 4.57:1 against it (the worst
 * case is a mid grey), so the boundary is always visible. The state colour sits on the black band, where
 * every guest state colour reaches at least 3.99:1, so it keeps its hue and its meaning.
 *
 * This is not the focus ring. The focus ring is styles/focusRing.ts: it marks the keyboard caret on Studio
 * surfaces, so it follows the Studio mode. A zone boundary marks a region on the page, so it cannot.
 *
 * Like focusRing.ts, this file has no runtime imports, so node:test can load it directly.
 */

/** Width of each band of the companion stroke, in px. */
export const overlayStrokeWidth = 1;

/** Width of the state colour drawn inside the companion stroke, in px. */
export const overlayStateWidth = 2;

/** Inset of the state colour from the edge: past both bands. */
export const overlayStateOffset = overlayStrokeWidth * 2;

/**
 * `outline-offset` that puts the state colour just inside both bands. An outline is painted outwards from
 * `outlineOffset` by its own width, so without this it overpaints the bands.
 */
export const overlayOutlineOffset = overlayStateOffset + overlayStateWidth;

/**
 * The least the two helpers need from the theme. Structural on purpose: the guest build and the app build
 * resolve two copies of `@mui/material` types, and `Pick<Theme, 'palette'>` from one is not assignable to
 * the other.
 */
export interface OverlayTheme {
	palette: { common: { white: string; black: string } };
}

/** The white and black bands, as an inset box-shadow. The white is listed first, so it stays outermost. */
export function overlayCompanionShadow(theme: OverlayTheme): string {
	const { white, black } = theme.palette.common;
	return `inset 0 0 0 ${overlayStrokeWidth}px ${white}, inset 0 0 0 ${overlayStateOffset}px ${black}`;
}

/**
 * The boundary for an overlay in a state whose colour is already resolved. Spread it into the overlay's
 * `sx`.
 */
export function overlayBoundarySx(theme: OverlayTheme, stateColour: string): CSSObject {
	return {
		outlineStyle: 'solid',
		outlineWidth: overlayStateWidth,
		outlineColor: stateColour,
		outlineOffset: `-${overlayOutlineOffset}px`,
		boxShadow: overlayCompanionShadow(theme)
	};
}

/**
 * The companion bands for an overlay that is a filled line rather than a hollow box: the white band is a
 * border and the black band a ring outside it, so the line reads as
 * page | black 1px | white 1px | state colour. Both bands still touch the page, so the 4.57:1 guarantee above
 * holds for them.
 */
export function overlayBandSx(theme: OverlayTheme, bandWidth: number = overlayStrokeWidth): CSSObject {
	const { white, black } = theme.palette.common;
	return {
		borderStyle: 'solid',
		borderWidth: `${bandWidth}px`,
		borderColor: white,
		boxShadow: `0 0 0 ${bandWidth}px ${black}`
	};
}

/**
 * The boundary as an sx callback, for a state colour that comes from the theme. Spread it into the
 * overlay's `sx`; a later entry from the caller still wins.
 */
export function getOverlayBoundarySx<T extends OverlayTheme>(
	stateColour: (theme: T) => string
): (theme: T) => CSSObject {
	return (theme) => overlayBoundarySx(theme, stateColour(theme));
}
