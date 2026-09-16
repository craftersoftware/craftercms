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

import { DrawerProps, Theme } from '@mui/material';
import Drawer from '@mui/material/Drawer';
import React, { useCallback, useRef, useState } from 'react';
import palette from '../../styles/palette';
import { PartialSxRecord } from '../../models';
import { DrawerClasses } from '@mui/material/Drawer';
import { SxProps } from '@mui/system';
import { SystemStyleObject } from '@mui/system/styleFunctionSx';
import Box from '@mui/material/Box';

export type ResizeableDrawerClassKey =
	| 'root'
	| 'drawerBody'
	| 'drawerPaper'
	| 'drawerPaperLeft'
	| 'drawerPaperRight'
	| 'drawerPaperBelowToolbar'
	| 'resizeHandle'
	| 'resizeHandleActive'
	| 'resizeHandleLeft'
	| 'resizeHandleRight'
	| 'resizingOverlay';

interface ResizeableDrawerProps extends DrawerProps {
	open: boolean;
	width: number;
	maxWidth?: number;
	minWidth?: number;
	belowToolbar?: boolean;
	classes?: DrawerProps['classes'] & Partial<Record<ResizeableDrawerClassKey, string>>;
	sxs?: PartialSxRecord<ResizeableDrawerClassKey> & PartialSxRecord<keyof DrawerClasses>;
	onWidthChange?(width: number): void;
	onResizeStart?(): void;
	onResizeStop?(): void;
}

export function ResizeableDrawer(props: ResizeableDrawerProps) {
	const [resizeActive, setResizeActive] = useState(false);

	const drawerRef = useRef<HTMLDivElement>(undefined);

	const {
		open,
		children,
		width,
		maxWidth = 500,
		minWidth = 240,
		onWidthChange,
		onResizeStart,
		onResizeStop,
		className,
		classes = {},
		slotProps,
		anchor = 'left',
		belowToolbar = false,
		sxs = {},
		...rest
	} = props;

	const { ...drawerClasses } = classes;

	const handleMouseMove = useCallback(
		(e) => {
			if (onWidthChange) {
				e.preventDefault();
				let newWidth =
					(anchor === 'left'
						? e.clientX - drawerRef.current.getBoundingClientRect().left
						: window.innerWidth - (e.clientX - drawerRef.current.getBoundingClientRect().left)) + 5;
				newWidth = newWidth < minWidth ? minWidth : newWidth > maxWidth ? maxWidth : newWidth;
				onWidthChange(newWidth);
			}
		},
		[anchor, onWidthChange, maxWidth, minWidth]
	);

	const handleMouseDown = onWidthChange
		? () => {
				setResizeActive(true);
				onResizeStart?.();
				const handleMouseUp = () => {
					setResizeActive(false);
					onResizeStop?.();
					document.removeEventListener('mouseup', handleMouseUp, true);
					document.removeEventListener('mousemove', handleMouseMove, true);
				};
				document.addEventListener('mouseup', handleMouseUp, true);
				document.addEventListener('mousemove', handleMouseMove, true);
			}
		: null;

	const drawerPaperSxProp = [
		{
			bottom: 0,
			overflow: 'hidden',
			maxWidth: '95% !important',
			backgroundColor: (theme) => theme.palette.background.default,
			...sxs?.paper,
			...sxs?.drawerPaper
		},
		belowToolbar && {
			// TODO: make the toolbar height a global const
			top: 57,
			height: 'auto',
			zIndex: (theme) => theme.zIndex.appBar - 1,
			...sxs?.drawerPaperBelowToolbar
		},
		onWidthChange &&
			(anchor === 'left'
				? {
						borderRight: 'none',
						...sxs?.drawerPaperLeft
					}
				: {
						borderLeft: 'none',
						...sxs?.drawerPaperRight
					}),
		resizeActive && {
			'&::before': {
				content: '""',
				position: 'fixed',
				top: 0,
				bottom: 0,
				left: 0,
				right: 0,
				...sxs?.resizingOverlay
			}
		}
	];

	return (
		<Drawer
			open={open}
			ref={drawerRef}
			anchor={anchor}
			variant="persistent"
			className={[className, classes?.root].filter(Boolean).join(' ')}
			sx={{
				flexShrink: 0,
				...sxs?.root
			}}
			slotProps={{
				paper: {
					...(slotProps?.paper ?? {}),
					style: { width },
					className: [classes?.drawerPaper, belowToolbar && classes?.drawerPaperBelowToolbar].filter(Boolean).join(' '),
					sx: drawerPaperSxProp as SxProps<Theme>
				}
			}}
			{...rest}
		>
			{onWidthChange && (
				<Box
					onMouseDown={handleMouseDown}
					className={[
						classes?.resizeHandle,
						resizeActive && classes?.resizeHandleActive,
						anchor === 'left' ? classes?.resizeHandleRight : classes?.resizeHandleLeft
					]
						.filter(Boolean)
						.join(' ')}
					sx={{
						width: resizeActive ? '4px' : '2px',
						cursor: 'ew-resize',
						padding: '4px 0 0',
						position: 'absolute',
						top: 0,
						bottom: 0,
						zIndex: 100,
						backgroundColor: (theme) => (resizeActive ? palette.blue.tint : theme.palette.divider),
						transition: 'width 200ms',
						visibility: 'visible',
						'&:hover': {
							width: '4px',
							visibility: 'visible',
							backgroundColor: palette.blue.tint
						},
						...(anchor === 'left'
							? ({ right: 0, ...sxs?.resizeHandleRight } as SystemStyleObject<Theme>)
							: ({ left: 0, ...sxs?.resizeHandleLeft } as SystemStyleObject<Theme>)),
						...(sxs?.resizeHandle as SystemStyleObject<Theme>),
						...(sxs?.resizeHandleActive as SystemStyleObject<Theme>)
					}}
				/>
			)}
			<Box
				component="section"
				className={classes?.drawerBody}
				sx={{
					width: '100%',
					height: '100%',
					overflowY: 'auto',
					...sxs?.drawerBody
				}}
			>
				{children}
			</Box>
		</Drawer>
	);
}

export default ResizeableDrawer;
