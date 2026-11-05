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

import React, { useCallback, useState } from 'react';
import Box from '@mui/material/Box';
import palette from '../../styles/palette';

export interface ResizeBarProps {
	onWidthChange(width: number): void;
	element?: HTMLElement;
}

export function ResizeBar(props: ResizeBarProps) {
	const [resizeActive, setResizeActive] = useState(false);
	const { onWidthChange, element } = props;

	const handleMouseMove = useCallback(
		(e) => {
			e.preventDefault();
			if (element) {
				const containerOffsetLeft = element.getBoundingClientRect().left;
				const newWidth = e.clientX - containerOffsetLeft - 5;

				onWidthChange(newWidth);
			}
		},
		[element, onWidthChange]
	);

	const handleMouseDown = () => {
		setResizeActive(true);
		const handleMouseUp = () => {
			setResizeActive(false);
			document.removeEventListener('mouseup', handleMouseUp, true);
			document.removeEventListener('mousemove', handleMouseMove, true);
		};
		document.addEventListener('mouseup', handleMouseUp, true);
		document.addEventListener('mousemove', handleMouseMove, true);
	};

	return (
		<Box
			onMouseDown={handleMouseDown}
			sx={{
				width: resizeActive ? '4px' : '2px',
				minWidth: '2px',
				margin: '0px 5px',
				cursor: 'ew-resize',
				padding: '4px 0 0',
				backgroundColor: resizeActive ? palette.blue.tint : 'rgba(0, 0, 0, 0.12)',
				transition: 'width 200ms',
				visibility: resizeActive ? 'visible' : 'hidden',
				'&:hover': {
					width: '4px',
					visibility: 'visible',
					backgroundColor: palette.blue.tint
				}
			}}
		/>
	);
}

export default ResizeBar;
