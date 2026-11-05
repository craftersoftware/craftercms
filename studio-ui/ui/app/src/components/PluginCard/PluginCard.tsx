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

import React, { useRef, useState } from 'react';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import CardActions from '@mui/material/CardActions';
import { MarketplacePlugin } from '../../models/MarketplacePlugin';
import { defineMessages, useIntl } from 'react-intl';
import MobileStepper from '../MobileStepper/MobileStepper';
import { backgroundColor } from '../../styles/theme';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import cardTitleStyles, { cardSubtitleStyles } from '../../styles/card';
import SecondaryButton from '../SecondaryButton';
import Box from '@mui/material/Box';
import PluginMediaCarousel from '../PluginDetailsView/PluginMediaCarousel';

interface PluginCardProps {
	plugin: MarketplacePlugin;
	isMarketplacePlugin?: boolean;
	inUse?: boolean;
	usePermission?: boolean;
	beingInstalled?: boolean;
	useLabel?: string | React.JSX.Element;
	disableCardActionClick?: boolean;
	onPluginSelected(plugin: MarketplacePlugin, view: number): any;
	onDetails(plugin: MarketplacePlugin, index?: number): any;
}

const messages = defineMessages({
	version: {
		id: 'plugin.version',
		defaultMessage: 'Version'
	},
	license: {
		id: 'plugin.license',
		defaultMessage: 'License'
	},
	crafterCms: {
		id: 'plugin.crafterCMS',
		defaultMessage: 'CrafterCMS'
	},
	by: {
		id: 'plugin.by',
		defaultMessage: 'By'
	},
	noDev: {
		id: 'plugin.noDev',
		defaultMessage: 'No developer specified.'
	},
	use: {
		id: 'plugin.use',
		defaultMessage: 'Use'
	},
	more: {
		id: 'plugin.more',
		defaultMessage: 'More...'
	},
	licenseTooltip: {
		id: 'plugin.licenseTooltip',
		defaultMessage: '{license} license'
	}
});

function PluginCard(props: PluginCardProps) {
	const [index, setIndex] = useState(0);
	const [play, setPlay] = useState(false);
	const {
		onPluginSelected,
		plugin,
		isMarketplacePlugin = true,
		onDetails,
		inUse = false,
		usePermission = true,
		beingInstalled = false,
		disableCardActionClick = false,
		useLabel
	} = props;
	const { media, name, license, id, developer } = plugin;
	const { formatMessage } = useIntl();
	const isGitCard = id === 'GIT';
	const isDuplicateCard = id === 'DUPLICATE';
	const isGitOrDuplicateCard = isGitCard || isDuplicateCard;
	const sliderRef = useRef<{ moveToItem: (itemIndex: number) => void } | null>(null);

	function handleChangeIndex(value: number) {
		setIndex(value);
	}

	function onDotClick(e: any, step: number) {
		e.stopPropagation();
		sliderRef.current?.moveToItem(step);
	}

	function handlePlay() {
		setPlay(true);
	}

	function handleEnded() {
		setPlay(false);
	}

	function onImageClick(e: any, index: number = 0) {
		if (isGitOrDuplicateCard) return false;

		e.stopPropagation();
		e.preventDefault();
		onDetails(plugin, index);
	}

	function renderLicense() {
		return (
			<Tooltip title={formatMessage(messages.licenseTooltip, { license: license.name })}>
				<Box
					sx={{
						fontSize: '11px',
						color: 'gray',
						backgroundColor: '#f5f5f5',
						padding: '2px 5px',
						borderRadius: '5px',
						display: 'inline-block',
						whiteSpace: 'nowrap',
						'& label': {
							marginRight: '5px',
							marginBottom: 0,
							fontWeight: 400
						},
						'& span': {
							color: '#2F2707'
						}
					}}
				>
					<span>{license.name}</span>
				</Box>
			</Tooltip>
		);
	}

	function renderSubtitle() {
		if (developer) {
			if (developer.company) {
				return (
					<Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
						<Typography gutterBottom variant="subtitle2" className="developer" color="textSecondary">
							{formatMessage(messages.by)} {developer.company.name}
						</Typography>
						{renderLicense()}
					</Box>
				);
			} else {
				return developer.people.map((item: any) => item.name).join(',');
			}
		} else {
			return (
				<Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
					<Typography gutterBottom variant="subtitle1" className="developer" color="textSecondary">
						{formatMessage(messages.noDev)}
					</Typography>
					{renderLicense()}
				</Box>
			);
		}
	}

	function renderMedias(id: string) {
		let videos: any = media && media.videos ? { ...media.videos, type: 'video' } : [];
		videos = videos.length ? videos.map((obj: any) => ({ ...obj, type: 'video' })) : [];
		let screenshots: any = media && media.screenshots ? media.screenshots : [];
		const merged = [...videos, ...screenshots];
		return merged.map((item, index) => {
			if (item.type !== 'video') {
				return (
					<Box
						key={index}
						sx={{
							background: isGitOrDuplicateCard ? 'none' : backgroundColor,
							height: isGitOrDuplicateCard ? 'unset' : '180px',
							overflow: 'hidden'
						}}
						onClick={(event) => onImageClick(event, index)}
					>
						{item.icon ? (
							<Box sx={{ pl: '20px', pr: '5px', color: (theme) => theme.palette.text.secondary }}>{item.icon}</Box>
						) : (
							<Box
								component="img"
								sx={{
									width: isGitOrDuplicateCard ? '120px' : '100%',
									height: isGitOrDuplicateCard ? 'unset' : '180px',
									objectFit: isGitOrDuplicateCard ? 'fill' : 'cover'
								}}
								src={item.url}
								alt={item.description}
							/>
						)}
					</Box>
				);
			} else {
				return (
					<Box
						component="video"
						muted
						controls
						key={index}
						autoPlay={play}
						onEnded={handleEnded}
						sx={{
							width: '100%',
							height: '180px',
							outline: 'none',
							background: backgroundColor
						}}
						onPlaying={handlePlay}
					>
						<source src={item.url} type="video/mp4" />
						Your browser does not support the video tag.
					</Box>
				);
			}
		});
	}

	let steps = 0;
	plugin.media && plugin.media.screenshots ? (steps = plugin.media.screenshots.length) : (steps = 0);
	plugin.media && plugin.media.videos ? (steps += plugin.media.videos.length) : (steps += 0);

	return (
		<Card
			sx={{
				maxWidth: '100%',
				minHeight: isGitOrDuplicateCard ? 'unset' : '339px',
				'& .cardTitle': {
					...cardTitleStyles
				},
				'& .cardContent': {
					height: '13.26em',
					padding: '12px 14px 5px 14px',
					position: 'relative'
				},
				'& .cardActions': {
					justifyContent: 'space-around'
				},
				'& .developer': {
					...cardSubtitleStyles,
					WebkitLineClamp: 1,
					marginBottom: 0
				}
			}}
		>
			{!isGitOrDuplicateCard && (
				<CardActionArea
					disabled={disableCardActionClick}
					onClick={(e) => {
						if (isMarketplacePlugin && !plugin.compatible) {
							onImageClick(e);
						} else {
							onPluginSelected(plugin, 1);
						}
					}}
				>
					<CardHeader
						title={name}
						subheader={!isGitOrDuplicateCard ? renderSubtitle() : ''}
						slotProps={{
							title: {
								variant: 'subtitle2',
								component: 'h2',
								className: 'cardTitle'
							},
							subheader: {
								variant: 'subtitle2',
								component: 'h2',
								color: 'textSecondary'
							}
						}}
					/>
				</CardActionArea>
			)}
			<CardActionArea
				disabled={disableCardActionClick}
				onClick={() => {
					onPluginSelected(plugin, 1);
				}}
				sx={isGitOrDuplicateCard ? { display: 'flex', justifyContent: 'start' } : null}
			>
				<PluginMediaCarousel
					ref={sliderRef}
					items={renderMedias(id)}
					onChangeItem={handleChangeIndex}
					sx={{ width: isGitOrDuplicateCard ? 'unset' : '100%' }}
				/>
				{isGitOrDuplicateCard && (
					<CardContent sx={isGitOrDuplicateCard ? { height: 'unset !important' } : null} className="cardContent">
						<Typography gutterBottom variant="subtitle2" component="h2" className="cardTitle">
							{name}
						</Typography>
						<Typography gutterBottom variant="subtitle2" component="h2" color="textSecondary">
							{plugin.description}
						</Typography>
					</CardContent>
				)}
			</CardActionArea>
			{steps > 0 && !isGitOrDuplicateCard && (
				<MobileStepper
					variant="dots"
					steps={steps}
					onDotClick={onDotClick}
					sx={{
						background: 'none',
						borderTop: '1px solid #e4e3e3',
						height: '30px',
						padding: '0',
						cursor: 'pointer'
					}}
					position={'static'}
					activeStep={index}
				/>
			)}
			{!isGitOrDuplicateCard && (
				<CardActions className={'cardActions'}>
					{((isMarketplacePlugin && plugin.compatible) || !isMarketplacePlugin) && ( // if it's from marketplace and compatible, or not from marketplace (private bps)
						<SecondaryButton
							color="primary"
							disabled={!usePermission || inUse || beingInstalled}
							loading={beingInstalled}
							onClick={() => onPluginSelected(plugin, 1)}
							sx={{ width: '50%' }}
						>
							{useLabel ? useLabel : formatMessage(messages.use)}
						</SecondaryButton>
					)}
					<Button
						sx={{
							width: '50%',
							textAlign: 'center',
							color: (theme) => theme.palette.text.secondary,
							flex: 1
						}}
						onClick={() => onDetails(plugin)}
					>
						{formatMessage(messages.more)}
					</Button>
				</CardActions>
			)}
		</Card>
	);
}

export default PluginCard;
