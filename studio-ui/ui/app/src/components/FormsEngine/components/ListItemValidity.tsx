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

import React, { type ReactNode } from 'react';
import ErrorOutlineRounded from '@mui/icons-material/ErrorOutlineRounded';
import Box from '@mui/material/Box';
import ListItemText, { type ListItemTextProps } from '@mui/material/ListItemText';
import Tooltip from '@mui/material/Tooltip';
import visuallyHidden from '@mui/utils/visuallyHidden';
import { useAtomValue } from 'jotai';
import { useIntl } from 'react-intl';
import { useStableFormContext } from '../lib/formsEngineContext';
import { listItemValidityAtom } from '../lib/formUtils';
import type { InvalidListItemField } from '../lib/validators';
import { translateValidityMessage } from './FieldValidityMessages';

export type ListItemValidityProps = {
	fieldId: string;
	itemKey: string;
	primary: ReactNode;
	secondary?: ReactNode;
	slotProps?: ListItemTextProps['slotProps'];
};

/** Localized "Field name: message" lines for one invalid list item. */
export function formatInvalidListItemDetails(
	fields: InvalidListItemField[],
	formatMessage: ReturnType<typeof useIntl>['formatMessage']
): string {
	return fields
		.map((field) => {
			const detail = field.messages.map((message) => translateValidityMessage(message, formatMessage)).join('; ');
			return detail ? `${field.fieldName}: ${detail}` : field.fieldName;
		})
		.join('\n');
}

/**
 * Per-row validity chrome for node-selector and repeat lists. Subscribes only to this item's derived atom, so other
 * rows do not re-render when another item's status flips. Invalid rows use the error colour, an error icon with a
 * tooltip of failing fields, and a visually hidden cue that names those fields for assistive tech.
 */
export function ListItemValidity({ fieldId, itemKey, primary, secondary, slotProps }: ListItemValidityProps) {
	const { formatMessage } = useIntl();
	const validationAtom = useStableFormContext().atoms.validationByFieldId[fieldId];
	const fields = useAtomValue(listItemValidityAtom(validationAtom, itemKey));
	const invalid = fields.length > 0;
	const details = formatInvalidListItemDetails(fields, formatMessage);
	const invalidLabel = details
		? formatMessage({ defaultMessage: 'Invalid item{br}{details}' }, { br: '\n', details })
		: formatMessage({ defaultMessage: 'Invalid item' });
	return (
		<>
			{invalid && (
				<Tooltip title={invalidLabel} slotProps={{ tooltip: { sx: { whiteSpace: 'pre-line' } } }}>
					<Box
						component="span"
						sx={{ display: 'inline-flex', alignItems: 'center', mr: 0.5, flexShrink: 0, color: 'error.main' }}
					>
						<ErrorOutlineRounded fontSize="small" color="error" aria-hidden />
					</Box>
				</Tooltip>
			)}
			<ListItemText
				primary={
					<>
						{primary}
						{invalid && (
							<Box component="span" sx={visuallyHidden}>
								{invalidLabel}
							</Box>
						)}
					</>
				}
				secondary={secondary}
				slotProps={slotProps}
				sx={invalid ? { color: 'error.main', '& .MuiListItemText-secondary': { color: 'inherit' } } : undefined}
			/>
		</>
	);
}

export default ListItemValidity;
