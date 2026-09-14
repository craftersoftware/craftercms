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

import Dialog from '@mui/material/Dialog';
import React, { useState } from 'react';
import User from '../../models/User';
import DialogHeader from '../DialogHeader/DialogHeader';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import DialogBody from '../DialogBody/DialogBody';
import { Typography } from '@mui/material';
import DialogFooter from '../DialogFooter/DialogFooter';
import SecondaryButton from '../SecondaryButton';
import PrimaryButton from '../PrimaryButton';
import { setPassword } from '../../services/users';
import { useDispatch } from 'react-redux';
import { showSystemNotification } from '../../state/actions/system';
import PasswordTextField from '../PasswordTextField/PasswordTextField';
import { PasswordStrengthDisplayPopper } from '../PasswordStrengthDisplayPopper';
import { pushErrorDialog } from '../../utils/system';
import { USER_PASSWORD_MAX_LENGTH } from '../UserManagement/utils';

interface ResetPasswordDialogProps {
	open: boolean;
	onClose(): void;
	user: User;
	passwordRequirementsMinComplexity: number;
}

const translations = defineMessages({
	passwordUpdated: {
		id: 'resetPasswordDialog.passwordUpdated',
		defaultMessage: 'Password updated successfully'
	}
});

export function ResetPasswordDialog(props: ResetPasswordDialogProps) {
	const { open, onClose } = props;
	return (
		<Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
			<ResetPasswordDialogUI {...props} />
		</Dialog>
	);
}

function ResetPasswordDialogUI(props: ResetPasswordDialogProps) {
	const { onClose, user, passwordRequirementsMinComplexity } = props;
	const [newPassword, setNewPassword] = useState('');
	const [isValid, setValid] = useState<boolean>(null);
	const [updating, setUpdating] = useState(false);
	const [anchorEl, setAnchorEl] = useState(null);
	const dispatch = useDispatch();
	const { formatMessage } = useIntl();

	const onSubmit = (e: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
		e.preventDefault();
		setUpdating(true);
		setPassword(user.username, newPassword).subscribe({
			next() {
				dispatch(
					showSystemNotification({
						message: formatMessage(translations.passwordUpdated)
					})
				);
				setUpdating(false);
				onClose();
			},
			error({ response: { response } }) {
				setUpdating(false);
				dispatch(pushErrorDialog({ props: { error: response } }));
			}
		});
	};

	return (
		<form onSubmit={onSubmit}>
			<DialogHeader
				title={<FormattedMessage id="resetPasswordDialog.title" defaultMessage="Reset Password" />}
				onCloseButtonClick={onClose}
			/>
			<DialogBody>
				<Typography variant="body2">
					<FormattedMessage
						id="resetPasswordDialog.helperText"
						defaultMessage='Set a new password for "{user}" user'
						values={{ user: props.user.username }}
					/>
				</Typography>
				<PasswordTextField
					value={newPassword}
					autoFocus
					required
					type="password"
					placeholder="●●●●●●●●"
					margin="normal"
					onChange={(e) => {
						setNewPassword(e.target.value);
					}}
					onFocus={(e) => setAnchorEl(e.target)}
					onBlur={() => setAnchorEl(null)}
					slotProps={{
						htmlInput: { maxLength: USER_PASSWORD_MAX_LENGTH, autoComplete: 'new-password' }
					}}
				/>
				<PasswordStrengthDisplayPopper
					open={Boolean(anchorEl)}
					anchorEl={anchorEl}
					placement="top"
					value={newPassword}
					passwordRequirementsMinComplexity={passwordRequirementsMinComplexity}
					onValidStateChanged={setValid}
				/>
			</DialogBody>
			<DialogFooter>
				<SecondaryButton onClick={onClose}>
					<FormattedMessage id="words.cancel" defaultMessage="Cancel" />
				</SecondaryButton>
				<PrimaryButton
					type="submit"
					onClick={onSubmit}
					autoFocus
					disabled={newPassword === '' || updating || !isValid}
					loading={updating}
				>
					<FormattedMessage id="words.submit" defaultMessage="Submit" />
				</PrimaryButton>
			</DialogFooter>
		</form>
	);
}

export default ResetPasswordDialog;
