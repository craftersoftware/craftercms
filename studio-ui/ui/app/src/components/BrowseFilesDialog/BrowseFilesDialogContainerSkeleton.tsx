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
import DialogBody from '../DialogBody';
import { Box } from '@mui/material';
import MediaSkeletonCard from './MediaSkeletonCard';

export interface BrowseFilesDialogContainerSkeletonProps {}

export function BrowseFilesDialogContainerSkeleton(props: BrowseFilesDialogContainerSkeletonProps) {
	return (
		<>
			<DialogBody sx={{ minHeight: '60vh', padding: 0 }}>
				<Box sx={{ display: 'flex' }}>
					<Box
						component="section"
						sx={{
							width: '270px',
							minWidth: '270px',
							padding: '16px',
							overflow: 'auto',
							rowGap: (theme) => theme.spacing(1)
						}}
					/>
					<Box component="section" sx={{ flexGrow: 1, padding: '16px', overflow: 'auto' }}>
						<Box
							sx={{
								display: 'grid',
								gridTemplateColumns: 'repeat(auto-fit, minmax(200px, max-content))',
								gridGap: '16px',
								padding: 'initial'
							}}
						>
							{Array(5)
								.fill(null)
								.map((x, i) => (
									<MediaSkeletonCard key={i} />
								))}
						</Box>
					</Box>
				</Box>
			</DialogBody>
		</>
	);
}

export default BrowseFilesDialogContainerSkeleton;
