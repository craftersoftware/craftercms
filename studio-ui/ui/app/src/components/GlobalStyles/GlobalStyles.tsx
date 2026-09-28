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

				// TinyMCE dialogs render into a body-level `.tox-tinymce-aux` sink, but the fullscreen
				// editor lives inside the MUI modal's stacking context (z-index: modal). Tiny's skin drops
				// the sink to 1201 in fullscreen, leaving its dialogs behind the editor.
				'.tox.tox-tinymce-aux, .tox-fullscreen .tox.tox-tinymce-aux, .tox-fullscreen ~ .tox.tox-tinymce-aux': {
					zIndex: `${theme.zIndex.modal + 1} !important`
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
