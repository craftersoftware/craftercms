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

import React, { PropsWithChildren, useMemo } from 'react';
import { useTheme } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { PREVIEW_TOOLBAR_NARROW_QUERY, withPreviewToolbarTooltipDelays } from './previewToolbarTooltip';

/**
 * At max-width 480px, tooltips rendered under this node use the longer hover delays.
 * Wider widths render children with the same app theme, so the tree shape does not change at 480/481px.
 * Mount it only around the preview toolbar so other tooltips keep today's delays.
 */
export function PreviewToolbarTooltipTiming({ children }: PropsWithChildren) {
	const theme = useTheme();
	const narrow = useMediaQuery(PREVIEW_TOOLBAR_NARROW_QUERY);
	const tooltipTheme = useMemo(() => withPreviewToolbarTooltipDelays(theme, narrow), [theme, narrow]);
	// Always render the provider. Swapping `children` for `<ThemeProvider>{children}</ThemeProvider>` at 480/481px
	// changes the element type above ToolBar, so React remounts the whole toolbar (focus and typed text are lost).
	return <ThemeProvider theme={tooltipTheme}>{children}</ThemeProvider>;
}
