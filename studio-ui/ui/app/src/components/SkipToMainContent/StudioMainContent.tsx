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

import React, { PropsWithChildren } from 'react';
import Box from '@mui/material/Box';
import { SxProps } from '@mui/system';
import { Theme } from '@mui/material/styles';
import { mainLandmarkSx, STUDIO_MAIN_CONTENT_ID } from './studioMainContent';

export type StudioMainContentProps = PropsWithChildren<{ sx?: SxProps<Theme> }>;

/**
 * The page's single `main` landmark and the target of `SkipToMainContent`. One per document.
 * Exposed to the legacy page templates (which render outside React Router) as a registered component.
 */
export function StudioMainContent(props: StudioMainContentProps) {
	const { children, sx } = props;
	return (
		<Box
			component="main"
			id={STUDIO_MAIN_CONTENT_ID}
			tabIndex={-1}
			sx={[mainLandmarkSx, ...(Array.isArray(sx) ? sx : [sx])]}
		>
			{children}
		</Box>
	);
}

export default StudioMainContent;
