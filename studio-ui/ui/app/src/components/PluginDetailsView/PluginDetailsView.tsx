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

import React, { forwardRef, type ReactNode, useImperativeHandle, useRef, useState } from 'react';
import Typography from '@mui/material/Typography';
import MobileStepper from '../MobileStepper/MobileStepper';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { MarketplacePlugin } from '../../models/MarketplacePlugin';
import Fab from '@mui/material/Fab';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Grid from '@mui/material/Grid';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Alert, { alertClasses } from '@mui/material/Alert';
import { backgroundColor } from '../../styles/theme';
// @ts-ignore
import { fadeIn } from 'react-animations';
import PrimaryButton from '../PrimaryButton';
import PluginDocumentation from '../PluginDocumentation';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import NavigateNextRoundedIcon from '@mui/icons-material/NavigateNextRounded';
import NavigateBeforeRoundedIcon from '@mui/icons-material/NavigateBeforeRounded';
import PluginMediaCarousel from './PluginMediaCarousel';

const messages = defineMessages({
	use: {
		id: 'common.use',
		defaultMessage: 'Use'
	},
	version: {
		id: 'common.version',
		defaultMessage: 'Version'
	},
	developer: {
		id: 'common.developer',
		defaultMessage: 'Developer'
	},
	website: {
		id: 'common.website',
		defaultMessage: 'Website'
	},
	license: {
		id: 'common.license',
		defaultMessage: 'License'
	},
	craftercms: {
		id: 'common.craftercms',
		defaultMessage: 'CrafterCMS'
	}
});

interface PluginDetailsViewProps {
	plugin: MarketplacePlugin;
	selectedImageSlideIndex?: number;
	changeImageSlideInterval?: number;
	isMarketplacePlugin?: boolean;
	useLabel?: string | React.JSX.Element;
	usePermission?: boolean;
	inUse?: boolean;
	beingInstalled?: boolean;

	onCloseDetails(event: any): any;

	onBlueprintSelected(blueprint: MarketplacePlugin, view: number): any;
}

export function PluginDetailsView(props: PluginDetailsViewProps) {
	const [play, setPlay] = useState(false);
	const {
		plugin,
		onBlueprintSelected,
		onCloseDetails,
		selectedImageSlideIndex = 0,
		isMarketplacePlugin = true,
		inUse = false,
		usePermission = true,
		beingInstalled = false,
		useLabel
	} = props;
	const [index, setIndex] = useState(selectedImageSlideIndex);
	const { media, name, description, version, license, developer, website, compatible } = plugin;
	const fullVersion = version ? `${version.major}.${version.minor}.${version.patch}` : null;
	const sliderRef = useRef<{ moveToItem: (itemIndex: number) => void } | null>(null);

	const { formatMessage } = useIntl();

	function handleChangeIndex(value: number) {
		setIndex(value);
	}

	function onDotClick(e: any, step: number) {
		e.stopPropagation();
		setIndex(step);
		sliderRef.current?.moveToItem(step);
	}

	function handlePlay() {
		setPlay(true);
	}

	function handleEnded() {
		setPlay(false);
	}

	function renderMedias() {
		let videos: any = media && media.videos ? { ...media.videos, type: 'video' } : [];
		videos = videos.length ? videos.map((obj: any) => ({ ...obj, type: 'video' })) : [];
		let screenshots: any = media && media.screenshots ? media.screenshots : [];
		const merged = [...videos, ...screenshots];

		return merged.map((item, index) => {
			if (item.type !== 'video') {
				return (
					<Box key={index} sx={{ background: (theme) => theme.palette.background.default, height: '340px' }}>
						<Box
							component="img"
							sx={{
								width: '100%',
								height: '340px',
								objectFit: 'contain'
							}}
							src={item.url}
							alt={item.description}
						/>
					</Box>
				);
			} else {
				return (
					<Box
						component="video"
						key={index}
						controls
						sx={{
							width: '100%',
							height: '300px',
							outline: 'none',
							'&:focus-visible': {
								outline: '2px solid #FFFFFF',
								outlineOffset: '2px',
								boxShadow: '0 0 0 2px #000000'
							},
							background: backgroundColor
						}}
						autoPlay={play}
						onPlaying={handlePlay}
						onEnded={handleEnded}
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
		<Box sx={{ height: '100%', overflow: 'auto', animation: `${fadeIn} 1s` }}>
			<Box sx={{ display: 'flex', padding: '20px', alignItems: 'center' }}>
				<Fab
					aria-label="back"
					sx={{
						color: '#4F4F4F',
						backgroundColor: '#FFFFFF',
						marginRight: '30px',
						'&:hover': {
							backgroundColor: '#FFFFFF'
						}
					}}
					onClick={onCloseDetails}
				>
					<ArrowBackIcon />
				</Fab>
				<Typography variant="h5" component="h1">
					{name}
				</Typography>
				{((isMarketplacePlugin && compatible) || !isMarketplacePlugin) && ( // if it's from marketplace and compatible, or not from marketplace (private bps)
					<PrimaryButton
						variant="contained"
						color="primary"
						sx={{ marginLeft: 'auto', maxHeight: '36px' }}
						disabled={!usePermission || inUse || beingInstalled}
						loading={beingInstalled}
						onClick={() => onBlueprintSelected(plugin, 1)}
					>
						{useLabel ? useLabel : formatMessage(messages.use)}
					</PrimaryButton>
				)}
			</Box>

			<PluginMediaCarousel
				ref={sliderRef}
				items={renderMedias()}
				initialIndex={selectedImageSlideIndex}
				onChangeItem={handleChangeIndex}
			/>

			{steps > 1 && (
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
					position="static"
					activeStep={index}
				/>
			)}
			<Box sx={{ position: 'relative', padding: '20px' }}>
				<Grid container spacing={3}>
					<Grid size={{ xs: 12, md: 8 }}>
						{isMarketplacePlugin && !compatible && (
							<Alert
								severity="error"
								sx={(theme) => ({
									marginBottom: '15px',
									backgroundColor: theme.palette.error.light,
									[`& .${alertClasses.icon}`]: {
										color: theme.palette.error.main
									},
									[`& .${alertClasses.message}`]: {
										color: theme.palette.error.contrastText
									}
								})}
							>
								<FormattedMessage
									id="pluginDetails.notCompatible"
									defaultMessage="This blueprint is not compatible with your current version of CrafterCMS."
								/>
							</Alert>
						)}
						<Typography variant="body1">{description}</Typography>
						<PluginDocumentation plugin={plugin} />
					</Grid>
					<Grid size={{ xs: 12, md: 4 }}>
						<Box sx={{ marginBottom: '5px' }}>
							{developer && <Typography variant="subtitle2">{formatMessage(messages.developer)}</Typography>}
							{developer && developer.company && (
								<Typography variant="subtitle2" color={'textSecondary'}>
									{developer.company.name}
								</Typography>
							)}
							{developer && developer.people && (
								<Typography variant="subtitle2" color={'textSecondary'}>
									{developer.people.name}
								</Typography>
							)}
						</Box>
						<Box sx={{ marginBottom: '5px' }}>
							{website && <Typography variant="subtitle2">{formatMessage(messages.website)}</Typography>}
							{website && website.name && (
								<Typography variant="subtitle2" component="p">
									<Box
										component="a"
										sx={{
											color: (theme) => theme.palette.text.secondary,
											'& svg': {
												verticalAlign: 'sub',
												fontSize: '1.1rem'
											}
										}}
										href={website.url}
										target={'blank'}
									>
										{website.name} <OpenInNewIcon />
									</Box>
								</Typography>
							)}
						</Box>
						<Box
							sx={(theme) => ({
								display: 'flex',
								padding: 0,
								alignitems: 'center',
								marginTop: '10px',
								'& .chip': {
									fontSize: '12px',
									color: 'gray',
									marginRight: theme.spacing(1),
									backgroundColor: theme.palette.background.default,
									padding: '5px',
									borderRadius: '5px',
									'& label': {
										display: 'block',
										marginBottom: 0,
										fontWeight: 400
									},
									'& span': {
										color: theme.palette.text.primary
									}
								}
							})}
						>
							<div className="chip">
								<label>{formatMessage(messages.version)}</label>
								<span>{fullVersion}</span>
							</div>
							<div className="chip">
								<label>{formatMessage(messages.license)}</label>
								<span>{license.name}</span>
							</div>
						</Box>
					</Grid>
				</Grid>
			</Box>
		</Box>
	);
}

export default PluginDetailsView;
