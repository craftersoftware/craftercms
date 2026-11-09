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

import React from 'react';
import Tooltip from '@mui/material/Tooltip';
import Box from '@mui/material/Box';
import { useIntl } from 'react-intl';
import Asterisk from '../../../icons/Asterisk';
import SvgIcon from '@mui/material/SvgIcon';

type SvgIconComponent = typeof SvgIcon;

import CheckRounded from '@mui/icons-material/CheckRounded';

export type FieldStateIndicatorProps = {
	isRequired: boolean;
	hasValidator: boolean;
	isValid: boolean;
	isEmpty: boolean;
};

export function FieldStateIndicator({ isRequired, hasValidator, isValid, isEmpty }: FieldStateIndicatorProps) {
	const { formatMessage } = useIntl();
	let IndicatorComponent: SvgIconComponent;
	let label: string;

	// If there is no requirement and no validator, and the field is empty, do not show any indicator
	if (!isRequired && !hasValidator && isEmpty) return undefined;

	// If required, or if not required but has a validator and is invalid, show asterisk (color depends on isValid).
	// An invalid marker also includes the word Required or Invalid so the cue is not colour alone.
	if (isRequired || (!isRequired && hasValidator && !isValid)) {
		IndicatorComponent = Asterisk;
		if (isValid) {
			label = formatMessage({ defaultMessage: 'Complete' });
		} else if (isRequired && isEmpty) {
			label = formatMessage({ defaultMessage: 'Required' });
		} else {
			label = formatMessage({ defaultMessage: 'Invalid' });
		}
	} else {
		// Otherwise, show check mark
		IndicatorComponent = CheckRounded;
		label = formatMessage({ defaultMessage: 'Complete' });
	}

	return (
		<Tooltip title={label}>
			<Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', columnGap: 0.5 }}>
				<IndicatorComponent aria-hidden fontSize="small" color={isValid ? 'success' : 'error'} />
				{!isValid && (
					<Box component="span" sx={{ color: 'error.main', fontSize: '0.75rem', fontWeight: 600, lineHeight: 1 }}>
						{label}
					</Box>
				)}
			</Box>
		</Tooltip>
	);
}

export default FieldStateIndicator;
