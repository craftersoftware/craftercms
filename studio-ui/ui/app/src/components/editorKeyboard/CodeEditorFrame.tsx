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

import { useId, type ReactNode, type Ref } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { SxProps } from '@mui/system';
import { Theme } from '@mui/material';
import visuallyHidden from '@mui/utils/visuallyHidden';
import { useIntl } from 'react-intl';
import { consolidateSx } from '../../utils/system';
import { focusRingStyles } from '../../styles/focusRing';
import { codeEditorKeyboardMessages } from './messages';

export interface CodeEditorFrameProps {
	frameRef: Ref<HTMLDivElement>;
	height?: string | number;
	className?: string;
	sx?: SxProps<Theme>;
	children: ReactNode;
	/**
	 * Enter on the frame. Return false when the editor is not ready yet; the
	 * frame remembers the key so the caller can focus once the editor exists.
	 */
	onActivate(): boolean;
	/** Read-only editors tell the user Enter moves in, and that Tab does not indent. */
	readOnly?: boolean;
}

/**
 * Single tab stop around a Monaco editor. The textarea itself is taken out of
 * the tab order by `enforceMonacoKeyboardOptions`. Enter edits; Esc (handled on
 * the editor) returns here; Tab from this frame moves to the next control.
 * The hint is the `aria-describedby` target for the short frame name. It is
 * visually hidden until the frame itself has focus (not while typing in the
 * editor), then overlays the bottom edge so the editor height never changes.
 */
export function CodeEditorFrame(props: CodeEditorFrameProps) {
	const { frameRef, height = '100%', className, sx, children, onActivate, readOnly = false } = props;
	const { formatMessage } = useIntl();
	const hintId = useId();
	const instructions = formatMessage(
		readOnly ? codeEditorKeyboardMessages.instructionsReadOnly : codeEditorKeyboardMessages.instructions
	);
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
					const activated = onActivate();
					if (activated === false) {
						event.currentTarget.dataset.craftercmsPendingEnter = 'true';
					} else {
						delete event.currentTarget.dataset.craftercmsPendingEnter;
					}
				}
			}}
			onBlur={(event) => {
				const next = event.relatedTarget;
				if (!(next instanceof Node) || !event.currentTarget.contains(next)) {
					delete event.currentTarget.dataset.craftercmsPendingEnter;
				}
			}}
			sx={consolidateSx(
				{
					display: 'flex',
					flexDirection: 'column',
					height,
					width: '100%',
					minHeight: 0,
					position: 'relative',
					// The editor paints over an inset outline. Draw the ring above the children.
					'&:focus-visible': {
						outline: 'none'
					},
					// The shared Studio ring (styles/focusRing.ts), inset because the editor clips its own edge.
					'&:focus-visible::after': (theme) => ({
						content: '""',
						position: 'absolute',
						inset: 0,
						boxSizing: 'border-box',
						pointerEvents: 'none',
						zIndex: 20,
						...focusRingStyles(theme, { inset: true })
					}),
					'&:focus > [data-code-editor-hint]': {
						position: 'absolute',
						right: 0,
						bottom: 0,
						left: 0,
						zIndex: 25,
						width: 'auto',
						height: 'auto',
						m: 0,
						overflow: 'visible',
						clip: 'auto',
						whiteSpace: 'normal',
						px: 1,
						py: 0.5,
						fontSize: 12,
						lineHeight: '20px',
						bgcolor: 'background.paper',
						color: 'text.secondary',
						borderTop: 1,
						borderColor: 'divider'
					}
				},
				sx
			)}
		>
			<Box sx={{ flex: '1 1 auto', minHeight: 0, width: '100%', overflow: 'hidden' }}>{children}</Box>
			<Typography
				id={hintId}
				component="div"
				data-code-editor-hint=""
				sx={{ ...visuallyHidden, pointerEvents: 'none' }}
			>
				{instructions}
			</Typography>
		</Box>
	);
}

export default CodeEditorFrame;
