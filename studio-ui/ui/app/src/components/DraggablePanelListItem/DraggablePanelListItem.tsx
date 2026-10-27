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
import ListItemAvatar from '@mui/material/ListItemAvatar';
import Avatar from '@mui/material/Avatar';
import DragIndicatorRounded from '@mui/icons-material/DragIndicatorRounded';
import AddCircleOutlineRounded from '@mui/icons-material/AddCircleOutlineRounded';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import MoreVertRounded from '@mui/icons-material/MoreVertRounded';
import Tooltip from '@mui/material/Tooltip';
import Box from '@mui/material/Box';
import { useIntl } from 'react-intl';
import { darken, useTheme } from '@mui/material/styles';
import ListItemButton from '@mui/material/ListItemButton';
import { getAvatarWithIconColors } from '../../utils/contentType';
import ListItem from '@mui/material/ListItem';

interface PanelListItemProps {
	primaryText: string;
	secondaryText?: string;
	avatarSrc?: string;
	avatarColorBase?: string;
	onDragStart?: (...args: any) => any;
	onDragEnd?: (...args: any) => any;
	onMenu?: (e: React.MouseEvent<HTMLButtonElement>) => void;
	/** Non-drag equivalent of dragging this item onto a drop zone. */
	onInsert?: () => void;
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
		onInsert,
		isBeingDragged = false
	} = props;
	const hasMenu = Boolean(onMenu);
	const { formatMessage } = useIntl();
	const theme = useTheme();
	const { backgroundColor, textColor } = getAvatarWithIconColors(avatarColorBase ?? primaryText, theme, darken);
	const [over, setOver] = useState(false);
	return (
		<ListItemButton
			role="option"
			component={ListItem}
			disableRipple
			key={secondaryText}
			draggable
			onDragStart={onDragStart}
			onDragEnd={onDragEnd}
			onMouseEnter={() => setOver(true)}
			onMouseLeave={() => setOver(false)}
			sx={{
				pl: 1.5,
				pr: hasMenu ? 6 : undefined,
				border: `1px solid ${isBeingDragged ? backgroundColor : 'transparent'}`,
				borderRadius: isBeingDragged ? 2 : 0,
				cursor: isBeingDragged ? 'grabbing' : 'grab'
			}}
			secondaryAction={
				hasMenu || onInsert ? (
					<Box sx={{ display: 'flex' }}>
						{onInsert && (
							<Tooltip title={formatMessage({ defaultMessage: 'Insert into drop target' })}>
								<IconButton
									edge="end"
									size="small"
									aria-label={formatMessage(
										{ defaultMessage: 'Insert {name} into a drop target' },
										{ name: primaryText }
									)}
									onMouseDown={(event) => event.stopPropagation()}
									onClick={(event) => {
										event.stopPropagation();
										onInsert();
									}}
								>
									<AddCircleOutlineRounded />
								</IconButton>
							</Tooltip>
						)}
						{hasMenu && (
							<Tooltip title={formatMessage({ defaultMessage: 'Options' })}>
								<IconButton
									edge="end"
									size="small"
									aria-label={formatMessage({ defaultMessage: 'Options for {name}' }, { name: primaryText })}
									onClick={onMenu}
								>
									<MoreVertRounded />
								</IconButton>
							</Tooltip>
						)}
					</Box>
				) : null
			}
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
		</ListItemButton>
	);
}

export default DraggablePanelListItem;
