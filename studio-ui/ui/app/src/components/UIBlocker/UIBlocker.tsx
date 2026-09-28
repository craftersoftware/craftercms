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

import React from 'react';
import Modal, { ModalProps } from '@mui/material/Modal';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import CircularProgress from '@mui/material/CircularProgress';
import { SxProps } from '@mui/system';
import { Theme } from '@mui/material/styles';

export interface UIBlockerProps extends Omit<ModalProps, 'children' | 'components' | 'componentsProps' | 'container'> {
	title?: string;
	message?: string;
	progress?: 'indeterminate' | number;
}

export interface UIBlockerStateProps extends Pick<
	UIBlockerProps,
	'progress' | 'open' | 'className' | 'sx' | 'style' | 'message' | 'title'
> {}

export function UIBlocker(props: UIBlockerProps) {
	const { message, progress = 'indeterminate', title, ...modalProps } = props;
	const hasMessage = Boolean(message);
	const isIndeterminateProgress = progress === 'indeterminate';
	const ProgressComponent = hasMessage ? LinearProgress : CircularProgress;
	const progressValue = isIndeterminateProgress ? void 0 : progress;
	const progressVariant = isIndeterminateProgress ? 'indeterminate' : 'determinate';
	const progressSx: SxProps<Theme> = hasMessage
		? {
				position: 'absolute',
				bottom: '0',
				width: '100%',
				left: '0',
				borderBottomLeftRadius: '3px',
				borderBottomRightRadius: '3px'
			}
		: void 0;
	const onClose: ModalProps['onClose'] = () => false;
	return (
		<Modal onClose={onClose} aria-labelledby="uiBlockerModalModalTitle" {...modalProps}>
			<Paper
				sx={{
					p: 4,
					top: '50%',
					left: '50%',
					position: 'absolute',
					transform: 'translate(-50%, -50%)'
				}}
			>
				{title && <Typography variant="h6">{title}</Typography>}
				<Typography id="uiBlockerModalModalTitle">{message}</Typography>
				{(progress || !hasMessage) && (
					<ProgressComponent variant={progressVariant} value={progressValue} sx={progressSx} />
				)}
			</Paper>
		</Modal>
	);
}

export default UIBlocker;
