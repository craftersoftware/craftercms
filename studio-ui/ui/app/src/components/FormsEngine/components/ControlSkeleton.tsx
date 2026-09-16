/*
 * Copyright (C) 2007-2024 Crafter Software Corporation. All Rights Reserved.
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

import Box from '@mui/material/Box';
import FormLabel from '@mui/material/FormLabel';
import Skeleton from '@mui/material/Skeleton';
import React from 'react';

export function ControlSkeleton({ label }: { label: string }) {
	return (
        <>
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    height: 30
                }}>
				<Box
                    className="space-x"
                    sx={{
                        display: "flex",
                        alignItems: "center"
                    }}>
					{label ? <FormLabel component="div">{label}</FormLabel> : <Skeleton variant="text" width={100} />}
					<Skeleton variant="circular" />
				</Box>
				<Box
                    className="space-x"
                    sx={{
                        display: "flex",
                        alignItems: "center"
                    }}>
					<Skeleton variant="text" width={30} />
					<Skeleton variant="circular" width={15} height={15} />
					<Skeleton variant="circular" width={15} height={15} />
				</Box>
			</Box>
            <Skeleton variant="rounded" width="100%" height={50} />
            <Skeleton variant="text" width={200} height={15} />
        </>
    );
}
