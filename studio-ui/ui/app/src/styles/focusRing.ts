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
 * The one Studio keyboard focus ring (WCAG 2.1 SC 2.4.7 and 1.4.11).
 *
 * A 2px brand-blue outline drawn 2px outside the control, so it sits on the page background with a gap
 * between it and the control, not on the control's own fill. It is the only copy of the ring values.
 * The Studio theme, the guest (Experience Builder) theme and the legacy SCSS partial
 * (ui/scss/src/_focus-ring.scss, kept equal by focusRing.test.ts) all read it.
 *
 * This file has no runtime imports, so any branch can add it unchanged, and node:test can load it as is.
 *
 * Contrast of the ring (WCAG 2.1 relative luminance), asserted in focusRing.test.ts:
 *
 * Light #0068DA (palette.blue.main after the 1427 contrast work; today's #007AFF is 4.02:1 on white)
 *   on #FFFFFF white / paper .................... 5.26:1
 *   on #FAFAFA background.default (gray.light0) . 5.04:1
 *   on #F3F3F3 gray.light1 ...................... 4.74:1
 *   on #F2F2F7 gray.light2 ...................... 4.71:1
 *   on #EBEBF0 gray.light3 ...................... 4.43:1
 *   on #E5E5EA gray.light4 ...................... 4.19:1
 *   on #D8D8DC gray.light5 ...................... 3.70:1
 *   on #D1D1D6 gray.light6 ...................... 3.46:1
 *   on #C7C7CC gray.light7 ...................... 3.12:1
 *   on #E6F2FF selected row (blue.highlight) .... 4.64:1 (inset ring inside a selected row)
 *   on #DDE8F5 selected + hovered row ........... 4.24:1
 *
 * Dark #54A6FF (palette.blue.tint after the 1427 contrast work; today's #409CFF is 6.62:1 on #121212)
 *   on #121212 background.paper ................. 7.38:1
 *   on #1C1C1E background.default (gray.dark7) .. 6.70:1
 *   on #242426 gray.dark6 ....................... 6.11:1
 *   on #2C2C2E gray.dark5 ....................... 5.49:1
 *   on #3A3A3C gray.dark3 ....................... 4.47:1
 *   on #393939 elevated dialog paper ............ 4.55:1
 *   on #253242 selected row on #1C1C1E .......... 5.13:1
 *
 * Next to the primary contained button fill the ring is 1.31:1 (light, on #007AFF), 1.00:1 (light, on
 * #0068DA), 1.12:1 (dark, on #409CFF) and 1.00:1 (dark, on #54A6FF). That is why the ring is always
 * offset: the 2px gap shows the surface behind the button, and the ring is measured against that.
 * Never draw this ring inset on a blue fill. On coloured or unknown surfaces (filled alerts, the guest
 * page) use `halo`, which paints the gap in background.paper so the ring always has a known neighbour.
 */
import type { CSSObject, Theme, ThemeOptions } from '@mui/material/styles';

export type FocusRingMode = 'light' | 'dark';

export const focusRingColor: Readonly<Record<FocusRingMode, string>> = {
	light: '#0068DA',
	dark: '#54A6FF'
};

/** Outline width, in px. */
export const focusRingWidth = 2;

/** Gap between the control and the ring, in px. Inset rings use the negative value. */
export const focusRingOffset = 2;

export interface FocusRingOptions {
	/** Draw the ring inside the element, for rows, tree items and anything an ancestor clips. */
	inset?: boolean;
	/** Paint the gap with background.paper, for coloured or unknown surfaces. Ignored when inset. */
	halo?: boolean;
	/** Add !important to every declaration, for the guest, where site CSS may override ours. */
	important?: boolean;
	/** Extra box-shadow to keep, for example an elevation, listed after the halo. */
	shadow?: string;
}

export function getFocusRingColor(mode: FocusRingMode): string {
	return focusRingColor[mode === 'dark' ? 'dark' : 'light'];
}

/**
 * The MUI v9 `focusVisible` theme value. MUI applies it to `.Mui-focusVisible` on every ButtonBase-based
 * component and insets it on the ones that clip (Tab, MenuItem, ListItemButton, CardActionArea).
 * There is no boxShadow, so MUI keeps its own halo on filled Alert, AppBar and Snackbar children.
 */
export function getFocusVisible(mode: FocusRingMode): NonNullable<ThemeOptions['focusVisible']> {
	return {
		outlineStyle: 'solid',
		outlineColor: getFocusRingColor(mode),
		outlineWidth: focusRingWidth,
		outlineOffset: focusRingOffset
	};
}

/** Spread into the options passed to createTheme(), in CrafterThemeProvider and useGuestTheme. */
export function getFocusRingThemeOptions(mode: FocusRingMode): Pick<ThemeOptions, 'focusVisible'> {
	return { focusVisible: getFocusVisible(mode) };
}

/**
 * The ring as plain CSS, for elements that are not ButtonBase: the skip link, main, tree items, grid rows
 * and cells, native video, buttons and iframes. Put it under the element's own focus selector.
 */
export function focusRingStyles(theme: Pick<Theme, 'palette'>, options: FocusRingOptions = {}): CSSObject {
	const { inset = false, halo = false, important = false, shadow } = options;
	const flag = important ? ' !important' : '';
	const shadows = [halo && !inset ? `0 0 0 ${focusRingOffset}px ${theme.palette.background.paper}` : null, shadow]
		.filter(Boolean)
		.join(', ');
	return {
		outline: `${focusRingWidth}px solid ${getFocusRingColor(theme.palette.mode)}${flag}`,
		outlineOffset: `${inset ? -focusRingOffset : focusRingOffset}px${flag}`,
		...(shadows && { boxShadow: `${shadows}${flag}` })
	};
}

/**
 * The same ring as an sx callback: `sx={{ '&:focus-visible': getFocusRingSx({ inset: true }) }}`.
 */
export function getFocusRingSx(options?: FocusRingOptions): (theme: Theme) => CSSObject {
	return (theme) => focusRingStyles(theme, options);
}
