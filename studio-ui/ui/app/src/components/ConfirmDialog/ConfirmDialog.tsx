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
import { ConfirmDialogProps } from './utils';
import { AlertDialog } from '../AlertDialog';
import PrimaryButton from '../PrimaryButton';
import { useIntl } from 'react-intl';
import SecondaryButton from '../SecondaryButton';
import translations from './translations';

export function ConfirmDialog(props: ConfirmDialogProps) {
	const { onOk, onCancel, disableOkButton, disableCancelButton, okButtonText, cancelButtonText, ...rest } = props;
	const { formatMessage } = useIntl();
	// Prefer the non-destructive action (cancel / dismiss). Accept stays the default only when it is the sole action.
	const focusCancel = Boolean(onCancel);
	return (
		<AlertDialog
			// The backdrop or escape should trigger the onCancel (this action is likely the one that won't cause data
			// loss or undesired changes). If this action is not provided, then disable backdrop and escape close.
			disableBackdropClick={!onCancel}
			disableEscapeKeyDown={!onCancel}
			{...rest}
			buttons={
				<>
					{onOk && (
						<PrimaryButton onClick={onOk} autoFocus={!focusCancel} fullWidth size="large" disabled={disableOkButton}>
							{okButtonText ?? formatMessage(translations.accept)}
						</PrimaryButton>
					)}
					{onCancel && (
						<SecondaryButton
							onClick={onCancel}
							autoFocus={focusCancel}
							fullWidth
							size="large"
							disabled={disableCancelButton}
						>
							{cancelButtonText ?? formatMessage(translations.cancel)}
						</SecondaryButton>
					)}
				</>
			}
		/>
	);
}

export default ConfirmDialog;
