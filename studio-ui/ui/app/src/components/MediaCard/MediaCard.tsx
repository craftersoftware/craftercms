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

import Card from '@mui/material/Card';
import CardHeader, { cardHeaderClasses, CardHeaderProps } from '@mui/material/CardHeader';
import CardMedia, { cardMediaClasses } from '@mui/material/CardMedia';
import CardActionArea from '@mui/material/CardActionArea';
import { MediaItem } from '../../models/Search';
import FormGroup from '@mui/material/FormGroup';
import Checkbox from '@mui/material/Checkbox';
import cardTitleStyles, { cardSubtitleStyles } from '../../styles/card';
import palette from '../../styles/palette';
import SystemIcon from '../SystemIcon';
import Box from '@mui/material/Box';
import { PartialSxRecord } from '../../models/CustomRecord';
import { CSSSelectorObjectOrCssVariables } from '@mui/system/styleFunctionSx';
import { consolidateSx } from '../../utils/system';
import { useIntl } from 'react-intl';
import type { KeyboardEvent } from 'react';
import { getFocusRingSx } from '../../styles/focusRing';

export type MediaCardViewModes = 'card' | 'compact' | 'row';

type MediaCardClassKey = 'root' | 'checkbox' | 'media' | 'mediaIcon' | 'cardActionArea' | 'cardHeader';

export interface MediaCardProps {
	item: MediaItem;
	showPath?: boolean;
	selected?: Array<string>;
	previewAppBaseUri: string;
	viewMode?: MediaCardViewModes;
	action?: CardHeaderProps['action'];
	avatar?: CardHeaderProps['avatar'];
	disableSelection?: boolean;
	/**
	 * Single selection without the checkbox. When set together with `onClick`, a transparent toggle
	 * covers the header in the tab order: Enter or Space runs `onClick`, and `aria-pressed` reports
	 * this value. The toggle is not an ancestor of the title heading or the path, so both stay exposed.
	 * Its accessible name is the item name and, when the path is shown, the path. Clicking the card
	 * works as before. The toggle uses the header's action slot, so `action` is not rendered in this mode.
	 */
	isSelected?: boolean;
	classes?: Partial<Record<MediaCardClassKey, string>>;
	sxs?: PartialSxRecord<MediaCardClassKey>;
	onClick?(e): void;
	onPreview?(e): any;
	onSelect?(path: string, selected: boolean): any;
	// TODO: Fix types
	onDragStart?(...args: any): any;
	onDragEnd?(...args: any): any;
}

function MediaCard(props: MediaCardProps) {
	// region const { ... } = props
	const {
		onSelect,
		selected,
		item,
		previewAppBaseUri,
		showPath = true,
		onClick,
		onPreview = onClick,
		action,
		avatar,
		onDragStart,
		onDragEnd,
		viewMode = 'card',
		disableSelection,
		isSelected,
		sxs
	} = props;
	// endregion
	const keyboardSelectable = typeof isSelected === 'boolean' && Boolean(onClick) && !onSelect;
	let { name, path, type } = item;
	const selectionLabel = showPath ? `${name}, ${item.path}` : name;
	if (item.mimeType.includes('audio/')) {
		type = 'Audio';
	}
	let iconMap = {
		Page: '@mui/icons-material/InsertDriveFileOutlined',
		Video: '@mui/icons-material/VideocamOutlined',
		Template: '@mui/icons-material/CodeRounded',
		Taxonomy: '@mui/icons-material/LocalOfferOutlined',
		Component: '@mui/icons-material/ExtensionOutlined',
		Groovy: '@mui/icons-material/CodeRounded',
		JavaScript: '@mui/icons-material/CodeRounded',
		CSS: '@mui/icons-material/CodeRounded',
		Audio: '@mui/icons-material/AudiotrackOutlined'
	};
	let icon = { id: iconMap[type] ?? '@mui/icons-material/InsertDriveFileOutlined' };
	const systemIcon = <SystemIcon icon={icon} svgIconProps={{ className: 'media-icon' }} />;
	const { formatMessage } = useIntl();
	const media =
		type === 'Image' ? (
			<CardMedia
				className={props.classes?.media}
				image={`${previewAppBaseUri}${path}`}
				title={name}
				sx={{ height: 0, paddingTop: '56.25%', ...sxs?.media }}
			/>
		) : (
			<Box
				className={props.classes?.mediaIcon}
				sx={[
					{
						paddingTop: '56.25%',
						position: 'relative',
						overflow: 'hidden',
						'& .media-icon': {
							position: 'absolute',
							top: '50%',
							left: '50%',
							transform: 'translate(-50%, -50%)',
							color: palette.gray.medium4,
							fontSize: '50px'
						},
						'&.list': {
							height: '80px',
							width: '80px',
							paddingTop: '0',
							order: -1
						}
					},
					viewMode === 'row' && { paddingTop: '0 !important', height: '80px', width: '80px' },
					sxs?.mediaIcon as CSSSelectorObjectOrCssVariables
				]}
			>
				{type === 'Video' ? (
					<Box
						component="video"
						sx={{
							position: 'absolute',
							top: '50%',
							left: '50%',
							transform: 'translate(-50%, -50%)',
							width: '100%'
						}}
					>
						<source src={path} type="video/mp4" />
						{systemIcon}
					</Box>
				) : (
					systemIcon
				)}
			</Box>
		);

	return (
		<Card
			className={props.classes?.root}
			draggable={Boolean(onDragStart || onDragEnd)}
			onDragStart={onDragStart}
			onDragEnd={onDragEnd}
			onClick={onClick}
			sx={consolidateSx(
				{ position: 'relative' },
				viewMode === 'row' && {
					display: 'flex',
					width: '100%',
					[`& .${cardHeaderClasses.root}`]: { flexGrow: 1 },
					[`& .${cardMediaClasses.root}`]: { paddingTop: '0 !important', height: '80px !important', width: '80px' }
				},
				sxs?.root
			)}
		>
			<CardHeader
				classes={{ root: props.classes?.cardHeader }}
				sx={{
					alignSelf: 'center',
					// The toggle is positioned against the header, on the same box the ring used to use.
					...(keyboardSelectable && { position: 'relative' }),
					...sxs?.cardHeader
				}}
				action={
					keyboardSelectable ? (
						<Box
							role="button"
							tabIndex={0}
							aria-pressed={isSelected}
							aria-disabled={disableSelection || undefined}
							aria-label={selectionLabel}
							onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
								if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
								e.preventDefault();
								if (!disableSelection) onClick(e);
							}}
							sx={{
								position: 'absolute',
								inset: 0,
								// Clicks keep going to the card. The control is only a keyboard tab stop.
								pointerEvents: 'none',
								// Inset, because the card clips anything drawn outside it.
								'&:focus-visible': getFocusRingSx({ inset: true })
							}}
						/>
					) : (
						action
					)
				}
				avatar={
					onSelect ? (
						<FormGroup className={props.classes?.checkbox} sx={sxs?.checkbox}>
							<Checkbox
								checked={selected.includes(path)}
								disabled={disableSelection}
								onClick={(e: any) => !disableSelection && onSelect(path, e.target.checked)}
								color="primary"
								size="small"
								aria-label={formatMessage({ defaultMessage: 'Select {name}' }, { name })}
							/>
						</FormGroup>
					) : (
						avatar
					)
				}
				title={name}
				subheader={showPath ? item.path : null}
				slotProps={{
					action: keyboardSelectable
						? {
								// The slot's own margins and flex basis would shift the title. Collapse it;
								// the toggle is taken out of flow and covers the header.
								sx: {
									m: 0,
									flex: '0 0 auto',
									width: 0,
									height: 0,
									overflow: 'visible',
									pointerEvents: 'none'
								}
							}
						: undefined,
					content: {
						sx: {
							flexGrow: 1,
							minWidth: 0
						}
					},
					title: {
						variant: 'subtitle2',
						component: 'h2',
						sx: {
							whiteSpace: 'nowrap',
							overflow: 'hidden',
							textOverflow: 'ellipsis',
							width: '100%',
							...cardTitleStyles
						},
						title: item.name
					},
					subheader: {
						variant: 'subtitle2',
						component: 'div',
						sx: {
							...cardSubtitleStyles,
							'&&': {
								display: '-webkit-box'
							},
							WebkitLineClamp: 2
						},
						title: item.path
					}
				}}
			/>
			{viewMode !== 'compact' &&
				(onPreview ? (
					<CardActionArea
						className={props.classes?.cardActionArea}
						sx={sxs?.cardActionArea}
						disableRipple={Boolean(onDragStart || onDragEnd)}
						onClick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							onPreview(e);
						}}
						aria-label={name}
					>
						{media}
					</CardActionArea>
				) : (
					media
				))}
		</Card>
	);
}

export default MediaCard;
