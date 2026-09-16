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

import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import { FormattedMessage } from 'react-intl';
import IconButton, { IconButtonProps } from '@mui/material/IconButton';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import Typography from '@mui/material/Typography';
import Button, { ButtonProps } from '@mui/material/Button';
import MoreVertRounded from '@mui/icons-material/MoreVertRounded';
import React, { forwardRef, useRef, useState } from 'react';
import Layout, { LayoutProps } from './Layout';
import Menu, { MenuProps } from '@mui/material/Menu';
import MenuItem, { MenuItemProps } from '@mui/material/MenuItem';

export type EditAppLayoutAction = 'exit' | 'save' | 'viewXml' | 'diff' | 'history' | 'rollback';

type MenuItemOrButtonEvent = Parameters<MenuItemProps['onClick']>[0] | Parameters<ButtonProps['onClick']>[0];

export interface EditAppLayoutProps extends Omit<LayoutProps, 'toolbarContent'> {
	onActionClick(e: MenuItemOrButtonEvent, action: EditAppLayoutAction): void;
	disableSave?: boolean;
	isNew?: boolean;
}

const actionsMap: Record<EditAppLayoutAction, EditAppLayoutAction> = {
	exit: 'exit',
	save: 'save',
	viewXml: 'viewXml',
	diff: 'diff',
	history: 'history',
	rollback: 'rollback'
};

export const EditTypeViewLayout = forwardRef<HTMLDivElement, EditAppLayoutProps>((props, ref) => {
	const [open, setOpen] = useState(false);
	const anchorElRef = useRef(undefined);
	const handleOpenMenuButton: IconButtonProps['onClick'] = () => setOpen(true);
	const handleClose: MenuProps['onClose'] = () => setOpen(false);
	const handleMenuItemClick = (e: MenuItemOrButtonEvent) => {
		setOpen(false);
		const action = e.currentTarget.getAttribute('data-action-id') as EditAppLayoutAction;
		props.onActionClick?.(e, action);
	};
	return (
        <Layout
			{...props}
			ref={ref}
			toolbarContent={
				<>
					<Box
                        sx={{
                            display: "flex",
                            alignItems: "center"
                        }}>
						<Tooltip title={<FormattedMessage defaultMessage="Done" />}>
							<IconButton data-action-id={actionsMap.exit} onClick={handleMenuItemClick} sx={{ mr: 1 }}>
								<ArrowBackRounded />
							</IconButton>
						</Tooltip>
						<Typography variant="h5" component="h1" noWrap>
							{props.isNew ? (
								<FormattedMessage defaultMessage="New Content Type" />
							) : (
								<FormattedMessage defaultMessage="Edit Content Type" />
							)}
						</Typography>
					</Box>
					<Box
                        sx={{
                            display: "flex",
                            alignItems: "center"
                        }}>
						<Button
							variant="contained"
							sx={{ mr: 1 }}
							data-action-id={actionsMap.save}
							onClick={handleMenuItemClick}
							disabled={props.disableSave}
						>
							<FormattedMessage defaultMessage="Save" />
						</Button>
						<IconButton ref={anchorElRef} onClick={handleOpenMenuButton}>
							<MoreVertRounded />
						</IconButton>
						<Menu
							open={open}
							anchorEl={anchorElRef.current}
							onClose={handleClose}
							slotProps={{ list: { 'aria-labelledby': '' } }}
						>
							<MenuItem onClick={handleMenuItemClick} data-action-id={actionsMap.viewXml}>
								<FormattedMessage defaultMessage="View XML" />
							</MenuItem>
							<MenuItem onClick={handleMenuItemClick} data-action-id={actionsMap.diff}>
								<FormattedMessage defaultMessage="Diff" />
							</MenuItem>
							{!props.isNew && (
								<MenuItem onClick={handleMenuItemClick} data-action-id={actionsMap.history}>
									<FormattedMessage defaultMessage="History" />
								</MenuItem>
							)}
							<MenuItem onClick={handleMenuItemClick} data-action-id={actionsMap.rollback}>
								<FormattedMessage defaultMessage="Rollback" />
							</MenuItem>
						</Menu>
					</Box>
				</>
			}
		/>
    );
});

export default EditTypeViewLayout;
