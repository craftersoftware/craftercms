/*
 * Copyright (C) 2007-2026 Crafter Software Corporation. All Rights Reserved.
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
import visuallyHidden from '@mui/utils/visuallyHidden';
import React from 'react';

export interface PoliteStatusProps {
	/** An empty string keeps the region mounted without announcing anything. */
	message: string;
}

/**
 * Visually hidden polite status region (WCAG 4.1.3) for counts, ranges and progress.
 * Keep it mounted: screen readers announce changes to its text, not the text it mounts with.
 */
export function PoliteStatus(props: PoliteStatusProps) {
	return (
		<Box role="status" sx={visuallyHidden}>
			{props.message}
		</Box>
	);
}

export default PoliteStatus;
