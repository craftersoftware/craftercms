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

import { ContentItem } from '../../models/Item';
import React, { useState } from 'react';
import ListItemButton from '@mui/material/ListItemButton';
import Checkbox from '@mui/material/Checkbox';
import IconButton from '@mui/material/IconButton';
import MoreVertIcon from '@mui/icons-material/MoreVertRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { isFolder, isNavigable, isPreviewable } from './utils';
import Tooltip from '@mui/material/Tooltip';
import { defineMessages, useIntl } from 'react-intl';
import ItemDisplay from '../ItemDisplay';

export interface NavItemProps {
	item: ContentItem;
	locale: string;
	isActive?: boolean;
	isCurrentPath?: boolean;
	isLevelDescriptor?: boolean;
	isSelectMode?: boolean;
	showItemNavigateToButton?: boolean;
	onItemClicked?(item: ContentItem, event?: React.MouseEvent): void;
	onChangeParent?(item: ContentItem): void;
	onPreview?(item: ContentItem): void;
	onItemChecked?(item: ContentItem, unselect: boolean): void;
	onOpenItemMenu?(element: Element, item: ContentItem): void;
}

const translations = defineMessages({
	viewChildren: {
		id: 'pathNavigator.viewChildren',
		defaultMessage: 'View children'
	},
	noChildren: {
		id: 'pathNavigator.noChildren',
		defaultMessage: 'Item has no children'
	},
	itemMenu: {
		id: 'words.options',
		defaultMessage: 'Options'
	}
});

// PathNavigatorListItem
function PathNavigatorItem(props: NavItemProps) {
	const {
		item,
		isActive = false,
		isCurrentPath = false,
		onItemClicked,
		onChangeParent,
		onPreview,
		isSelectMode,
		onItemChecked,
		onOpenItemMenu,
		isLevelDescriptor = false,
		showItemNavigateToButton = true
	} = props;
	const [over, setOver] = useState(false);
	const { formatMessage } = useIntl();
	const onMouseOver = isSelectMode ? null : () => setOver(true);
	const onMouseLeave = isSelectMode ? null : () => setOver(false);
	const onClick = (e) => onItemClicked?.(item, e);
	const onContextMenu = (e) => {
		if (onOpenItemMenu) {
			e.preventDefault();
			onOpenItemMenu(e.currentTarget.querySelector('[data-item-menu]'), item);
		}
	};
	const navigable = isNavigable(item);
	const previewable = isPreviewable(item);
	const folder = isFolder(item);
	const isLeaf = item.childrenCount === 0;
	return (
		<ListItemButton
			selected={isActive}
			// TODO: must update this to support select mode
			// button={!isSelectMode as true}
			sx={[
				(theme) => ({
					minHeight: '23.5px',
					padding: '0 0 0 5px',
					marginLeft: '15px',
					width: 'calc(100% - 15px)',
					'&:hover': {
						backgroundColor: theme.palette.mode === 'dark' ? theme.palette.action.hover : theme.palette.grey['A200']
					}
				}),
				isSelectMode && { paddingLeft: 0 },
				isCurrentPath && {
					paddingLeft: 0,
					marginLeft: '10px',
					width: 'auto'
				}
			]}
			onMouseOver={onMouseOver}
			onMouseLeave={onMouseLeave}
			onClick={onClick}
			onContextMenu={onContextMenu}
		>
			{isSelectMode && (
				<Checkbox
					sx={{ p: 0.75 }}
					size="small"
					color="primary"
					onClick={(e) => e.stopPropagation()}
					onChange={(e) => {
						onItemChecked(item, e.currentTarget.checked);
					}}
				/>
			)}
			<ItemDisplay
				sxs={{
					root: {
						flex: 1,
						minWidth: 0
					}
				}}
				item={item}
				showPublishingTarget={!isSelectMode}
				showWorkflowState={!isSelectMode}
				labelTypographyProps={{ variant: 'body2' }}
			/>
			{over && onOpenItemMenu && (
				<Tooltip title={formatMessage(translations.itemMenu)}>
					<IconButton
						aria-label={formatMessage(translations.itemMenu)}
						sx={{
							padding: '2px 3px',
							'&.Mui-disabled': {
								// Want the hover to trigger so the tooltip shows up.
								pointerEvents: 'all'
							}
						}}
						data-item-menu
						onClick={(event) => {
							event.stopPropagation();
							onOpenItemMenu(event.currentTarget, item);
						}}
						size="large"
					>
						<MoreVertIcon sx={{ fontSize: '1.2rem' }} />
					</IconButton>
				</Tooltip>
			)}
			{over && showItemNavigateToButton && !isLevelDescriptor && !isLeaf && (
				<Tooltip title={formatMessage(translations.viewChildren)}>
					<IconButton
						aria-label={formatMessage(translations.viewChildren)}
						sx={{
							padding: '2px 3px',
							'&.Mui-disabled': {
								// Want the hover to trigger so the tooltip shows up.
								pointerEvents: 'all'
							}
						}}
						onClick={(event) => {
							event.preventDefault();
							event.stopPropagation();
							if (isLeaf) {
								return;
							} else if (navigable || folder) {
								onChangeParent?.(item);
							} else if (previewable) {
								onPreview?.(item);
							}
						}}
						size="large"
					>
						<ChevronRightRoundedIcon sx={{ fontSize: '1.2rem' }} />
					</IconButton>
				</Tooltip>
			)}
		</ListItemButton>
	);
}

export default PathNavigatorItem;
