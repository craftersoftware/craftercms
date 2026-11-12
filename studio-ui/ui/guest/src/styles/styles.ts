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

import { createTheme, type Theme, type ThemeOptions } from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';
import { getStudioPaletteOptions } from '@craftercms/studio-ui/styles/palette';
import { getOverlayBoundarySx } from '@craftercms/studio-ui/styles/overlayStroke';
import { useMemo } from 'react';
import type { DropMarkerPartialSx, ZoneMarkerPartialSx } from '../react';
import type { SxProps } from '@mui/system';

/** The Experience Builder theme. `useGuestTheme` picks the mode from the page colour scheme. */
export function createGuestTheme(mode: 'light' | 'dark', styleConfig?: ThemeOptions): Theme {
	return createTheme(
		{
			palette: {
				// Same mode mapping as the Studio theme (CrafterThemeProvider).
				mode,
				...getStudioPaletteOptions(mode),
				// Pick a label colour that reaches 4.5:1, like the Studio theme.
				contrastThreshold: 4.5
			},
			typography: {
				fontFamily: '"Source Sans Pro", "Open Sans", sans-serif',
				fontSize: 16
			}
		},
		styleConfig
	);
}

export function useGuestTheme(styleConfig: ThemeOptions): Theme {
	const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
	return useMemo(
		() => createGuestTheme(prefersDarkMode ? 'dark' : 'light', styleConfig),
		[prefersDarkMode, styleConfig]
	);
}

type GuestStyleSxKeys = 'base' | 'selectModeHighlight' | 'moveModeHighlight';

export interface GuestStylesSx {
	zoneMarker: Record<GuestStyleSxKeys | 'errorHighlight' | 'warnHighlight' | 'disabledHighlight', ZoneMarkerPartialSx>;
	dropMarker: Record<GuestStyleSxKeys, DropMarkerPartialSx>;
	ghostElement: SxProps<Theme>;
}

export const styleSxDefaults: Partial<GuestStylesSx> = {
	zoneMarker: {
		base: {},
		// Text is getContrastText of the fill it sits on. .contrastText is computed for .main.
		selectModeHighlight: {
			paper: {
				bgcolor: 'success.light',
				color: (theme) => theme.palette.getContrastText(theme.palette.success.light)
			},
			box: getOverlayBoundarySx((theme) => theme.palette.success.main),
			icon: {
				color: (theme) => theme.palette.getContrastText(theme.palette.success.light)
			}
		},
		moveModeHighlight: {
			paper: {
				bgcolor: 'primary.light',
				color: (theme) => theme.palette.getContrastText(theme.palette.primary.light)
			},
			box: getOverlayBoundarySx((theme) => theme.palette.primary.main),
			icon: {
				color: (theme) => theme.palette.getContrastText(theme.palette.primary.light)
			}
		},
		errorHighlight: {
			paper: {
				bgcolor: 'error.light',
				color: (theme) => theme.palette.getContrastText(theme.palette.error.light)
			},
			box: getOverlayBoundarySx((theme) => theme.palette.error.main),
			icon: {
				color: (theme) => theme.palette.getContrastText(theme.palette.error.light)
			}
		},
		warnHighlight: {
			paper: {
				bgcolor: 'warning.light',
				color: (theme) => theme.palette.getContrastText(theme.palette.warning.light)
			},
			box: getOverlayBoundarySx((theme) => theme.palette.warning.main),
			icon: {
				color: (theme) => theme.palette.getContrastText(theme.palette.warning.light)
			}
		},
		disabledHighlight: {
			paper: {
				bgcolor: (theme) => theme.palette.grey[400],
				color: (theme) => theme.palette.getContrastText(theme.palette.grey[400])
			},
			box: getOverlayBoundarySx((theme) => theme.palette.border.control),
			icon: {
				color: (theme) => theme.palette.getContrastText(theme.palette.grey[400])
			}
		}
	},
	dropMarker: {
		base: {},
		selectModeHighlight: {},
		moveModeHighlight: {}
	}
};
