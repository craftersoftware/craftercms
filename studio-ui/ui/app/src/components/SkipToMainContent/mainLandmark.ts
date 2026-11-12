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

import { Theme } from '@mui/material/styles';
import { SystemStyleObject } from '@mui/system';
import { focusRingStyles, type FocusRingOptions } from '../../styles/focusRing';

/** Target for the shell skip link. One per document (each Studio screen is its own page). */
export const STUDIO_MAIN_CONTENT_ID = 'studioMainContent';

function createMainLandmarkSx(options?: FocusRingOptions): SystemStyleObject<Theme> {
	return {
		outline: 'none',
		position: 'relative',
		'&:focus-visible::after': (theme: Theme) => ({
			content: '""',
			position: 'absolute',
			inset: 0,
			pointerEvents: 'none',
			zIndex: theme.zIndex.appBar + 1,
			...focusRingStyles(theme, options)
		})
	};
}

/**
 * Ring overlay for a full-bleed `main`. Drawn inset on its own layer stacked above the positioned
 * AppBar toolbar, which would otherwise paint over an outline set on `main` itself.
 */
export const mainLandmarkSx = createMainLandmarkSx({ inset: true });

/**
 * Same overlay for a `main` framed by Studio chrome, such as the preview page and its panels. The ring
 * goes outside the box so it sits on the app background instead of on the guest page, whose colours
 * Studio does not control (a light site under the dark ring would be about 2.5:1).
 */
export const mainLandmarkOutsetSx = createMainLandmarkSx();

export function focusStudioMainContent(): boolean {
	const main = document.getElementById(STUDIO_MAIN_CONTENT_ID);
	if (!(main instanceof HTMLElement)) {
		return false;
	}
	main.focus();
	return true;
}
