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

import React from 'react';
import { Typography } from '@mui/material';
import { FormattedMessage } from 'react-intl';
import Box from '@mui/material/Box';
import { DependencyChip } from './PublishDialogContainer';
import { DraftChip } from '../DraftChip';

export function PublishReferencesLegend() {
	return (
		<Box sx={{ my: 2 }}>
			<Typography variant="body2" sx={{ mb: 1 }}>
				<FormattedMessage defaultMessage="LEGEND" />
			</Typography>
			<Box sx={{ display: 'flex', mb: 1, gap: 1 }}>
				<DependencyChip type="hard" />
				<Typography variant="body2" color="textSecondary">
					<FormattedMessage defaultMessage="References of mandatory submission" />
				</Typography>
			</Box>
			<Box sx={{ display: 'flex', mb: 1, gap: 1 }}>
				<DependencyChip type="soft" />
				<Typography variant="body2" color="textSecondary">
					<FormattedMessage defaultMessage="References of optional submission" />
				</Typography>
			</Box>
			<Box sx={{ display: 'flex', gap: 1 }}>
				<DraftChip size="small" sx={{ px: '11px' }} />
				<Typography variant="body2" color="textSecondary">
					<FormattedMessage defaultMessage="Draft item. Required fields may be empty and can cause errors when published." />
				</Typography>
			</Box>
		</Box>
	);
}

export default PublishReferencesLegend;
