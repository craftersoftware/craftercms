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

import ListItem from '@mui/material/ListItem';
import Skeleton, { skeletonClasses } from '@mui/material/Skeleton';
import { rand } from './utils';
import React from 'react';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';

function PathNavigatorSkeletonItem() {
	return (
		<ListItem
			sx={{
				minHeight: '23.5px',
				padding: '0 0 0 5px',
				marginLeft: '15px',
				width: 'calc(100% - 15px)',
				'&:hover': {
					backgroundColor: (theme) =>
						theme.palette.mode === 'dark' ? theme.palette.action.hover : theme.palette.grey['A200']
				}
			}}
			style={{ height: '25px' }}
		>
			<ListItemIcon
				sx={{
					mr: 0,
					[`& .${skeletonClasses.root}`]: {
						marginRight: '5px',
						fontSize: '1.2rem'
					}
				}}
			>
				<Skeleton variant="circular" height={15} width={15} />
				<Skeleton variant="circular" height={15} width={15} />
			</ListItemIcon>
			<ListItemText primary={<Skeleton width={`${rand(30, 85)}%`} height={15} />} />
		</ListItem>
	);
}

export default PathNavigatorSkeletonItem;
