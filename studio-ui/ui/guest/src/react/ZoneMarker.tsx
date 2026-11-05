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

import React, { CSSProperties, ReactNode, useEffect, useRef, useState } from 'react';
import { getZoneMarkerStyle } from '../utils/dom';
import { Box, Paper, Popper, Theme, Typography, useTheme } from '@mui/material';
import { SxProps } from '@mui/system';
import { FullSxRecord, PartialClassRecord, PartialSxRecord } from '@craftercms/studio-ui/models/CustomRecord';
import LevelDescriptorIcon from '@craftercms/studio-ui/icons/LevelDescriptor';
import FieldIcon from '@craftercms/studio-ui/icons/ContentTypeField';
import LockedStateIcon from '@craftercms/studio-ui/icons/Lock';
import Person from '@craftercms/studio-ui/models/Person';
import { darken, styled } from '@mui/material/styles';
import LookupTable from '@craftercms/studio-ui/src/models/LookupTable';
import AllowedContentTypesData from '@craftercms/studio-ui/models/AllowedContentTypesData';
import { ContentType, ContentTypeField } from '@craftercms/studio-ui/models/ContentType';
import { getCachedContentTypes } from '../contentController';
import { getAvatarWithIconColors } from '@craftercms/studio-ui/utils/contentType';
import UltraStyledTypography from './UltraStyledTypography';
import UltraStyledTooltip from './UltraStyledTooltip';
import { SystemCssProperties } from '@mui/system/styleFunctionSx';
import { FormattedMessage, useIntl } from 'react-intl';
import { type ItemStateMap } from '@craftercms/studio-ui/src/models/Item';
import { defineMessages } from 'react-intl';

const AllowedTypeCircle = styled('div')({
	width: 20,
	height: 20,
	borderStyle: `solid`,
	borderWidth: `1px`,
	borderRadius: '20px',
	display: 'inline-block',
	marginRight: '2px'
});

export type ZoneMarkerClassKey = 'box' | 'paper' | 'icon' | 'tooltip' | 'menuItemsContainer';

export type ZoneMarkerFullSx = FullSxRecord<ZoneMarkerClassKey>;

export type ZoneMarkerPartialSx = PartialSxRecord<ZoneMarkerClassKey>;

export interface ZoneMarkerProps {
	rect: DOMRect;
	label: string;
	inherited: boolean;
	showZoneTooltip?: boolean;
	menuItems?: ReactNode;
	lockInfo?: Person;
	isStale?: boolean;
	isEditable: boolean;
	onPopperClick?(e: React.MouseEvent<HTMLDivElement, MouseEvent>): void;
	// TODO: Receive zoneType and abstract icon display here?
	// zoneType: 'component' | 'page' | 'field';
	sx?: ZoneMarkerPartialSx;
	classes?: PartialClassRecord<ZoneMarkerClassKey>;
	field?: ContentTypeField;
	stateMap?: ItemStateMap;
}

function getStyles(sx: ZoneMarkerPartialSx): ZoneMarkerFullSx {
	return {
		box: {
			boxSizing: 'border-box',
			outline: (theme) => `2px solid ${theme.palette.success.main}`,
			outlineOffset: '-2px',
			textAlign: 'center',
			position: 'absolute',
			zIndex: 'tooltip',
			pointerEvents: 'none',
			...sx?.box
		},
		paper: {
			padding: [0.5, 1],
			fontSize: '14px',
			overflow: 'hidden',
			fontWeight: 700,
			pointerEvents: 'none',
			zIndex: 'tooltip',
			display: 'flex',
			alignItems: 'center',
			flexDirection: 'column',
			...sx?.paper
		},
		icon: {
			marginRight: 1,
			fontSize: 21,
			...sx?.icon
		},
		tooltip: {
			transition: 'none',
			zIndex: 'tooltip',
			...sx?.tooltip
		},
		menuItemsContainer: {
			pointerEvents: 'all',
			alignItems: 'center',
			display: 'flex'
		}
	} as Record<ZoneMarkerClassKey, SxProps<Theme>>;
}

const dropTargetModesMessages = defineMessages({
	shared: { id: 'zoneMarker.existing', defaultMessage: 'existing' },
	embedded: { id: 'zoneMarker.embedded', defaultMessage: 'embedded' },
	sharedExisting: { id: 'zoneMarker.existingShared', defaultMessage: 'existing shared' }
});

export function ZoneMarker(props: ZoneMarkerProps) {
	const {
		rect,
		label,
		classes,
		inherited,
		menuItems,
		showZoneTooltip = true,
		onPopperClick,
		lockInfo = null,
		isStale = false,
		isEditable,
		field,
		stateMap
	} = props;
	const isLockedItem = Boolean(lockInfo);
	const [zoneStyle, setZoneStyle] = useState<CSSProperties>();
	const sx = getStyles(props.sx);
	const elRef = useRef(undefined);
	const theme = useTheme();
	let allowedTypesMeta: LookupTable<Partial<AllowedContentTypesData<boolean>>>;
	let contentTypes: LookupTable<ContentType>;
	if (field?.type === 'node-selector' && field.validations.allowedContentTypes) {
		allowedTypesMeta = field.validations.allowedContentTypes.value;
		contentTypes = getCachedContentTypes();
	}
	const { formatMessage } = useIntl();
	useEffect(() => {
		setZoneStyle(getZoneMarkerStyle(rect));
	}, [rect]);
	const isSystemProcessing = Boolean(stateMap?.systemProcessing);

	return (
		<>
			<Box
				ref={elRef}
				style={zoneStyle}
				sx={sx.box}
				className={['craftercms-zone-marker', classes?.box].filter(Boolean).join(' ')}
			/>
			{showZoneTooltip && elRef.current && (
				<Popper
					open
					anchorEl={elRef.current}
					placement="top-start"
					onClick={onPopperClick}
					sx={sx.tooltip}
					className="craftercms-zone-marker-tooltip"
					modifiers={[
						{
							name: 'offset',
							options: {
								offset: [0, 5]
							}
						}
					]}
				>
					<Paper className={classes?.paper} sx={sx.paper}>
						<div style={{ display: 'flex', alignItems: 'center' }}>
							{isLockedItem || isStale ? (
								<LockedStateIcon sx={sx.icon} />
							) : inherited ? (
								<LevelDescriptorIcon sx={sx.icon} />
							) : (
								<FieldIcon sx={sx.icon} />
							)}
							<UltraStyledTypography title={label} noWrap sx={{ color: (sx?.paper as SystemCssProperties).color }}>
								{label}
							</UltraStyledTypography>
							{allowedTypesMeta && (
								<Box
									sx={{ ml: 1, pointerEvents: 'all', display: 'flex', alignItems: 'center' }}
									onClick={(e) => e.stopPropagation()}
								>
									{Object.entries(allowedTypesMeta).map(([id, modes]) => {
										// 'id' can be '*' (meaning all content types), so we need to handle that scenario
										const type =
											id === '*'
												? { id: 'all', name: formatMessage({ id: 'zoneMarker.allTypes', defaultMessage: 'All types' }) }
												: contentTypes[id];
										const { backgroundColor, textColor } = getAvatarWithIconColors(
											type?.id ?? type?.name,
											theme,
											darken
										);
										return (
											<UltraStyledTooltip
												key={id}
												arrow
												title={
													<FormattedMessage
														id="zoneMarker.dropTargetInfo"
														defaultMessage="Drop target compatible with {type} as {modes}"
														values={{
															type: type?.name ?? '',
															modes: Object.keys(modes)
																.map((mode) =>
																	dropTargetModesMessages[mode] ? formatMessage(dropTargetModesMessages[mode]) : mode
																)
																.join(', ')
														}}
													/>
												}
											>
												<AllowedTypeCircle
													sx={{
														backgroundColor,
														// TODO: The border colour is meant to contrast background colour of
														//  the *Paper*, which is not set here and can be customized by app developers.
														//  At the moment, is being set to the known colour set on guest/src/styles/styles.ts.
														borderColor: textColor
													}}
												/>
											</UltraStyledTooltip>
										);
									})}
								</Box>
							)}
						</div>
						{isLockedItem && (
							<Typography noWrap variant="body2" component="div">
								<FormattedMessage
									id="zoneMarker.lockedBy"
									defaultMessage="Locked by {username}"
									values={{ username: lockInfo.username }}
								/>
							</Typography>
						)}
						{!isEditable && !isLockedItem && (
							<Typography noWrap variant="body2" component="div">
								{isSystemProcessing ? (
									<FormattedMessage id="zoneMarker.systemProcessing" defaultMessage="System processing" />
								) : (
									<FormattedMessage id="zoneMarker.notEditable" defaultMessage="Not editable" />
								)}
							</Typography>
						)}
						{isStale && (
							<Typography noWrap variant="body2" component="div">
								<FormattedMessage
									id="zoneMarker.modifiedItem"
									defaultMessage="Item was modified. Refresh to enable editing."
								/>
							</Typography>
						)}
						{menuItems && <Box sx={sx.menuItemsContainer}>{menuItems}</Box>}
					</Paper>
				</Popper>
			)}
		</>
	);
}

export default ZoneMarker;
