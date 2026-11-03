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

import React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { FormattedMessage, useIntl } from 'react-intl';
import type { MinimumRequirementsNotice } from '../lib/minimumSaveRequirements';

function MinimumRequirementsMessage({ notice }: { notice: MinimumRequirementsNotice }) {
	switch (notice.copy) {
		case 'both':
			return (
				<FormattedMessage
					defaultMessage="Add a {fileName} and {internalName} to save this content."
					values={{ fileName: notice.fileName, internalName: notice.internalName }}
				/>
			);
		case 'fileName':
			return (
				<FormattedMessage
					defaultMessage="Add a {fileName} to save this content."
					values={{ fileName: notice.fileName }}
				/>
			);
		default:
			return (
				<FormattedMessage
					defaultMessage="Add an {internalName} to save this content."
					values={{ internalName: notice.internalName }}
				/>
			);
	}
}

export function ValidationErrorsAlert(props: {
	count: number;
	fieldName?: string;
	/** The main save action will store a draft until these errors are fixed. */
	willSaveAsDraft?: boolean;
	/** Set when no save, not even a draft, would be written. Replaces the draft wording. */
	minimumRequirements?: MinimumRequirementsNotice;
	onShow(): void;
}) {
	const { formatMessage } = useIntl();
	const showLabel = props.fieldName
		? formatMessage({ defaultMessage: 'Show {field}' }, { field: props.fieldName })
		: formatMessage({ defaultMessage: 'Show the field' });
	return (
		<Alert role="status" severity="warning">
			<Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
				{props.minimumRequirements ? (
					<MinimumRequirementsMessage notice={props.minimumRequirements} />
				) : props.willSaveAsDraft ? (
					<FormattedMessage
						defaultMessage="{count, plural, one {The form has a validation error. This will save as a draft until the error is fixed.} other {The form has # validation errors. This will save as a draft until the errors are fixed.}}"
						values={{ count: props.count }}
					/>
				) : (
					<FormattedMessage
						defaultMessage="{count, plural, one {The form has a validation error that must be fixed before saving.} other {The form has # validation errors that must be fixed before saving.}}"
						values={{ count: props.count }}
					/>
				)}
				<Button color="inherit" size="small" onClick={props.onShow} aria-label={showLabel} sx={{ mt: 1 }}>
					{showLabel}
				</Button>
			</Box>
		</Alert>
	);
}

export default ValidationErrorsAlert;
