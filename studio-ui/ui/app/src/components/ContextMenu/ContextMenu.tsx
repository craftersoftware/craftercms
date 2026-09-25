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

import React, { ElementType, ReactNode } from 'react';
import Menu, { MenuProps } from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import { FormattedMessage } from 'react-intl';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
import { rand } from '../PathNavigator/utils';
import Skeleton from '@mui/material/Skeleton';

import { SystemIcon, SystemIconDescriptor } from '../SystemIcon';
import { PartialSxRecord } from '../../models';
import Box from '@mui/material/Box';

export interface ContextMenuOption {
	id: string;
	icon?: SystemIconDescriptor;
	label: ReactNode;
}

export type ContextMenuClassKey = 'menuItem' | 'emptyRoot' | 'loadingRoot';

export interface ContextMenuProps extends MenuProps {
	isLoading?: boolean;
	numOfLoaderItems?: number;
	classes?: MenuProps['classes'] & Partial<Record<ContextMenuClassKey, string>>;
	sxs?: PartialSxRecord<ContextMenuClassKey>;
	options: Array<Array<ContextMenuOption>>;
	emptyState?: {
		icon?: ElementType;
		message: string;
	};
	onMenuItemClicked(optionId: string, event: React.MouseEvent<Element, MouseEvent>): void;
}

export function ContextMenu(props: ContextMenuProps) {
	const {
		options,
		classes: propClasses,
		sxs,
		onMenuItemClicked,
		emptyState,
		isLoading = false,
		numOfLoaderItems = 5,
		...menuProps
	} = props;
	return (
		<Menu {...menuProps} classes={propClasses}>
			{isLoading ? (
				<Box
					className={propClasses?.loadingRoot}
					sx={{
						width: '135px',
						padding: '0 15px',
						...sxs?.loadingRoot
					}}
				>
					{new Array(numOfLoaderItems).fill(null).map((value, i) => (
						<Typography key={i} variant="body2" style={{ width: `${rand(85, 100)}%`, padding: '6px 0' }}>
							<Skeleton animation="wave" width="100%" />
						</Typography>
					))}
				</Box>
			) : options.flatMap((i) => i).length === 0 ? (
				<Box
					className={propClasses?.emptyRoot}
					sx={{
						display: 'block',
						padding: '10px',
						textAlign: 'center',
						...sxs?.emptyRoot
					}}
				>
					<ErrorOutlineOutlinedIcon fontSize="small" />
					<Typography
						variant="caption"
						sx={{
							display: 'block'
						}}
					>
						{emptyState?.message || (
							<FormattedMessage
								id="contextMenu.emptyOptionsMessage"
								defaultMessage="No options available to display."
							/>
						)}
					</Typography>
				</Box>
			) : (
				options.map((section: any, i: number) =>
					section.map((option: ContextMenuOption, y: number) => (
						<MenuItem
							dense
							key={option.id}
							divider={i !== options.length - 1 && y === section.length - 1}
							onClick={(e) => onMenuItemClicked(option.id, e)}
							className={propClasses?.menuItem}
							sx={sxs?.menuItem}
						>
							<Typography variant="body2">{option.label}</Typography>
							{option.icon && <SystemIcon icon={option.icon} sx={{ ml: 1 }} />}
						</MenuItem>
					))
				)
			)}
		</Menu>
	);
}

export default ContextMenu;
