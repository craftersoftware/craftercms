/*
 * Copyright (C) 2007-2025 Crafter Software Corporation. All Rights Reserved.
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

import React, { forwardRef, ReactNode, useImperativeHandle, useRef, useState } from 'react';
import { useResizeObserver } from '../../../hooks/useResizeObserver';
import Box, { BoxProps } from '@mui/material/Box';
import ViewToolbar from '../../ViewToolbar';
import Container, { ContainerProps } from '@mui/material/Container';
import type { ToolbarProps } from '@mui/material/Toolbar';
import { getMarginSxProps } from '../../../utils/ui';
import Main from './MainSection';
import Drawer, { DrawerProps } from '@mui/material/Drawer';
import { paperClasses } from '@mui/material/Paper';
import Dialog, { DialogProps } from '@mui/material/Dialog';
import { SxProps, useTheme } from '@mui/material/styles';
import { Theme } from '@emotion/react';

export interface LayoutProps {
	open: boolean;
	sx?: BoxProps['sx'];
	style?: BoxProps['style'];
	mainContent: ReactNode;
	drawerContent: ReactNode;
	toolbarContent: ReactNode;
	onClose: DialogProps['onClose'];
	drawerProps?: DrawerProps;
}

export const Layout = forwardRef<HTMLDivElement, LayoutProps>((props, ref) => {
	const { open, mainContent, drawerContent, toolbarContent, sx, style, drawerProps } = props;

	const theme = useTheme();
	const [useDrawer, setUseDrawer] = useState(true);
	const [drawerWidth, setDrawerWidth] = useState(500);

	// Resize observer attached to the [scroll] container
	const containerRef = useRef<HTMLDivElement>(undefined);
	const toolbarRef = useRef<HTMLDivElement>(undefined);
	useResizeObserver(containerRef, () => {
		const container = containerRef.current;
		const toolbar = toolbarRef.current;
		const rect: DOMRect = container.getBoundingClientRect();
		const toolbarRect: DOMRect = toolbar.getBoundingClientRect();
		const width = rect.width;
		const useDrawer = width >= 900;
		container.style.setProperty('--container-width', `${width}px`);
		container.style.setProperty('--container-height', `${rect.height - toolbarRect.height - 1}px`);
		// Want at least 500px for the drawer and at least 400px for the main area (i.e. 900px).
		setUseDrawer(useDrawer);
		// Drawer to take up 55% of the container.
		setDrawerWidth(width * 0.55);
	});

	useImperativeHandle(ref, () => containerRef.current);

	return (
		<Box
			ref={containerRef}
			style={style}
			sx={[
				{
					height: '100%',
					display: 'flex',
					flexDirection: 'column',
					overflow: 'hidden',
					bgcolor: 'background.default'
				},
				...(Array.isArray(sx) ? sx : [sx])
			]}
		>
			<ViewToolbar
				ref={toolbarRef}
				slotProps={{
					toolbar: {
						component: Container,
						maxWidth: open && useDrawer ? false : 'lg'
					} as Partial<ToolbarProps & ContainerProps>
				}}
			>
				{toolbarContent}
			</ViewToolbar>
			<Box
				sx={{
					position: 'relative',
					flexGrow: 1,
					...getMarginSxProps()
				}}
			>
				<Main
					open={useDrawer && open}
					drawerWidth={drawerWidth}
					sx={{ height: 'var(--container-height)', overflow: 'auto', py: 2 }}
				>
					<Container maxWidth="lg" className="space-y-2">
						{mainContent}
					</Container>
				</Main>
				{useDrawer ? (
					<Drawer
						open={open}
						anchor="right"
						variant="persistent"
						sx={{
							flexShrink: 0,
							width: drawerWidth,
							height: 'var(--container-height)',
							[`& > .${paperClasses.root}`]: {
								position: 'absolute',
								width: drawerWidth,
								boxSizing: 'border-box',
								bgcolor: 'background.default'
							}
						}}
						{...drawerProps}
					>
						{drawerContent}
					</Drawer>
				) : (
					<Dialog
						open={open}
						onClose={props.onClose}
						maxWidth="md"
						slotProps={{
							paper: {
								sx: {
									'--container-height': `calc(100vh - ${theme.spacing(8)})`,
									'--container-width': `calc(100vw - ${theme.spacing(8)})`,
									bgcolor: 'background.default',
									height: 'var(--container-height)'
								}
							}
						}}
					>
						{drawerContent}
					</Dialog>
				)}
			</Box>
		</Box>
	);
});

export default Layout;
