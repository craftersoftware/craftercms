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

import React, { useState } from 'react';
import { useIntl } from 'react-intl';
import Box from '@mui/material/Box';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import Avatar from '@mui/material/Avatar';
import DragIndicatorRounded from '@mui/icons-material/DragIndicatorRounded';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import MoreVertRounded from '@mui/icons-material/MoreVertRounded';
import { darken, useTheme } from '@mui/material/styles';
import { getAvatarWithIconColors } from '../../utils/contentType';

interface PanelListItemProps {
	primaryText: string;
	secondaryText?: string;
	avatarSrc?: string;
	avatarColorBase?: string;
	onDragStart?: (...args: any) => any;
	onDragEnd?: (...args: any) => any;
	onMenu?: (e: React.MouseEvent<HTMLButtonElement>) => void;
	isBeingDragged?: boolean;
}

export function DraggablePanelListItem(props: PanelListItemProps) {
	const {
		onMenu,
		primaryText,
		avatarSrc,
		avatarColorBase,
		secondaryText,
		onDragStart,
		onDragEnd,
		isBeingDragged = false
	} = props;
	const hasMenu = Boolean(onMenu);
	const theme = useTheme();
	const { formatMessage } = useIntl();
	const { backgroundColor, textColor } = getAvatarWithIconColors(avatarColorBase ?? primaryText, theme, darken);
	const [over, setOver] = useState(false);
	return (
		<Box
			component="li"
			onMouseEnter={() => setOver(true)}
			onMouseLeave={() => setOver(false)}
			sx={{
				display: 'flex',
				alignItems: 'center',
				border: `1px solid ${isBeingDragged ? backgroundColor : 'transparent'}`,
				borderRadius: isBeingDragged ? 2 : 0
			}}
		>
			<Box
				draggable
				onDragStart={onDragStart}
				onDragEnd={onDragEnd}
				sx={(theme) => ({
					display: 'flex',
					alignItems: 'center',
					flex: 1,
					minWidth: 0,
					py: 1,
					pl: 1.5,
					pr: 2,
					cursor: isBeingDragged ? 'grabbing' : 'grab',
					transition: theme.transitions.create('background-color', { duration: theme.transitions.duration.shortest }),
					'&:hover': { backgroundColor: theme.palette.action.hover }
				})}
			>
				<ListItemAvatar sx={{ minWidth: 0 }}>
					<Avatar
						alt=""
						src={avatarSrc}
						sx={{
							mr: 1.5,
							width: 30,
							height: 30,
							backgroundColor: over || avatarSrc ? 'transparent' : backgroundColor,
							transition: 'background-color 0.25s ease-in-out'
						}}
					>
						<DragIndicatorRounded
							fontSize="small"
							sx={{
								color: over ? backgroundColor : textColor,
								transition: 'color 0.25s ease-in-out'
							}}
						/>
					</Avatar>
				</ListItemAvatar>
				<ListItemText primary={primaryText} secondary={secondaryText} />
			</Box>
			{hasMenu && (
				<Box sx={{ display: 'flex', flexShrink: 0, mr: 0.5 }}>
					<IconButton
						onClick={onMenu}
						size="small"
						aria-label={formatMessage({ defaultMessage: 'Options for {name}' }, { name: primaryText })}
					>
						<MoreVertRounded />
					</IconButton>
				</Box>
			)}
		</Box>
	);
}

export default DraggablePanelListItem;
