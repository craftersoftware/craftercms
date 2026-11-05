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

import * as React from 'react';
import { CssBaseline } from '@mui/material';
import { Global, Theme } from '@emotion/react';
import { staticGlobalStyles } from './css';
import { useTheme } from '@mui/material/styles';
import { useMemo } from 'react';
import { Interpolation } from '@emotion/styled';
import { typographyStyles } from './typography';
import { focusRingOffset, focusRingStyles, focusRingWidth } from '../../styles/focusRing';
import { TOAST_HOST_CLASS } from '../NotistackVariant/NotistackVariant';

export interface GlobalStylesProps {
	cssBaseline?: boolean;
}

export function GlobalStyles(props: GlobalStylesProps) {
	const { cssBaseline = true } = props;
	const theme = useTheme();
	const dynamicStyles = useMemo(
		() =>
			({
				body: { background: theme.palette.background.paper },

				'.minimized-bar-portal-root': {
					right: '0',
					bottom: '20px',
					display: 'flex',
					position: 'fixed',
					flexDirection: 'row-reverse',
					width: '100%',
					overflow: 'auto',
					padding: '2px 20px',
					zIndex: theme.zIndex.modal,
					pointerEvents: 'none',
					'& > *': {
						pointerEvents: 'all'
					}
				},

				// A native anchor or link in a toast message is not a ButtonBase, so the theme's focusVisible
				// never reaches it and the browser's default ring would sit on the toast's dark surface.
				// `.TOAST_HOST_CLASS` is set by both toast content components. ButtonBase is excluded from both
				// arms: those belong to the theme ring. Kept separate so the toast owns its halo, not the ring.
				[`.${TOAST_HOST_CLASS} :is(a, [role="link"]):not(.MuiButtonBase-root):focus-visible`]: focusRingStyles(theme, {
					// The halo reaches past the ring, as MUI's 0 0 0 4px halo does for ButtonBase children;
					// a gap-only halo would leave the ring's outer edge against the toast.
					shadow: `0 0 0 ${focusRingOffset + focusRingWidth}px ${theme.palette.background.paper}`
				}),

				// TinyMCE dialogs render into a body-level `.tox-tinymce-aux` sink, but the fullscreen
				// editor lives inside the MUI modal's stacking context (z-index: modal). Tiny's skin drops
				// the sink to 1201 in fullscreen, leaving its dialogs behind the editor. Matching the modal
				// z-index (rather than exceeding it) lets DOM order decide, so MUI dialogs opened from a
				// Tiny dialog (e.g. media pickers) still stack on top.
				'.tox-fullscreen .tox.tox-tinymce-aux, .tox-fullscreen ~ .tox.tox-tinymce-aux': {
					zIndex: `${theme.zIndex.modal} !important`
				}
			}) as Interpolation<Theme>,
		[theme.palette.background.paper, theme.zIndex.modal]
	);
	return (
		<>
			{cssBaseline && <CssBaseline enableColorScheme />}
			<Global styles={dynamicStyles} />
			<Global styles={staticGlobalStyles} />
			<Global styles={typographyStyles} />
		</>
	);
}

export default GlobalStyles;
