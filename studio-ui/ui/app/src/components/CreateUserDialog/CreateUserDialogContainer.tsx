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

import React, { useEffect, useRef, useState } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { useDispatch } from 'react-redux';
import { create } from '../../services/users';
import DialogBody from '../DialogBody/DialogBody';
import TextField from '@mui/material/TextField';
import PasswordTextField from '../PasswordTextField/PasswordTextField';
import DialogFooter from '../DialogFooter/DialogFooter';
import SecondaryButton from '../SecondaryButton';
import PrimaryButton from '../PrimaryButton';
import Grid from '@mui/material/Grid';
import UserGroupMembershipEditor from '../UserGroupMembershipEditor';
import { map, switchMap } from 'rxjs/operators';
import { forkJoin, of } from 'rxjs';
import { addUserToGroup } from '../../services/groups';
import { useSpreadState } from '../../hooks/useSpreadState';
import { CreateUserDialogContainerProps } from './utils';
import {
	isInvalidEmail,
	isInvalidUsername,
	USER_EMAIL_MAX_LENGTH,
	USER_FIRST_NAME_MAX_LENGTH,
	USER_FIRST_NAME_MIN_LENGTH,
	USER_LAST_NAME_MAX_LENGTH,
	USER_LAST_NAME_MIN_LENGTH,
	USER_PASSWORD_MAX_LENGTH,
	USER_USERNAME_MAX_LENGTH,
	USER_USERNAME_MIN_LENGTH,
	validateFieldMinLength
} from '../UserManagement/utils';
import useUpdateRefs from '../../hooks/useUpdateRefs';
import { showSystemNotification } from '../../state/actions/system';
import { PasswordStrengthDisplayPopper } from '../PasswordStrengthDisplayPopper';
import Box from '@mui/material/Box';
import { pushErrorDialog } from '../../utils/system';
import { useEnhancedDialogContext } from '../EnhancedDialog';

const translations = defineMessages({
	invalidMinLength: {
		id: 'createUserDialog.invalidMinLength',
		defaultMessage: 'Min {length} characters'
	},
	userCreated: {
		id: 'createUserDialog.userCreated',
		defaultMessage: 'User created successfully'
	}
});

export function CreateUserDialogContainer(props: CreateUserDialogContainerProps) {
	const { onClose, passwordRequirementsMinComplexity, onCreateSuccess, isSubmitting } = props;
	const [newUser, setNewUser] = useSpreadState({
		firstName: '',
		lastName: '',
		email: '',
		username: '',
		password: '',
		enabled: true
	});
	const [submitted, setSubmitted] = useState(false);
	const [passwordConfirm, setPasswordConfirm] = useState('');
	const [validPassword, setValidPassword] = useState(false);
	const [submitOk, setSubmitOk] = useState(false);
	const [anchorEl, setAnchorEl] = useState(null);
	const { formatMessage } = useIntl();
	const dispatch = useDispatch();
	const selectedGroupsRef = useRef([]);
	const { updateSubmittingOrHasPendingChanges } = useEnhancedDialogContext();
	const functionRefs = useUpdateRefs({
		updateSubmittingOrHasPendingChanges
	});

	const onSubmit = (e: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
		e.preventDefault();
		if (submitOk) {
			// TODO: check API
			functionRefs.current.updateSubmittingOrHasPendingChanges({
				isSubmitting: true
			});
			setSubmitted(true);
			if (Object.values(newUser).every(Boolean)) {
				const trimmedNewUser = {};
				Object.entries(newUser).forEach(([key, value]) => {
					trimmedNewUser[key] = typeof value === 'string' ? value.trim() : value;
				});

				create(trimmedNewUser)
					.pipe(
						switchMap((user) =>
							selectedGroupsRef.current.length
								? forkJoin(selectedGroupsRef.current.map((id) => addUserToGroup(Number(id), user.username))).pipe(
										map(() => user)
									)
								: of(user)
						)
					)
					.subscribe({
						next() {
							dispatch(
								showSystemNotification({
									message: formatMessage(translations.userCreated)
								})
							);
							onCreateSuccess?.();
							functionRefs.current.updateSubmittingOrHasPendingChanges({
								isSubmitting: false
							});
						},
						error({ response: { response } }) {
							functionRefs.current.updateSubmittingOrHasPendingChanges({
								isSubmitting: false
							});
							dispatch(pushErrorDialog({ props: { error: response } }));
						}
					});
			} else {
				setSubmitted(false);
			}
		}
	};

	const validateRequiredField = (field: string) => {
		return submitted && field.trim() === '';
	};

	const validatePasswordMatch = (password, match) => {
		return (submitted && match === '') || match !== password;
	};

	const onSelectedGroupsChanged = (groupIds) => (selectedGroupsRef.current = groupIds);

	const onChangeValue = (key: string, value: string) => {
		let cleanValue = value;

		if (key === 'username') {
			cleanValue = value.trim();
		}

		setNewUser({
			[key]: cleanValue
		});
	};

	const refs = useUpdateRefs({
		validateFieldMinLength
	});
	useEffect(() => {
		setSubmitOk(
			Boolean(
				newUser.firstName.trim() &&
				!refs.current.validateFieldMinLength('firstName', newUser.firstName) &&
				newUser.lastName.trim() &&
				!refs.current.validateFieldMinLength('lastName', newUser.lastName) &&
				!isInvalidEmail(newUser.email) &&
				newUser.username.trim() &&
				!refs.current.validateFieldMinLength('username', newUser.username) &&
				!isInvalidUsername(newUser.username) &&
				newUser.password &&
				validPassword &&
				passwordConfirm &&
				newUser.password === passwordConfirm
			)
		);
		updateSubmittingOrHasPendingChanges({
			hasPendingChanges: Boolean(
				newUser.firstName || newUser.email || newUser.password || validPassword || passwordConfirm
			)
		});
	}, [newUser, passwordConfirm, updateSubmittingOrHasPendingChanges, validPassword, refs]);

	return (
		<Box component="form" sx={{ display: 'contents' }}>
			<DialogBody sx={{ overflow: 'auto' }}>
				<Grid container spacing={2}>
					<Grid size={{ sm: 6 }}>
						<Grid container spacing={2}>
							<Grid size={{ sm: 6 }}>
								<TextField
									autoFocus
									sx={{ marginBottom: (theme) => theme.spacing(1) }}
									label={<FormattedMessage id="createUserDialog.firstName" defaultMessage="First Name" />}
									required
									fullWidth
									margin="normal"
									value={newUser.firstName}
									error={
										validateRequiredField(newUser.firstName) || validateFieldMinLength('firstName', newUser.firstName)
									}
									helperText={
										validateRequiredField(newUser.firstName) ? (
											<FormattedMessage
												id="createUserDialog.firstNameRequired"
												defaultMessage="First Name is required."
											/>
										) : validateFieldMinLength('firstName', newUser.firstName) ? (
											formatMessage(translations.invalidMinLength, { length: USER_FIRST_NAME_MIN_LENGTH })
										) : null
									}
									onChange={(e) => setNewUser({ firstName: e.target.value })}
									slotProps={{
										htmlInput: { maxLength: USER_FIRST_NAME_MAX_LENGTH }
									}}
								/>
							</Grid>
							<Grid size={{ sm: 6 }}>
								<TextField
									sx={{ marginBottom: (theme) => theme.spacing(1) }}
									label={<FormattedMessage id="createUserDialog.lastName" defaultMessage="Last Name" />}
									required
									fullWidth
									margin="normal"
									value={newUser.lastName}
									error={
										validateRequiredField(newUser.lastName) || validateFieldMinLength('lastName', newUser.lastName)
									}
									helperText={
										validateRequiredField(newUser.lastName) ? (
											<FormattedMessage
												id="createUserDialog.lastNameRequired"
												defaultMessage="Last Name is required."
											/>
										) : validateFieldMinLength('lastName', newUser.lastName) ? (
											formatMessage(translations.invalidMinLength, { length: USER_LAST_NAME_MIN_LENGTH })
										) : null
									}
									onChange={(e) => setNewUser({ lastName: e.target.value })}
									slotProps={{
										htmlInput: { maxLength: USER_LAST_NAME_MAX_LENGTH }
									}}
								/>
							</Grid>
						</Grid>
						<TextField
							sx={{ marginBottom: (theme) => theme.spacing(1) }}
							label={<FormattedMessage id="words.email" defaultMessage="E-mail" />}
							required
							fullWidth
							value={newUser.email}
							error={validateRequiredField(newUser.email) || isInvalidEmail(newUser.email)}
							helperText={
								validateRequiredField(newUser.email) ? (
									<FormattedMessage id="createUserDialog.emailRequired" defaultMessage="Email is required." />
								) : isInvalidEmail(newUser.email) ? (
									<FormattedMessage id="createUserDialog.invalidEmail" defaultMessage="Email is invalid." />
								) : null
							}
							onChange={(e) => setNewUser({ email: e.target.value })}
							slotProps={{
								htmlInput: { maxLength: USER_EMAIL_MAX_LENGTH }
							}}
						/>
						<TextField
							sx={{ marginBottom: (theme) => theme.spacing(1) }}
							label={<FormattedMessage id="words.username" defaultMessage="Username" />}
							required
							fullWidth
							value={newUser.username}
							error={
								validateRequiredField(newUser.username) ||
								isInvalidUsername(newUser.username) ||
								validateFieldMinLength('username', newUser.username)
							}
							helperText={
								validateRequiredField(newUser.username) ? (
									<FormattedMessage id="createUserDialog.usernameRequired" defaultMessage="Username is required." />
								) : validateFieldMinLength('username', newUser.username) ? (
									formatMessage(translations.invalidMinLength, { length: USER_USERNAME_MIN_LENGTH })
								) : null
							}
							onChange={(e) => setNewUser({ username: e.target.value })}
							slotProps={{
								htmlInput: { maxLength: USER_USERNAME_MAX_LENGTH }
							}}
						/>
						<Grid container spacing={2}>
							<Grid size={{ sm: 6 }}>
								<PasswordTextField
									sxs={{ root: { marginBottom: (theme) => theme.spacing(1) } }}
									label={<FormattedMessage id="words.password" defaultMessage="Password" />}
									required
									fullWidth
									value={newUser.password}
									error={validateRequiredField(newUser.password) || (newUser.password !== '' && !validPassword)}
									helperText={
										validateRequiredField(newUser.password) ? (
											<FormattedMessage id="createUserDialog.passwordRequired" defaultMessage="Password is required." />
										) : newUser.password !== '' && !validPassword ? (
											<FormattedMessage id="createUserDialog.passwordInvalid" defaultMessage="Password is invalid." />
										) : null
									}
									onChange={(e) => onChangeValue('password', e.target.value)}
									onFocus={(e) => setAnchorEl(e.target.parentElement)}
									onBlur={() => setAnchorEl(null)}
									slotProps={{
										htmlInput: { maxLength: USER_PASSWORD_MAX_LENGTH, autoComplete: 'new-password' }
									}}
								/>
							</Grid>
							<Grid size={{ sm: 6 }}>
								<PasswordTextField
									sxs={{ root: { marginBottom: (theme) => theme.spacing(1) } }}
									label={
										<FormattedMessage
											id="createUserDialog.passwordVerification"
											defaultMessage="Password Verification"
										/>
									}
									fullWidth
									required
									value={passwordConfirm}
									error={validatePasswordMatch(newUser.password, passwordConfirm)}
									helperText={
										validatePasswordMatch(newUser.password, passwordConfirm) && (
											<FormattedMessage
												id="createUserDialog.passwordMatch"
												defaultMessage="Must match the previous password."
											/>
										)
									}
									onChange={(e) => setPasswordConfirm(e.target.value)}
								/>
							</Grid>
						</Grid>
					</Grid>
					<Grid size={{ sm: 6 }}>
						<UserGroupMembershipEditor onChange={onSelectedGroupsChanged} />
					</Grid>
				</Grid>
				<PasswordStrengthDisplayPopper
					open={Boolean(anchorEl)}
					anchorEl={anchorEl}
					placement="top"
					value={newUser.password}
					passwordRequirementsMinComplexity={passwordRequirementsMinComplexity}
					onValidStateChanged={setValidPassword}
				/>
			</DialogBody>
			<DialogFooter>
				<SecondaryButton onClick={(e) => onClose(e, null)}>
					<FormattedMessage id="words.cancel" defaultMessage="Cancel" />
				</SecondaryButton>
				<PrimaryButton type="submit" onClick={onSubmit} disabled={!submitOk || isSubmitting} loading={isSubmitting}>
					<FormattedMessage id="words.submit" defaultMessage="Submit" />
				</PrimaryButton>
			</DialogFooter>
		</Box>
	);
}

export default CreateUserDialogContainer;
