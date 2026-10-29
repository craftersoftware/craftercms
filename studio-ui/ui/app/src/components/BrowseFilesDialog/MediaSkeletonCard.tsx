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
import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import Skeleton from '@mui/material/Skeleton';

export function MediaSkeletonCard() {
	return (
		<Card
			sx={{
				width: '100%',
				height: '155px',
				margin: 0
			}}
		>
			<CardHeader
				avatar={<Skeleton variant="circular" width={24} height={24} />}
				title={<Skeleton animation="wave" height={20} width="100%" />}
			/>
			<Skeleton
				animation="wave"
				variant="rectangular"
				sx={{
					height: 0,
					paddingTop: '56.25%' // 16:9
				}}
			/>
		</Card>
	);
}

export default MediaSkeletonCard;
