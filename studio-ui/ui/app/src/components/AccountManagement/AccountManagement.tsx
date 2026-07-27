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

import Box, { BoxProps } from '@mui/material/Box';
import React, { forwardRef, useEffect, useState } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import GlobalAppToolbar from '../GlobalAppToolbar';
import { FormControlLabel, Switch, Typography } from '@mui/material';
import Paper, { paperClasses } from '@mui/material/Paper';
import Avatar from '@mui/material/Avatar';
import Container from '@mui/material/Container';
import { dispatchLanguageChange, getCurrentLocale, setStoredLanguage } from '../../utils/i18n';
import { SystemLang } from '../LoginView/LoginView';
import { fetchProductLanguages } from '../../services/configuration';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import FormHelperText from '@mui/material/FormHelperText';
import Skeleton from '@mui/material/Skeleton';
import PasswordTextField from '../PasswordTextField/PasswordTextField';
import PrimaryButton from '../PrimaryButton';
import { setMyPassword } from '../../services/users';
import { useDispatch } from 'react-redux';
import { showSystemNotification } from '../../state/actions/system';
import { useActiveUser } from '../../hooks/useActiveUser';
import { PasswordStrengthDisplayPopper } from '../PasswordStrengthDisplayPopper';
import Select from '@mui/material/Select';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import useSiteLookup from '../../hooks/useSiteLookup';
import Button from '@mui/material/Button';
import TableContainer from '@mui/material/TableContainer';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import { preferencesGroups } from './utils';
import { NumberField } from '@base-ui-components/react/number-field';
import OutlinedInput, { OutlinedInputProps } from '@mui/material/OutlinedInput';
import AddRounded from '@mui/icons-material/AddRounded';
import MinusRounded from '@mui/icons-material/RemoveRounded';

import { pushErrorDialog } from '../../utils/system';
import {
	getStoredEnableAnimations,
	getStoredSnackbarDuration,
	setStoredEnableAnimations,
	setStoredSnackbarDuration
} from '../../utils/state';
import { USER_PASSWORD_MAX_LENGTH } from '../UserManagement/utils';

const decrementButtonSx: BoxProps['sx'] = {
	borderTopRightRadius: 0,
	borderBottomRightRadius: 0,
	boxShadow: 'none',
	borderRight: 'none'
};

const incrementButtonSx: BoxProps['sx'] = {
	borderTopLeftRadius: 0,
	borderBottomLeftRadius: 0,
	boxShadow: 'none',
	borderLeft: 'none'
};

// MUI OutlinedInput's ref points to the wrapper elements, not to the input. Base UI needs the input directly.
const OutlinedInputWithRef = forwardRef<HTMLInputElement, OutlinedInputProps>((props, ref) => {
	const { sx, ...other } = props;
	return (
		<OutlinedInput
			{...other}
			fullWidth
			inputRef={ref}
			sx={{ borderRadius: 0, py: '0px', input: { textAlign: 'center' }, ...sx }}
		/>
	);
});
OutlinedInputWithRef.displayName = 'OutlinedInputWithRef';

interface AccountManagementProps {
	passwordRequirementsMinComplexity?: number;
}

const translations = defineMessages({
	languageUpdated: {
		id: 'accountManagement.languageUpdated',
		defaultMessage: 'Language preference changed'
	},
	passwordChanged: {
		id: 'accountManagement.passwordChanged',
		defaultMessage: 'Password changed successfully'
	}
});

export const DEFAULT_SNACKBAR_DURATION = 5000;

export function AccountManagement(props: AccountManagementProps) {
	const { passwordRequirementsMinComplexity = 4 } = props;
	const user = useActiveUser();
	const [language, setLanguage] = useState(() => getCurrentLocale());
	const [languages, setLanguages] = useState<SystemLang[]>();
	const [currentPassword, setCurrentPassword] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [verifiedPassword, setVerifiedPassword] = useState('');
	const [validPassword, setValidPassword] = useState(false);
	const dispatch = useDispatch();
	const { formatMessage } = useIntl();
	const [anchorEl, setAnchorEl] = useState(null);
	const sitesLookup = useSiteLookup();
	const sitesIds = Object.keys(sitesLookup);
	const [selectedSite, setSelectedSite] = useState('all');
	const [snackDuration, setSnackDuration] = useState<number | null>(
		getStoredSnackbarDuration(user.username) ?? DEFAULT_SNACKBAR_DURATION
	);
	const [initialSnackDuration, setInitialSnackDuration] = useState<number | null>(snackDuration);
	const [enableAnimations, setEnableAnimations] = useState<boolean>(getStoredEnableAnimations(user.username) ?? true);
	const [initialEnableAnimations, setInitialEnableAnimations] = useState<boolean>(enableAnimations);

	// Retrieve Platform Languages.
	useEffect(() => {
		fetchProductLanguages().subscribe(setLanguages);
	}, []);

	const onLanguageChanged = (language: string) => {
		setLanguage(language);
		setStoredLanguage(language, user.username);
		dispatchLanguageChange(language);
		dispatch(
			showSystemNotification({
				message: formatMessage(translations.languageUpdated)
			})
		);
	};

	const onSave = () => {
		setMyPassword(user.username, currentPassword, newPassword).subscribe({
			next() {
				dispatch(
					showSystemNotification({
						message: formatMessage(translations.passwordChanged)
					})
				);
				setCurrentPassword('');
				setVerifiedPassword('');
				setNewPassword('');
			},
			error({ response: { response } }) {
				dispatch(pushErrorDialog({ props: { error: response } }));
			}
		});
	};

	const onClearPreference = (group, showNotification = true) => {
		if (selectedSite === 'all') {
			sitesIds.forEach((siteId) => {
				group.onClear({
					siteId,
					siteUuid: sitesLookup[siteId].uuid,
					username: user.username
				});
			});
		} else {
			group.onClear({
				siteId: selectedSite,
				siteUuid: sitesLookup[selectedSite].uuid,
				username: user.username
			});
		}
		if (showNotification) {
			dispatch(showSystemNotification({ message: formatMessage({ defaultMessage: 'Preferences cleared' }) }));
		}
	};

	const onClearEverything = () => {
		preferencesGroups.forEach((group) => onClearPreference(group, false));
		dispatch(showSystemNotification({ message: formatMessage({ defaultMessage: 'Preferences cleared' }) }));
	};

	const onSaveAccessibility = () => {
		if (snackDuration === null) return;
		dispatch(
			showSystemNotification({
				message: formatMessage({ defaultMessage: 'Accessibility settings saved' }),
				options: {
					autoHideDuration: snackDuration
				}
			})
		);
		setStoredSnackbarDuration(user.username, snackDuration);
		setInitialSnackDuration(snackDuration);
		setStoredEnableAnimations(user.username, enableAnimations);
		setInitialEnableAnimations(enableAnimations);
	};

	return (
		<Paper elevation={0} sx={{ mb: 2 }}>
			<GlobalAppToolbar title={<FormattedMessage id="words.account" defaultMessage="Account" />} />
			<Container
				maxWidth="md"
				sx={{
					mb: 2,
					pb: 2,
					[`& > .${paperClasses.root}`]: {
						padding: '20px',
						margin: '20px 0',
						background: (theme) => theme.palette.background.default,
						'& .mt20': {
							marginTop: '20px'
						}
					}
				}}
			>
				<Paper className="mt20">
					<Box display="flex" alignItems="center">
						<Avatar sx={{ marginRight: '30px', width: '90px', height: '90px' }}>
							{user.firstName.charAt(0)}
							{user.lastName?.charAt(0) ?? ''}
						</Avatar>
						<section>
							<Typography>
								{user.firstName} {user.lastName}
							</Typography>
							<Typography>{user.email}</Typography>
						</section>
					</Box>
				</Paper>
				<Paper>
					<Typography variant="h5">
						<FormattedMessage id="accountManagement.changeLanguage" defaultMessage="Change Language" />
					</Typography>
					<Box marginTop="16px">
						{languages ? (
							<TextField
								fullWidth
								select
								label={<FormattedMessage id="words.language" defaultMessage="Language" />}
								value={language}
								onChange={(event) => onLanguageChanged(event.target.value)}
							>
								{languages?.map((option) => (
									<MenuItem key={option.id} value={option.id}>
										{option.label}
									</MenuItem>
								))}
							</TextField>
						) : (
							<Skeleton width="100%" height="80px" />
						)}
					</Box>
				</Paper>
				<Paper>
					<Typography variant="h5">
						<FormattedMessage id="accountManagement.changePassword" defaultMessage="Change Password" />
					</Typography>
					<FormHelperText>
						<FormattedMessage
							id="accountManagement.changeHelperText"
							defaultMessage="Once your password has been successfully updated, you'll be required to login again."
						/>
					</FormHelperText>
					<Box display="flex" flexDirection="column">
						<PasswordTextField
							margin="normal"
							label={<FormattedMessage id="accountManagement.currentPassword" defaultMessage="Current Password" />}
							required
							fullWidth
							value={currentPassword}
							onChange={(e) => {
								setCurrentPassword(e.target.value);
							}}
							slotProps={{
								htmlInput: { maxLength: USER_PASSWORD_MAX_LENGTH, autoComplete: 'current-password' }
							}}
						/>
						<PasswordTextField
							margin="normal"
							label={<FormattedMessage id="accountManagement.newPassword" defaultMessage="New Password" />}
							required
							fullWidth
							value={newPassword}
							onChange={(e) => {
								setNewPassword(e.target.value);
							}}
							error={Boolean(newPassword) && !validPassword}
							helperText={
								newPassword &&
								!validPassword && (
									<FormattedMessage id="accountManagement.passwordInvalid" defaultMessage="Password is invalid." />
								)
							}
							onFocus={(e) => setAnchorEl(e.target)}
							onBlur={() => setAnchorEl(null)}
							slotProps={{
								htmlInput: { maxLength: USER_PASSWORD_MAX_LENGTH, autoComplete: 'new-password' }
							}}
						/>
						<PasswordTextField
							margin="normal"
							label={<FormattedMessage id="accountManagement.confirmPassword" defaultMessage="Confirm Password" />}
							required
							fullWidth
							value={verifiedPassword}
							onChange={(e) => {
								setVerifiedPassword(e.target.value);
							}}
							error={newPassword !== verifiedPassword}
							helperText={
								newPassword !== verifiedPassword && (
									<FormattedMessage
										id="accountManagement.passwordMatch"
										defaultMessage="Must match the previous password."
									/>
								)
							}
							slotProps={{
								htmlInput: { maxLength: USER_PASSWORD_MAX_LENGTH, autoComplete: 'new-password' }
							}}
						/>
						<PrimaryButton
							disabled={!validPassword || newPassword !== verifiedPassword || currentPassword === ''}
							sx={{ marginLeft: 'auto' }}
							onClick={() => onSave()}
						>
							<FormattedMessage id="words.save" defaultMessage="Save" />
						</PrimaryButton>
					</Box>
				</Paper>
				<Paper>
					<Typography variant="h5" mb={3}>
						<FormattedMessage defaultMessage="Stored Preferences" />
					</Typography>
					<Typography mb={3} variant="body2">
						<FormattedMessage defaultMessage="Clear your user preferences and reset to defaults per project or for all projects." />
					</Typography>
					<Box display="flex" justifyContent="space-between" mb={3}>
						<FormControl sx={{ minWidth: 200 }}>
							<InputLabel>
								<FormattedMessage defaultMessage="Project" />
							</InputLabel>
							<Select
								value={selectedSite}
								label={<FormattedMessage defaultMessage="Project" />}
								onChange={(event) => {
									setSelectedSite(event.target.value as string);
								}}
							>
								<MenuItem value="all">
									<FormattedMessage defaultMessage="All Projects" />
								</MenuItem>
								{sitesIds.map((siteId) => (
									<MenuItem key={siteId} value={siteId}>
										{sitesLookup[siteId].name}
									</MenuItem>
								))}
							</Select>
						</FormControl>
						<Button variant="outlined" color="warning" size="large" onClick={onClearEverything}>
							<FormattedMessage defaultMessage="Clear everything" />{' '}
							{selectedSite === 'all' && <FormattedMessage defaultMessage="(All Projects)" />}
						</Button>
					</Box>
					<TableContainer component={Paper}>
						<Table size="small">
							<TableBody>
								{preferencesGroups.map((group, index) => (
									<TableRow key={index} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
										<TableCell component="th" scope="row">
											{group.label}
										</TableCell>
										<TableCell align="right">
											<Button variant="text" onClick={() => onClearPreference(group)}>
												<FormattedMessage defaultMessage="Clear" />
											</Button>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</TableContainer>
				</Paper>
				<Paper>
					<Typography variant="h5">
						<FormattedMessage defaultMessage="Accessibility" />
					</Typography>
					<Box display="flex" flexDirection="column">
						<FormControl sx={{ mt: 2, mb: 1 }}>
							<Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
								<InputLabel htmlFor="snackDuration" shrink sx={{ position: 'static', transform: 'none', mb: 0 }}>
									<FormattedMessage defaultMessage="On-screen notification display time (in seconds)" />
								</InputLabel>
								<Button
									variant="text"
									size="small"
									disabled={snackDuration === DEFAULT_SNACKBAR_DURATION}
									onClick={() => setSnackDuration(DEFAULT_SNACKBAR_DURATION)}
								>
									<FormattedMessage defaultMessage="Reset to default" />
								</Button>
							</Box>
							<NumberField.Root
								id="snackDuration"
								value={snackDuration / 1000} // Display in seconds
								onValueChange={(value) => {
									const seconds = Number(value);
									setSnackDuration(
										Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : DEFAULT_SNACKBAR_DURATION
									);
								}} // Store in milliseconds
								min={1}
								max={60}
								step={1}
								format={{ maximumFractionDigits: 0 }}
							>
								<NumberField.Group render={<Box display="flex" />}>
									<NumberField.Decrement render={<Button variant="outlined" sx={decrementButtonSx} />}>
										<MinusRounded />
									</NumberField.Decrement>
									<NumberField.Input render={<OutlinedInputWithRef />} />
									<NumberField.Increment render={<Button variant="outlined" sx={incrementButtonSx} />}>
										<AddRounded />
									</NumberField.Increment>
								</NumberField.Group>
							</NumberField.Root>
							<FormHelperText sx={{ mt: 1, ml: 0 }}>
								<FormattedMessage defaultMessage="How long notifications stay visible at on the screen before closing automatically. These appear when you save, publish, or complete other actions. You can dismiss them anytime using their close button." />
							</FormHelperText>
						</FormControl>

						<FormControl sx={{ my: 2 }}>
							<FormControlLabel
								control={<Switch checked={enableAnimations} onChange={(e) => setEnableAnimations(e.target.checked)} />}
								label={<FormattedMessage defaultMessage="Enable user interface animations" />}
							/>
						</FormControl>
						<PrimaryButton
							disabled={
								snackDuration === null ||
								(initialSnackDuration === snackDuration && initialEnableAnimations === enableAnimations)
							}
							sx={{ marginLeft: 'auto' }}
							onClick={() => onSaveAccessibility()}
						>
							<FormattedMessage id="words.save" defaultMessage="Save" />
						</PrimaryButton>
					</Box>
				</Paper>
			</Container>

			<PasswordStrengthDisplayPopper
				open={Boolean(anchorEl)}
				anchorEl={anchorEl}
				placement="top"
				value={newPassword}
				passwordRequirementsMinComplexity={passwordRequirementsMinComplexity}
				onValidStateChanged={setValidPassword}
			/>
		</Paper>
	);
}

export default AccountManagement;
