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

import MenuItem from '@mui/material/MenuItem';
import MenuList from '@mui/material/MenuList';
import EmptyState from '../EmptyState/EmptyState';
import { FormattedMessage, useIntl } from 'react-intl';
import Typography from '@mui/material/Typography';
import ItemDisplay from '../ItemDisplay';
import ItemStateIcon from '../ItemStateIcon/ItemStateIcon';
import { getItemPublishingTargetText, getItemStateText, isInWorkflow } from '../ItemDisplay/utils';
import React, { ReactNode } from 'react';
import Popover, { PopoverOrigin, PopoverPosition, PopoverProps, PopoverReference } from '@mui/material/Popover';
import palette from '../../styles/palette';
import { SystemIconDescriptor } from '../SystemIcon';
import { ContentItem } from '../../models/Item';
import { ContextMenuOption } from '../ContextMenu/ContextMenu';
import GlobalState from '../../models/GlobalState';
import Skeleton from '@mui/material/Skeleton';
import ItemPublishingTargetIcon from '../ItemPublishingTargetIcon/ItemPublishingTargetIcon';
import useUnmount from '../../hooks/useUnmount';
import { PartialSxRecord } from '../../models';
import Box from '@mui/material/Box';
import { SystemStyleObject } from '@mui/system/styleFunctionSx/styleFunctionSx';
import { Theme } from '@mui/material';

export type ItemMegaMenuUIClassKey =
	| 'root'
	| 'mainItem'
	| 'actionsContainer'
	| 'actionsColumn'
	| 'emptyRoot'
	| 'itemsList'
	| 'itemInfo'
	| 'itemInfoContentType'
	| 'itemEdited'
	| 'itemEditedText'
	| 'itemState'
	| 'menuItem'
	| 'itemDisplayRoot'
	| 'itemTypeIcon'
	| 'itemTypography'
	| 'icon';

export interface MenuOption {
	id: string;
	icon?: SystemIconDescriptor;
	label: ReactNode;
}

export interface ItemMegaMenuUIProps {
	open: boolean;
	classes?: Partial<Record<ItemMegaMenuUIClassKey, string>>;
	sxs?: PartialSxRecord<ItemMegaMenuUIClassKey>;
	isLoading?: boolean;
	numOfLoaderItems?: number;
	item: ContentItem;
	options: ContextMenuOption[][];
	editorialOptions: ContextMenuOption[];
	nonEditorialOptions: ContextMenuOption[][];
	anchorEl?: PopoverProps['anchorEl'];
	anchorOrigin?: PopoverOrigin;
	anchorReference?: PopoverReference;
	anchorPosition?: PopoverPosition;
	contentType: string;
	locale: GlobalState['uiConfig']['locale'];
	onClose?(): void;
	onClosed?(): void;
	onMenuItemClicked(option: string, event: React.MouseEvent<Element, MouseEvent>): void;
}

export function ItemMegaMenuUI(props: ItemMegaMenuUIProps) {
	const {
		open,
		item,
		isLoading = false,
		numOfLoaderItems = 5,
		options,
		editorialOptions,
		nonEditorialOptions,
		anchorEl,
		anchorOrigin,
		anchorReference,
		anchorPosition,
		contentType,
		locale,
		classes,
		sxs,
		onClose,
		onClosed,
		onMenuItemClicked
	} = props;
	const isFolder = item?.systemType === 'folder';
	const inWorkflow = isInWorkflow(item?.stateMap);
	const { formatMessage } = useIntl();

	return (
		<Popover
			open={open}
			onClose={onClose}
			anchorEl={anchorEl}
			anchorOrigin={anchorOrigin}
			anchorReference={anchorReference}
			anchorPosition={anchorPosition}
			slotProps={{
				paper: {
					className: classes?.root,
					sx: {
						maxWidth: 400,
						borderRadius: '12px',
						...sxs?.root
					}
				}
			}}
			sx={{
				'& .menu-section': {
					padding: '10px 20px',
					cursor: 'default',
					backgroundColor: 'inherit !important',
					'&:hover': {
						backgroundColor: 'inherit'
					},
					...(sxs?.mainItem as SystemStyleObject<Theme>)
				},
				'& .actions-container': {
					display: 'flex',
					flexDirection: 'row',
					padding: '10px',
					...(sxs?.actionsContainer as SystemStyleObject<Theme>)
				},
				'& .actions-column': {
					display: 'flex',
					flexDirection: 'column',
					flexBasis: '100%',
					flex: '1',
					'&:first-child': {
						marginRight: '60px'
					},
					...(sxs?.actionsColumn as SystemStyleObject<Theme>)
				}
			}}
		>
			<Box
				component="section"
				className={['menu-section', classes?.itemInfo].join(' ')}
				sx={{
					display: 'block',
					borderBottom: `1px solid ${palette.gray.light4}`,
					...sxs?.itemInfo
				}}
			>
				<Typography
					variant="body2"
					sx={{
						color: (theme) => theme.palette.text.secondary,
						marginBottom: '4px',
						...sxs?.itemInfoContentType
					}}
				>
					{isLoading ? <Skeleton animation="wave" /> : contentType}
				</Typography>
				{isLoading ? (
					<Skeleton animation="wave" />
				) : (
					<ItemDisplay
						item={item}
						labelComponent="h2"
						showPublishingTarget={false}
						showWorkflowState={false}
						classes={{ root: classes?.itemDisplayRoot, icon: classes?.itemTypeIcon }}
						sxs={{
							root: { marginBottom: '5px', ...sxs?.itemDisplayRoot },
							icon: { fontSize: '0.8rem', verticalAlign: 'middle', ...sxs?.itemTypeIcon }
						}}
						labelTypographyProps={{
							className: classes?.itemTypography,
							sx: {
								color: (theme) => theme.palette.text.primary,
								...sxs?.itemTypography
							}
						}}
					/>
				)}
				{isLoading ? (
					<Skeleton animation="wave" />
				) : (
					<Box className={classes?.itemState} sx={{ '&> *': { marginRight: '5px' }, ...sxs?.itemState }}>
						{/* @see https://github.com/craftersoftware/craftercms/issues/5442 */}
						{!isFolder &&
							(inWorkflow ? (
								<>
									<ItemStateIcon
										item={item}
										className={classes?.icon}
										sxs={{ root: { fontSize: '0.8rem', verticalAlign: 'middle', ...sxs?.icon } }}
									/>
									<Typography variant="body2" component="span">
										{getItemStateText(item?.stateMap, formatMessage, {
											user: item?.lockOwner?.username,
											draft: item?.savedAsDraft
										})}
									</Typography>
								</>
							) : (
								<>
									<ItemPublishingTargetIcon
										item={item}
										className={classes?.icon}
										sxs={{ root: { fontSize: '0.8rem', verticalAlign: 'middle', ...sxs?.icon } }}
									/>
									<Typography variant="body2" component="span">
										{getItemPublishingTargetText(item?.stateMap, formatMessage)}
									</Typography>
								</>
							))}
					</Box>
				)}
			</Box>
			{isLoading ? (
				<Box className={['actions-container', classes?.actionsContainer].join(' ')}>
					{new Array(2).fill(null).map((value, i) => (
						<MenuList
							key={i}
							className={['actions-column', classes?.itemsList].join(' ')}
							sx={{ padding: 0, ...sxs?.itemsList }}
						>
							{new Array(Math.ceil(numOfLoaderItems / 2)).fill(null).map((value, j) => (
								<MenuItem key={j} className={classes?.menuItem} sx={{ minWidth: '100px', ...sxs?.menuItem }}>
									<Skeleton animation="wave" width="100%" />
								</MenuItem>
							))}
						</MenuList>
					))}
				</Box>
			) : options.flatMap((i) => i).length === 0 ? (
				<EmptyState
					title={
						<FormattedMessage id="contextMenu.emptyOptionsMessage" defaultMessage="No options available to display." />
					}
				/>
			) : (
				<Box className={['actions-container', classes?.itemsList].join(' ')}>
					<MenuList className={['actions-column', classes?.itemsList].join(' ')} sx={{ padding: 0, ...sxs?.itemsList }}>
						{editorialOptions.map((option: MenuOption, y: number) => (
							<MenuItem
								dense
								autoFocus={y === 0}
								key={option.id}
								onClick={(e) => onMenuItemClicked(option.id, e)}
								className={classes?.menuItem}
								sx={{ minWidth: '100px', ...sxs?.menuItem }}
								children={option.label}
							/>
						))}
					</MenuList>
					<div className={['actions-column', classes?.actionsColumn].join(' ')}>
						{nonEditorialOptions.map((section: any, i: number) => (
							<MenuList key={i} className={classes?.itemsList} sx={{ padding: 0, ...sxs?.itemsList }}>
								{section.map((option: MenuOption, y: number) => (
									<MenuItem
										dense
										key={option.id}
										divider={i !== nonEditorialOptions.length - 1 && y === section.length - 1}
										onClick={(e) => onMenuItemClicked(option.id, e)}
										className={classes?.menuItem}
										sx={{
											minWidth: '100px',
											...sxs?.menuItem
										}}
										children={option.label}
									/>
								))}
							</MenuList>
						))}
					</div>
				</Box>
			)}
			<Box
				component="section"
				className={['menu-section', classes?.itemEdited].join(' ')}
				sx={{
					paddingTop: '12px',
					borderTop: `1px solid ${palette.gray.light4}`,
					...sxs?.itemEdited
				}}
			>
				{isLoading ? (
					<Skeleton animation="wave" width="100%" />
				) : (
					<>
						<Typography variant="body2" color="text.secondary" title={item.path} noWrap>
							{item.path}
						</Typography>
						<Typography variant="body2">
							<FormattedMessage
								id="itemMegaMenu.editedBy"
								defaultMessage="{edited} {date} {byLabel} {by}"
								values={{
									date: new Intl.DateTimeFormat(locale.localeCode, locale.dateTimeFormatOptions).format(
										new Date(item?.dateModified)
									),
									by: item?.modifier?.username ?? '',
									edited: (
										<Box
											component="span"
											className={classes?.itemEditedText}
											sx={{ color: (theme) => theme.palette.text.secondary, fontWeight: 600, ...sxs?.itemEditedText }}
										>
											<FormattedMessage id="words.edited" defaultMessage="Edited" />
										</Box>
									),
									byLabel: item?.modifier?.username ? (
										<Box
											component="span"
											className={classes?.itemEditedText}
											sx={{ color: (theme) => theme.palette.text.secondary, fontWeight: 600, ...sxs?.itemEditedText }}
										>
											<FormattedMessage id="words.by" defaultMessage="By" />
										</Box>
									) : (
										''
									)
								}}
							/>
						</Typography>
					</>
				)}
			</Box>
			<Unmount onClosed={onClosed} />
		</Popover>
	);
}

function Unmount(props: { onClosed?(): void }) {
	useUnmount(props.onClosed);
	return null;
}

export default ItemMegaMenuUI;
