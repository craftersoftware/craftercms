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

import React from 'react';
import IconButton from '@mui/material/IconButton';
import MoreVertIcon from '@mui/icons-material/MoreVertRounded';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Link from '@mui/material/Link';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import { Site } from '../../models/Site';
import SiteStatusIndicator from '../SiteStatusIndicator/SiteStatusIndicator';
import ListItemButton from '@mui/material/ListItemButton';
import { PartialSxRecord } from '../../models';

export interface LauncherSiteCardOption {
	name: string;
	href: string | ((site: string) => string);
	onClick?(site: string): void;
}

export type LauncherSiteCardClassKey = 'root' | 'siteName';

export interface LauncherSiteCardProps {
	title: string;
	value?: string;
	classes?: Partial<Record<LauncherSiteCardClassKey, string>>;
	sxs?: PartialSxRecord<'root' | 'siteName'>;
	options?: Array<LauncherSiteCardOption>;
	disabled?: boolean;
	selected?: boolean;
	state?: Site['state'];
	onCardClick(id: string): any;
}

function LauncherSiteCard(props: LauncherSiteCardProps) {
	const { title, value, onCardClick, options, selected = false, state, sxs } = props;
	const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
	const hasOptions = Boolean(options && options.length);
	const isSiteReady = state === 'READY';

	const handleClose = (event, action?) => {
		event.stopPropagation();
		setAnchorEl(null);
		action?.onClick?.(value, event);
	};

	const handleOptions = (event) => {
		event.stopPropagation();
		setAnchorEl(event.currentTarget);
	};

	return (
		<>
			<ListItemButton
				disabled={!isSiteReady}
				selected={selected}
				component={ListItem}
				onClick={isSiteReady ? () => onCardClick(value) : undefined}
				className={props.classes?.root}
				sx={{
					position: 'relative',
					paddingTop: (theme) => theme.spacing(2.5),
					paddingBottom: (theme) => theme.spacing(2.5),
					borderRadius: '5px',
					backgroundColor: (theme) => theme.palette.background.paper,
					...sxs?.root
				}}
				title={title}
				secondaryAction={
					!isSiteReady || hasOptions ? (
						isSiteReady ? (
							<IconButton aria-label="settings" onClick={handleOptions} size="large">
								<MoreVertIcon />
							</IconButton>
						) : (
							<SiteStatusIndicator state={state} />
						)
					) : null
				}
			>
				<ListItemText
					primary={title}
					slotProps={{
						primary: {
							className: props.classes?.siteName,
							sx: {
								fontWeight: 600,
								...sxs?.siteName
							},
							noWrap: true
						}
					}}
					sx={isSiteReady ? undefined : { paddingRight: '35px' }}
				/>
			</ListItemButton>
			<Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleClose}>
				{hasOptions &&
					options.map((action, i) => (
						<MenuItem
							key={i}
							component={Link}
							color="inherit"
							underline="none"
							href={typeof action.href === 'function' ? action.href(value) : action.href}
							onClick={(e) => handleClose(e, action)}
						>
							{action.name}
						</MenuItem>
					))}
			</Menu>
		</>
	);
}

export default LauncherSiteCard;
