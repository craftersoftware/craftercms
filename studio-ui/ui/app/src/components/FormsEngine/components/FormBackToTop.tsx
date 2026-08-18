/*
 * Copyright (C) 2007-2025 Crafter Software Corporation. All Rights Reserved.
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

import Tooltip from '@mui/material/Tooltip';
import { FormattedMessage } from 'react-intl';
import Fab from '@mui/material/Fab';
import { ArrowUpward } from '@mui/icons-material';
import Box from '@mui/material/Box';
import React, { RefObject } from 'react';
import { getScrollContainer } from '../lib/formUtils';

interface FormBackToTopProps {
	containerRef: RefObject<HTMLElement>;
}

export function FormBackToTop({ containerRef }: FormBackToTopProps) {
	return (
		<Box minHeight={100} justifyContent="center" alignItems="center" display="flex">
			<Tooltip title={<FormattedMessage defaultMessage="Back to top" />}>
				<Fab
					onClick={() => getScrollContainer(containerRef.current).scroll({ top: 0, behavior: 'smooth' })}
				>
					<ArrowUpward />
				</Fab>
			</Tooltip>
		</Box>
	);
}

export default FormBackToTop;
