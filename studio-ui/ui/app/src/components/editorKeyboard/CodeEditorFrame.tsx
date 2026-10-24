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

import React, { useId } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { SxProps } from '@mui/system';
import { Theme } from '@mui/material';
import { useIntl } from 'react-intl';
import { consolidateSx } from '../../utils/system';
import { codeEditorKeyboardMessages } from './messages';
import { CODE_EDITOR_BOTTOM_PADDING } from './monacoKeyboard';

export interface CodeEditorFrameProps {
	frameRef: React.Ref<HTMLDivElement>;
	height?: string | number;
	className?: string;
	sx?: SxProps<Theme>;
	children: React.ReactNode;
	onActivate(): void;
}

/**
 * Single tab stop around a Monaco editor. The textarea itself is taken out of
 * the tab order by `enforceMonacoKeyboardOptions`. Enter edits; Esc (handled on
 * the editor) returns here; Tab from this frame moves to the next control.
 * The hint is referenced by `aria-describedby` and must stay visible to AT.
 */
export function CodeEditorFrame(props: CodeEditorFrameProps) {
	const { frameRef, height = '100%', className, sx, children, onActivate } = props;
	const { formatMessage } = useIntl();
	const hintId = useId();
	const instructions = formatMessage(codeEditorKeyboardMessages.instructions);
	const groupLabel = formatMessage(codeEditorKeyboardMessages.groupLabel);

	return (
		<Box
			ref={frameRef}
			className={className}
			tabIndex={0}
			role="group"
			aria-label={groupLabel}
			aria-describedby={hintId}
			onKeyDown={(event) => {
				if (event.key === 'Escape' && event.target !== event.currentTarget) {
					event.stopPropagation();
				}
				if (event.key === 'Enter' && event.target === event.currentTarget) {
					event.preventDefault();
					onActivate();
				}
			}}
			sx={consolidateSx(
				{
					position: 'relative',
					height,
					width: '100%',
					outlineOffset: 2,
					'&:focus-visible': {
						outline: (theme) => `2px solid ${theme.palette.primary.main}`
					}
				},
				sx
			)}
		>
			{children}
			<Typography
				id={hintId}
				component="div"
				title={instructions}
				sx={{
					position: 'absolute',
					left: 0,
					right: 0,
					bottom: 0,
					zIndex: 6,
					boxSizing: 'border-box',
					maxHeight: CODE_EDITOR_BOTTOM_PADDING,
					overflow: 'hidden',
					px: 1,
					py: 0.5,
					pointerEvents: 'none',
					fontSize: 12,
					lineHeight: '20px',
					bgcolor: 'background.paper',
					color: 'text.secondary',
					borderTop: 1,
					borderColor: 'divider'
				}}
			>
				{instructions}
			</Typography>
		</Box>
	);
}

export default CodeEditorFrame;
