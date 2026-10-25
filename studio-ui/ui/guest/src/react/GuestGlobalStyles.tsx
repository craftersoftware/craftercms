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

import * as React from 'react';
import { useMemo } from 'react';
import palette from '@craftercms/studio-ui/styles/palette';
import Global from '@mui/material/GlobalStyles';
import {
	dragAndDropActiveClass,
	editModeClass,
	editModePaddingClass,
	editOnClass,
	emptyCollectionClass,
	emptyFieldClass,
	eventCaptureOverlayAttribute,
	iceBypassKeyClass,
	moveModeClass,
	XbUtilityClasses
} from '../constants';
import { Interpolation } from '@emotion/react';
import { Theme } from '@mui/material/styles';
import { deepmerge } from '@mui/utils';
import { DeepPartial } from '@craftercms/studio-ui/models/DeepPartial';
import { typographyStyles } from '@craftercms/studio-ui/components/GlobalStyles/typography';
import { useIntl } from 'react-intl';

export type GlobalStyleKeys =
	| 'craftercms-asset-uploader-mask-container'
	| 'craftercms-asset-uploader-mask'
	| 'craftercms-field-instance-switcher'
	| '.craftercms-placeholder-spinner'
	| '.craftercms-content-tree-locate'
	| '.mce-content-body'
	| '@keyframes craftercms-uploader-mask-animation'
	| '@keyframes craftercms-placeholder-animation'
	| '@keyframes craftercms-placeholder-inner-animation'
	| '@keyframes craftercms-content-tree-locate-animation'
	| `.${XbUtilityClasses}`;

export type GuestGlobalStyleRules = Record<GlobalStyleKeys, Interpolation<Theme>>;

export interface GuestGlobalStylesProps {
	/**
	 * Global styles for XB components. Please memoize your styles to avoid unnecessary renders. */
	styles?: DeepPartial<GuestGlobalStyleRules>;
}

const overlayBackgroundColor = 'rgba(0, 0, 0, .4)';

export function GuestGlobalStyles(props: GuestGlobalStylesProps) {
	const { styles } = props;
	const { formatMessage } = useIntl();
	return useMemo(
		() => (
			<>
				<Global
					styles={deepmerge(
						{
							// Elements
							'craftercms-asset-uploader-mask-container': {
								zIndex: 1010,
								position: 'absolute',
								pointerEvents: 'none'
							},
							'craftercms-asset-uploader-mask': {
								background: 'white',
								opacity: 0.5,
								height: '100%',
								width: '100%',
								display: 'block',
								transition: 'height 0.3s ease-out',
								animation: 'craftercms-uploader-mask-animation 1.5s infinite ease-in-out'
							},
							'craftercms-field-instance-switcher': {
								position: 'fixed',
								bottom: '10px',
								right: '10px',
								backgroundColor: palette.white,
								boxShadow: '0 2px 1px -1px rgba(0,0,0,0.2), 0 1px 1px 0 rgba(0,0,0,0.14), 0 1px 3px 0 rgba(0,0,0,0.12)',
								padding: '10px 14px',
								color: palette.black,
								display: 'flex',
								alignItems: 'center',
								zIndex: 2,
								'& .disable': {
									pointerEvents: 'none',
									opacity: '0.5'
								},
								'& button': {
									display: 'inherit',
									padding: '2px',
									cursor: 'pointer',
									border: 0,
									background: 'transparent',
									color: 'inherit'
								},
								'& svg': {
									fill: 'currentColor',
									width: '1em',
									height: '1em',
									display: 'inline-block',
									fontSize: '1.5rem',
									transition: 'fill 200ms cubic-bezier(0.4, 0, 0.2, 1) 0ms',
									flexShrink: 0,
									userSelect: 'none'
								}
							},
							// Classes
							'.craftercms-placeholder-spinner': {
								animation: 'craftercms-placeholder-animation 2s linear infinite',
								'& .path': {
									stroke: palette.blue.main,
									animation: 'craftercms-placeholder-inner-animation 1.5s ease-in-out infinite'
								}
							},
							'.craftercms-content-tree-locate': {
								animation: 'craftercms-content-tree-locate-animation 300ms 2 ease-in-out'
							},
							// region craftercms-ice-on
							[`.${editModeClass}`]: {
								'[data-craftercms-model-id], & [data-craftercms-model-id] a, & [data-craftercms-field], & [data-craftercms-field] a':
									{
										cursor: 'url("/studio/static-assets/images/cursor-edit@1.5x.png"), pointer !important'
									}
							},
							[`.${moveModeClass}`]: {
								'[draggable="true"]': {
									cursor: 'url("/studio/static-assets/images/cursor-drag@1.5x.png"), move !important'
								}
							},
							[`.${dragAndDropActiveClass}`]: {},
							[`.${editModePaddingClass}`]: {
								'[data-craftercms-type="collection"]': {
									paddingTop: '20px',
									paddingRight: '20px',
									paddingBottom: '20px',
									paddingLeft: '20px'
								}
							},
							[`.${editOnClass}`]: {
								[`&.${moveModeClass} [${eventCaptureOverlayAttribute}]`]: {
									background: overlayBackgroundColor,
									'&::before': {
										content: `"${formatMessage({
											id: 'globalStyles.contentHidden',
											defaultMessage: 'Content hidden to enable dragging.'
										})}"`
									},
									'> *': {
										visibility: 'hidden'
									}
								},
								[`&.${iceBypassKeyClass} [${eventCaptureOverlayAttribute}]:hover::before`]: {
									backgroundColor: overlayBackgroundColor,
									content: `"${formatMessage({
										id: 'globalStyles.turnOffEditMode',
										defaultMessage: 'Turn off edit mode to interact with this element.'
									})}"`
								},
								[`[${eventCaptureOverlayAttribute}]`]: {
									position: 'relative',
									'&::before': {
										top: 0,
										left: 0,
										right: 0,
										color: '#fff',
										bottom: 0,
										content: '""',
										padding: '20px',
										fontWeight: 'bold',
										position: 'absolute'
									}
								},
								[`.${emptyCollectionClass}`]: {
									minHeight: '100px',
									minWidth: '100px',
									backgroundColor: overlayBackgroundColor,
									'&::before': {
										color: '#fff',
										display: 'inline-block',
										padding: '10px',
										content: `"${formatMessage({
											id: 'globalStyles.emptyTarget',
											defaultMessage: 'Empty components target. Drag new or existing content items here to add them'
										})}"`,
										fontWeight: 'bold'
									}
								},
								[`.${emptyFieldClass}`]: {
									minHeight: '40px',
									minWidth: '50px',
									borderRadius: '5px',
									backgroundColor: overlayBackgroundColor,
									'&::before': {
										color: '#fff',
										display: 'inline-block',
										padding: '10px',
										content: `"${formatMessage({
											id: 'globalStyles.clickToAddContent',
											defaultMessage: 'Click to add content.'
										})}"`,
										fontWeight: 'bold'
									}
								}
							},
							// endregion
							'.mce-content-body': {
								outlineOffset: 5,
								outline: `2px solid ${palette.blue.tint}`,
								'&:focus': {
									outline: `5px solid ${palette.blue.main}`
								}
							},
							// Keyframes
							'@keyframes craftercms-uploader-mask-animation': {
								'0%': {
									opacity: 0.4
								},
								'50%': {
									opacity: 0.5
								},
								'100%': {
									opacity: 0.4
								}
							},
							'@keyframes craftercms-placeholder-animation': {
								'100%': { transform: 'rotate(360deg)' }
							},
							'@keyframes craftercms-placeholder-inner-animation': {
								'0%': { strokeDasharray: '1, 150', strokeDashoffset: '0' },
								'50%': { strokeDasharray: '90, 150', strokeDashoffset: '-35' },
								'100%': { strokeDasharray: '90, 150', strokeDashoffset: '-124' }
							},
							'@keyframes craftercms-content-tree-locate-animation': {
								'0%': {
									transform: 'scaleX(1)'
								},
								'50%': {
									transform: 'scale3d(1.05,1.05,1.05)'
								},
								to: {
									transform: 'scaleX(1)'
								}
							}
						},
						styles ?? {}
					)}
				/>
				<Global styles={typographyStyles} />
			</>
		),
		[styles, formatMessage]
	);
}

export default GuestGlobalStyles;
