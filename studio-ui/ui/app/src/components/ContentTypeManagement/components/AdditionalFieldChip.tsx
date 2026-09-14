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

import SubdirectoryArrowRightRoundedIcon from '@mui/icons-material/SubdirectoryArrowRightRounded';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import React from 'react';
import useIsDarkModeTheme from '../../../hooks/useIsDarkModeTheme';
import { FormattedMessage } from 'react-intl';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Tooltip from '@mui/material/Tooltip';
import { processAdditionalFieldMacro } from '../../FormsEngine/lib/formUtils';

export function AdditionalFieldChip(props: { parentFieldId: string; fieldId: string }) {
	const { fieldId, parentFieldId } = props;
	const isDark = useIsDarkModeTheme();

	const additionalFieldId = processAdditionalFieldMacro(parentFieldId, fieldId);

	return (
		<Box display="flex" alignItems="center" sx={{ mb: 1 }}>
			<SubdirectoryArrowRightRoundedIcon sx={{ ml: 3 }} />
			<Box
				sx={[
					{
						width: '100%',
						bgcolor: isDark ? 'grey.800' : 'grey.200',
						borderRadius: 10,
						overflow: 'hidden',
						border: '1px solid transparent',
						px: 1.5,
						py: 0.5,
						display: 'flex',
						justifyContent: 'space-between'
					}
				]}
			>
				<Typography component="span" variant="body2">
					{additionalFieldId}
				</Typography>
				<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
					<Typography variant="body2" component="span">
						<FormattedMessage defaultMessage="Additional Field" />
					</Typography>
					<Tooltip
						title={
							<FormattedMessage defaultMessage="An additional field is a field that this control has permission to edit, beyond its main value. " />
						}
						placement="top"
					>
						<InfoOutlinedIcon fontSize="small" />
					</Tooltip>
				</Box>
			</Box>
		</Box>
	);
}

export default AdditionalFieldChip;
