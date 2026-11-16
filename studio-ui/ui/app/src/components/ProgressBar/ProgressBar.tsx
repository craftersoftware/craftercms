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
import Box from '@mui/material/Box';

export interface ProgressBarProps {
	status: 'failed' | 'complete';
	progress: number;
}

export function ProgressBar(props: ProgressBarProps) {
	const { status, progress } = props;
	return (
		<Box
			sx={{
				position: 'absolute',
				bottom: 0,
				left: 0,
				width: '100%',
				height: '3px',
				transition: 'height .2s'
			}}
		>
			<Box
				sx={{
					backgroundColor: (theme) =>
						status === 'failed'
							? theme.palette.error.main
							: progress === 100
								? theme.palette.success.main
								: theme.palette.primary.main,
					height: '100%',
					width: 0,
					transition: status === 'failed' ? 'width 0.4s ease' : 'background-color 0.5s ease'
				}}
				style={{ width: `${progress}%` }}
			/>
		</Box>
	);
}

export default ProgressBar;
