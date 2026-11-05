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

import Link from '@mui/material/Link';
import Avatar from '@mui/material/Avatar';
import SystemIcon, { SystemIconDescriptor } from '../SystemIcon';
import Typography from '@mui/material/Typography';
import React from 'react';
import { PartialSxRecord } from '../../models';

export type LauncherTileClassKey = 'tile' | 'tileActive' | 'title' | 'iconAvatar';

export interface LauncherTileProps {
	icon: SystemIconDescriptor;
	title: string;
	link?: string;
	target?: string;
	disabled?: any;
	active?: boolean;
	classes?: Partial<Record<LauncherTileClassKey, string>>;
	sxs?: PartialSxRecord<LauncherTileClassKey>;
	onClick?(e: React.MouseEvent<HTMLAnchorElement | HTMLSpanElement>): any;
}

function LauncherTile(props: LauncherTileProps) {
	const { title, icon, link, target, onClick, disabled = false, active, sxs } = props;
	return (
		<Link
			className={[disabled ? 'disabled' : '', props.classes?.tile].filter(Boolean).join(' ')}
			sx={{
				width: '120px',
				height: '100px',
				display: 'flex',
				alignItems: 'center',
				flexDirection: 'column',
				justifyContent: 'center',
				cursor: 'pointer',
				textAlign: 'center',
				borderRadius: (theme) => `${theme.shape.borderRadius}px`,
				transition: 'background 250ms ease, box-shadow 500ms ease',
				margin: '5px',
				overflow: 'hidden',
				'&:hover, &:focus': {
					background: (theme) => theme.palette.action.hover,
					boxShadow: (theme) => theme.shadows[2],
					textDecoration: 'none'
				},
				'&.disabled': {
					opacity: (theme) => theme.palette.action.disabledOpacity,
					background: (theme) => theme.palette.action.disabled,
					pointerEvents: 'none'
				},
				...sxs?.tile,
				...(active
					? {
							'&, &:hover, &:focus': {
								boxShadow: 'none',
								cursor: 'default',
								background: (theme) => theme.palette.action.selected
							}
						}
					: {}),
				// The hover/focus elevation above has the same specificity as the theme focus ring and comes later,
				// so it replaced the black band of the ring. A white outline alone is invisible on a light page.
				'&:focus-visible': {
					boxShadow: (theme) => (active ? '0 0 0 4px #000000' : `0 0 0 4px #000000, ${theme.shadows[2]}`)
				}
			}}
			href={disabled ? null : link}
			onClick={(e) => (!disabled && onClick ? onClick(e) : null)}
			target={target ? target : '_self'}
		>
			<Avatar
				variant="rounded"
				className={props.classes?.iconAvatar}
				sx={{
					backgroundColor: 'transparent',
					color: (theme) => theme.palette.text.secondary,
					margin: '5px',
					...sxs?.iconAvatar
				}}
			>
				<SystemIcon icon={icon} />
			</Avatar>
			<Typography
				color="textPrimary"
				className={props.classes?.title}
				sx={{
					lineHeight: 1,
					...sxs?.title
				}}
			>
				{title}
			</Typography>
		</Link>
	);
}

export default LauncherTile;
