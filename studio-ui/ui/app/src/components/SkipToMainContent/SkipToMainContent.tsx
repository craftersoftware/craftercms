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

import React from 'react';
import Box from '@mui/material/Box';
import { visuallyHidden } from '@mui/utils';
import { useIntl } from 'react-intl';
import { focusStudioMainContent } from './studioMainContent';

/**
 * First-focusable bypass for repeated shell chrome. Hidden until focused.
 * Distinct from SkipToActionsLink, which moves focus to a dialog's action group.
 */
export function SkipToMainContent() {
	const { formatMessage } = useIntl();
	return (
		<Box
			component="button"
			type="button"
			onClick={() => {
				focusStudioMainContent();
			}}
			sx={{
				...visuallyHidden,
				// A button, not an anchor: the hash router would treat href="#studioMainContent"
				// as a route, including on middle-click and "Open in new tab".
				border: 0,
				padding: 0,
				margin: 0,
				background: 'transparent',
				font: 'inherit',
				color: 'inherit',
				textAlign: 'left',
				cursor: 'pointer',
				zIndex: (theme) => theme.zIndex.tooltip,
				'&:focus, &:focus-visible': {
					clipPath: 'none',
					width: 'auto',
					height: 'auto',
					margin: 0,
					overflow: 'visible',
					position: 'fixed',
					top: (theme) => theme.spacing(1),
					left: (theme) => theme.spacing(1),
					padding: (theme) => theme.spacing(1, 2),
					backgroundColor: 'background.paper',
					color: 'text.primary',
					whiteSpace: 'normal',
					outline: '2px solid',
					outlineColor: 'primary.main',
					outlineOffset: '2px'
				}
			}}
		>
			{formatMessage({ id: 'skipToMainContent.label', defaultMessage: 'Skip to main content' })}
		</Box>
	);
}

export default SkipToMainContent;
