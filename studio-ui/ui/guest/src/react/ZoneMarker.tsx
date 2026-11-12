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
import { Box, Paper, Popper, Typography, useTheme, type SxProps, type Theme } from '@mui/material';
import { PartialClassRecord } from '@craftercms/studio-ui/models/CustomRecord';
import LevelDescriptorIcon from '@craftercms/studio-ui/icons/LevelDescriptor';
import FieldIcon from '@craftercms/studio-ui/icons/ContentTypeField';
import LockedStateIcon from '@craftercms/studio-ui/icons/Lock';
import Person from '@craftercms/studio-ui/models/Person';
import { darken, styled } from '@mui/material/styles';
import { getOverlayBoundarySx } from '@craftercms/studio-ui/styles/overlayStroke';
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

export type ZoneMarkerFullSx = Record<ZoneMarkerClassKey, SxProps<Theme>>;

export type ZoneMarkerPartialSx = Partial<Record<ZoneMarkerClassKey, SxProps<Theme>>>;

export interface ZoneMarkerProps {
	rect: DOMRect;
	label: string;
	inherited: boolean;
	showZoneTooltip?: boolean;
	hasFailedRequired?: boolean;
	/** The item count has reached this field's maximum, a different message from a missing minimum. */
	hasReachedMaxCount?: boolean;
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
	// The boundary is drawn on the authored page, so it cannot follow the Studio mode (a dark-mode light
	// blue is 2.54:1 on a white page). The companion bands make it background-independent; see
	// styles/overlayStroke.ts. The default is the select-mode colour; src/styles/styles.ts sets each state.
	// A list, not a spread: the state colour arrives as an sx callback, and spreading a callback yields {}.
	const boxDefaults = {
		boxSizing: 'border-box' as const,
		textAlign: 'center' as const,
		position: 'absolute' as const,
		zIndex: 'tooltip',
		pointerEvents: 'none' as const
	};
	return {
		box: [boxDefaults, getOverlayBoundarySx((theme) => theme.palette.success.main), ...(sx?.box ? [sx.box] : [])],
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
		hasFailedRequired = false,
		hasReachedMaxCount = false,
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
							{/* The icon components are typed against the app build's Theme. The guest program augments a second copy. */}
							{isLockedItem || isStale ? (
								<LockedStateIcon sx={sx.icon as React.ComponentProps<typeof LockedStateIcon>['sx']} />
							) : inherited ? (
								<LevelDescriptorIcon sx={sx.icon as React.ComponentProps<typeof LevelDescriptorIcon>['sx']} />
							) : (
								<FieldIcon sx={sx.icon as React.ComponentProps<typeof FieldIcon>['sx']} />
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
						{/* Inherit the paper colour. Typography's text.primary is white in dark mode, under 2.2:1 on these fills. */}
						{isLockedItem && (
							<Typography noWrap variant="body2" component="div" color="inherit">
								<FormattedMessage
									id="zoneMarker.lockedBy"
									defaultMessage="Locked by {username}"
									values={{ username: lockInfo.username }}
								/>
							</Typography>
						)}
						{!isEditable && !isLockedItem && (
							<Typography noWrap variant="body2" component="div" color="inherit">
								{isSystemProcessing ? (
									<FormattedMessage id="zoneMarker.systemProcessing" defaultMessage="System processing" />
								) : (
									<FormattedMessage id="zoneMarker.notEditable" defaultMessage="Not editable" />
								)}
							</Typography>
						)}
						{isStale && (
							<Typography noWrap variant="body2" component="div" color="inherit">
								<FormattedMessage
									id="zoneMarker.modifiedItem"
									defaultMessage="Item was modified. Refresh to enable editing."
								/>
							</Typography>
						)}
						{hasFailedRequired && !isLockedItem && isEditable && !isStale && (
							<Typography noWrap variant="body2" component="div" color="inherit">
								<FormattedMessage id="zoneMarker.required" defaultMessage="Required" />
							</Typography>
						)}
						{hasReachedMaxCount && !hasFailedRequired && !isLockedItem && isEditable && !isStale && (
							<Typography noWrap variant="body2" component="div" color="inherit">
								<FormattedMessage id="zoneMarker.maxCountReached" defaultMessage="Maximum reached" />
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
