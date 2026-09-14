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

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import {
	sendPasswordRecovery,
	setPassword as setPasswordService,
	validatePasswordResetToken
} from '../../services/auth';
import { isBlank, unescapeHTML } from '../../utils/string';
import Typography from '@mui/material/Typography';
import LogInForm from '../LoginForm/LoginForm';
import MenuItem from '@mui/material/MenuItem';
import { fetchProductLanguages } from '../../services/configuration';
import WarningRounded from '@mui/icons-material/WarningRounded';
import queryString from 'query-string';
import TextField from '@mui/material/TextField';
import Snackbar from '@mui/material/Snackbar';
import PasswordTextField from '../PasswordTextField/PasswordTextField';
import { passwordRequirementMessages } from '../../env/i18n-legacy';
import { filter } from 'rxjs/operators';
import palette from '../../styles/palette';
import { buildStoredLanguageKey, dispatchLanguageChange, getCurrentLocale, setStoredLanguage } from '../../utils/i18n';
import CrafterCMSLogo from '../../icons/CrafterCMSLogo';
import LanguageRounded from '@mui/icons-material/LanguageRounded';
import Menu from '@mui/material/Menu';
import { useMount } from '../../hooks/useMount';
import { useDebouncedInput } from '../../hooks/useDebouncedInput';
import { PasswordStrengthDisplayPopper } from '../PasswordStrengthDisplayPopper';
import { USER_PASSWORD_MAX_LENGTH, USER_USERNAME_MAX_LENGTH } from '../UserManagement/utils';
import useTimer from '../../hooks/useTimer';
import { nnou } from '../../utils/object';
import moment from 'moment-timezone';
import useSnackbarDuration from '../../hooks/useSnackbarDuration';

export interface SystemLang {
	id: string;
	label: string;
}

interface LanguageDropDownProps {
	language: string;
	onChange: Function;
	languages: SystemLang[];
}

export interface LoginViewProps {
	xsrfToken: string;
	xsrfParamName: string;
	passwordRequirementsMinComplexity: number;
	lockedErrorMessage?: string;
	lockedTimeSeconds?: number;
}

type Modes = 'login' | 'recover' | 'reset';

type SubViewProps = React.PropsWithChildren<{
	token?: string;
	language?: string;
	setMode?: React.Dispatch<React.SetStateAction<Modes>>;
	passwordRequirementsMinComplexity?: number;
	children: React.ReactNode;
	isFetching: boolean;
	onSubmit: React.Dispatch<React.SetStateAction<boolean>>;
	classes?: Partial<Record<any, string>>;
	formatMessage: Function;
	onSnack: React.Dispatch<React.SetStateAction<{ open: boolean; message: string }>>;
	setLanguage: React.Dispatch<React.SetStateAction<string>>;
	onRecover: Function;
	xsrfParamName: string;
	xsrfToken: string;
	lockedErrorMessage?: string;
	lockedTimeSeconds?: number;
}>;

const translations = defineMessages({
	loginDialogTitle: {
		id: 'loginView.dialogTitleText',
		defaultMessage: 'Login to CrafterCMS'
	},
	incorrectCredentialsMessage: {
		id: 'loginView.incorrectCredentialsMessage',
		defaultMessage: 'Incorrect username or password. Please try again.'
	},
	languageDropDownLabel: {
		id: 'words.language',
		defaultMessage: 'Language'
	},
	recoverYourPasswordViewTitle: {
		id: 'loginView.recoverYourPasswordIntroText',
		defaultMessage: 'If your username exists, an email will be sent to you with a reset link.'
	},
	recoverYourPasswordSuccessMessage: {
		id: 'loginView.recoverYourPasswordSuccessMessage',
		defaultMessage: 'If the user exists, a recovery email has been sent'
	},
	resetPasswordFieldPlaceholderLabel: {
		id: 'resetView.resetPasswordFieldPlaceholderLabel',
		defaultMessage: 'New Password'
	},
	resetPasswordConfirmFieldPlaceholderLabel: {
		id: 'resetView.resetPasswordConfirmFieldPlaceholderLabel',
		defaultMessage: 'Confirm Password'
	},
	resetPasswordSuccess: {
		id: 'resetView.resetPasswordSuccess',
		defaultMessage: 'Password successfully reset. Please login with your new password.'
	},
	resetPasswordError: {
		id: 'resetView.resetPasswordError',
		defaultMessage: 'Error resetting password. Token may be invalid or expired.'
	},
	resetPasswordInvalidToken: {
		id: 'resetView.resetPasswordInvalidToken',
		defaultMessage: 'Token validation failed.'
	},
	lockedAccountTryAgain: {
		defaultMessage: 'Try again {fullTime, select, true {{time}} other {in {time} seconds}}'
	}
});

const retrieveStoredLangPreferences = () =>
	Object.keys(window.localStorage).filter((key) => key.includes('_crafterStudioLanguage'));

function LoginView(props: SubViewProps) {
	const {
		children,
		isFetching,
		onSubmit,
		classes,
		setLanguage,
		onRecover,
		formatMessage,
		xsrfParamName,
		xsrfToken,
		language,
		lockedErrorMessage,
		lockedTimeSeconds
	} = props;
	const [username, setUsername] = useState(() => localStorage.getItem('username') ?? '');
	const [password, setPassword] = useState('');
	const [error, setError] = useState('');
	const lockedTimer = useTimer(lockedTimeSeconds);
	const username$ = useDebouncedInput(
		useCallback(
			(user: string) => {
				const key = buildStoredLanguageKey(user);
				if (retrieveStoredLangPreferences().includes(key)) {
					setLanguage(window.localStorage.getItem(key));
				}
			},
			[setLanguage]
		),
		200
	);
	useMount(() => {
		username$.next(username);
	});
	const qsError = queryString.parse(window.location.search).error;
	useEffect(() => {
		if (lockedErrorMessage && nnou(lockedTimer)) {
			if (lockedTimer === 0) {
				setError(null);
			} else {
				setError(
					`${unescapeHTML(lockedErrorMessage)}. ${formatMessage(translations.lockedAccountTryAgain, {
						fullTime: lockedTimer > 60,
						time: lockedTimer > 60 ? moment().add(lockedTimer, 'seconds').fromNow() : lockedTimer
					})}`
				);
			}
		} else if (qsError) {
			setError(formatMessage(translations.incorrectCredentialsMessage));
			// This avoids keeping a stored language for a username that is incorrect.
			// e.g. wrong username submitted.
			localStorage.removeItem(buildStoredLanguageKey(username));
			localStorage.removeItem('username');
		}
	}, [formatMessage, qsError, username, lockedErrorMessage, lockedTimeSeconds, lockedTimer]);
	const handleSubmit = (e: any) => {
		if (isBlank(password) || isBlank(username)) {
			e.preventDefault();
			e.stopPropagation();
		} else {
			localStorage.setItem('username', username);
			setStoredLanguage(language, username);
			setError('');
			onSubmit(true);
		}
	};
	return (
		<>
			<DialogContent>
				<HeaderView error={error} introMessage="" classes={classes} />
				<LogInForm
					children={children}
					classes={classes}
					onSubmit={handleSubmit}
					username={username}
					password={password}
					isFetching={isFetching}
					enableUsernameInput={true}
					onSetPassword={setPassword}
					onRecover={onRecover}
					onSetUsername={(user) => {
						setUsername(user);
						username$.next(user);
					}}
					xsrfParamName={xsrfParamName}
					xsrfToken={xsrfToken}
				/>
			</DialogContent>
		</>
	);
}

function RecoverView(props: SubViewProps) {
	const { children, isFetching, onSubmit, classes, formatMessage, onSnack, setMode } = props;
	const [username, setUsername] = useState(() => localStorage.getItem('username') ?? '');
	const [error, setError] = useState('');
	const onSubmitRecover = (e: any) => {
		e.preventDefault();
		e.stopPropagation();
		setError('');
		onSubmit(true);
		if (isBlank(username)) {
			onSubmit(false);
		} else {
			sendPasswordRecovery(username).subscribe({
				next() {
					onSubmit(false);
					setMode('login');
					onSnack({
						open: true,
						message: formatMessage(translations.recoverYourPasswordSuccessMessage)
					});
				},
				error(error) {
					onSubmit(false);
					setError(error.message);
				}
			});
		}
	};
	return (
		<form onSubmit={onSubmitRecover}>
			<DialogContent>
				<HeaderView
					error={error}
					classes={classes}
					introMessage={formatMessage(translations.recoverYourPasswordViewTitle)}
				/>
				{children}
				<TextField
					id="recoverFormUsernameField"
					fullWidth
					autoFocus
					disabled={isFetching}
					type="text"
					value={username}
					onChange={(e: any) => setUsername(e.target.value)}
					className={classes?.username}
					label={<FormattedMessage id="loginView.usernameTextFieldLabel" defaultMessage="Username" />}
					slotProps={{
						htmlInput: { maxLength: USER_USERNAME_MAX_LENGTH }
					}}
				/>
				<Button
					type="submit"
					color="primary"
					onClick={onSubmitRecover}
					disabled={isBlank(username) || isFetching}
					variant="contained"
					style={{ marginTop: 15 }}
					fullWidth
				>
					<FormattedMessage id="words.submit" defaultMessage="Submit" />
				</Button>
			</DialogContent>
			<DialogActions>
				<Button
					fullWidth
					type="button"
					color="primary"
					variant="text"
					disabled={isFetching}
					onClick={() => setMode('login')}
				>
					&laquo; <FormattedMessage id="loginView.recoverYourPasswordBackButtonLabel" defaultMessage="Back" />
				</Button>
			</DialogActions>
		</form>
	);
}

function ResetView(props: SubViewProps) {
	const {
		children,
		isFetching,
		onSubmit,
		classes,
		formatMessage,
		onSnack,
		setMode,
		token,
		passwordRequirementsMinComplexity
	} = props;
	const [newPassword, setNewPassword] = useState('');
	const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
	const [isValid, setValid] = useState<boolean>(null);
	const [passwordsMismatch, setPasswordMismatch] = useState(false);
	const [error, setError] = useState('');
	const [anchorEl, setAnchorEl] = useState(null);
	const submitDisabled = newPassword === '' || isFetching || !isValid;
	useEffect(() => {
		if (isBlank(newPasswordConfirm) || newPasswordConfirm === newPassword) {
			setPasswordMismatch(false);
		} else if (newPasswordConfirm !== newPassword) {
			setPasswordMismatch(true);
		}
	}, [newPassword, newPasswordConfirm]);
	useEffect(() => {
		validatePasswordResetToken(token)
			.pipe(filter((isValid) => !isValid))
			.subscribe(
				() => {
					setError(formatMessage(translations.resetPasswordInvalidToken));
				},
				() => {
					setError(formatMessage(translations.resetPasswordInvalidToken));
				}
			);
	}, [formatMessage, token]);
	const submit = (e: any) => {
		e.preventDefault();
		e.stopPropagation();
		if (!isBlank(newPassword) && !isBlank(newPasswordConfirm)) {
			onSubmit(true);
			setPasswordService(token, newPassword, newPasswordConfirm).subscribe(
				() => {
					onSubmit(false);
					setMode('login');
					onSnack({ open: true, message: formatMessage(translations.resetPasswordSuccess) });
				},
				() => {
					onSubmit(false);
					setError(formatMessage(translations.resetPasswordError));
				}
			);
		}
	};
	return (
		<form onSubmit={submit}>
			<DialogContent>
				<HeaderView
					error={error}
					classes={classes}
					introMessage={
						<FormattedMessage
							id="loginView.resetYourPasswordIntroText"
							defaultMessage="Please enter your new password"
						/>
					}
				/>
				<PasswordStrengthDisplayPopper
					open={Boolean(anchorEl)}
					anchorEl={anchorEl}
					placement="top"
					value={newPassword}
					passwordRequirementsMinComplexity={passwordRequirementsMinComplexity}
					onValidStateChanged={setValid}
				/>
				<PasswordTextField
					id="resetFormPasswordField"
					fullWidth
					error={isValid !== null && !isValid}
					value={newPassword}
					onChange={(e) => setNewPassword(e.target.value)}
					className={classes?.resetPassword}
					sxs={{ root: { mb: 0 } }}
					placeholder={formatMessage(translations.resetPasswordFieldPlaceholderLabel)}
					onFocus={(e) => setAnchorEl(e.target)}
					onBlur={() => setAnchorEl(null)}
					slotProps={{
						htmlInput: { maxLength: USER_PASSWORD_MAX_LENGTH, autoComplete: 'new-password' }
					}}
				/>
				<PasswordTextField
					id="resetFormPasswordConfirmField"
					fullWidth
					helperText={
						passwordsMismatch ? formatMessage(passwordRequirementMessages.passwordConfirmationMismatch) : null
					}
					error={passwordsMismatch}
					value={newPasswordConfirm}
					onChange={(e) => setNewPasswordConfirm(e.target.value)}
					className={classes?.resetPassword}
					sxs={{ root: { mb: 0 } }}
					placeholder={formatMessage(translations.resetPasswordConfirmFieldPlaceholderLabel)}
					slotProps={{
						htmlInput: { maxLength: USER_PASSWORD_MAX_LENGTH, autoComplete: 'new-password' }
					}}
				/>
				{children}
			</DialogContent>
			<DialogActions>
				<Button type="submit" color="primary" disabled={submitDisabled} variant="contained" fullWidth>
					<FormattedMessage id="words.submit" defaultMessage="Submit" />
				</Button>
			</DialogActions>
		</form>
	);
}

function HeaderView({ error, introMessage, classes }: any) {
	return (
		<Typography
			variant="body2"
			className={classes?.[error ? 'errorMessage' : 'recoverInfoMessage']}
			sx={
				error
					? (theme) => ({
							backgroundColor: palette.red.tint,
							color: palette.white,
							marginBottom: theme.spacing(1),
							padding: theme.spacing(1),
							borderRadius: theme.spacing(1),
							border: `1px solid ${palette.red.main}`,
							display: 'flex',
							placeContent: 'center',
							lineHeight: 1.7,
							'& .MuiSvgIcon-root': {
								marginRight: theme.spacing(0.5),
								color: palette.white
							}
						})
					: {
							maxWidth: 300,
							textAlign: 'center',
							margin: (theme) => `0 auto ${theme.spacing(1.5)}`
						}
			}
		>
			{error ? (
				<>
					<WarningRounded /> {error}
				</>
			) : (
				introMessage
			)}
		</Typography>
	);
}

function UnrecognizedView({ classes }: { classes?: SubViewProps['classes'] }) {
	return (
		<DialogContent>
			<Typography
				variant="body2"
				className={classes?.recoverInfoMessage}
				sx={{
					maxWidth: 300,
					textAlign: 'center',
					margin: (theme) => `0 auto ${theme.spacing(1.5)}`
				}}
			>
				<FormattedMessage defaultMessage="Unrecognized mode." />
			</Typography>
		</DialogContent>
	);
}

function LanguageDropDown(props: LanguageDropDownProps) {
	const { formatMessage } = useIntl();
	const buttonRef = useRef(undefined);
	const [openMenu, setOpenMenu] = useState(false);
	const { language, languages, onChange } = props;
	return (
		<>
			<Button
				ref={buttonRef}
				onClick={() => setOpenMenu(true)}
				style={{ position: 'absolute', bottom: -50, width: '100%', color: 'white' }}
				startIcon={<LanguageRounded />}
			>
				{formatMessage(translations.languageDropDownLabel)}
			</Button>
			<Menu
				anchorEl={buttonRef.current}
				anchorOrigin={{ horizontal: 'center', vertical: 'center' }}
				open={openMenu}
				onClose={() => setOpenMenu(false)}
			>
				{languages?.map(({ id, label }) => (
					<MenuItem
						selected={id === language}
						key={id}
						onClick={() => {
							setOpenMenu(false);
							onChange(id);
						}}
					>
						{label}
					</MenuItem>
				))}
			</Menu>
		</>
	);
}

export function LoginViewContainer(props: LoginViewProps) {
	const { formatMessage } = useIntl();
	const token = queryString.parse(window.location.search).token as string;
	const { xsrfToken, xsrfParamName, passwordRequirementsMinComplexity, lockedErrorMessage, lockedTimeSeconds } = props;

	const [mode, setMode] = useState<Modes>(token ? 'reset' : 'login');
	const [language, setLanguage] = useState(() => getCurrentLocale());
	const [languages, setLanguages] = useState<SystemLang[]>();
	const [snack, onSnack] = useState<{ open: boolean; message: string; autoHideDuration?: number }>({
		open: false,
		message: ''
	});
	const autoHideDuration = useSnackbarDuration();
	const [isFetching, onSubmit] = useState(false);

	let [CurrentView, setCurrentView] = useState<React.ElementType>(() => LoginView);
	let currentViewProps: SubViewProps = {
		setMode,
		token,
		language,
		formatMessage,
		isFetching,
		onSubmit,
		onSnack,
		passwordRequirementsMinComplexity,
		setLanguage,
		onRecover: () => setMode('recover'),
		xsrfToken,
		xsrfParamName,
		children: null,
		lockedErrorMessage,
		lockedTimeSeconds
	};

	// Retrieve Platform Languages.
	useEffect(() => {
		fetchProductLanguages().subscribe(setLanguages);
	}, []);

	// View specific adjustments (based on mode).
	useEffect(() => {
		switch (mode) {
			case 'login':
				setCurrentView(() => LoginView);
				break;
			case 'recover':
				setCurrentView(() => RecoverView);
				const EVENT = 'keydown';
				const handler = (e: any) => {
					if (e.key === 'Escape') {
						setMode('login');
					}
				};
				document.addEventListener(EVENT, handler, false);
				return () => {
					document.removeEventListener(EVENT, handler, false);
				};
			case 'reset':
				setCurrentView(() => ResetView);
				break;
			default:
				setCurrentView(() => UnrecognizedView);
				break;
		}
	}, [mode]);

	// Dispatch custom event when language is changed.
	useEffect(() => {
		if (language) {
			setStoredLanguage(language);
			dispatchLanguageChange(language);
		}
	}, [language]);

	return (
		<>
			<Dialog
				fullWidth
				open={true}
				maxWidth="xs"
				sx={(theme) => ({
					transition: 'all 600ms ease',
					'& .MuiInput-input': { backgroundColor: theme.palette.background.paper },
					'& .MuiFormControl-root, & .MuiButton-root': {
						marginBottom: theme.spacing(1),
						'&.last-before-button': { marginBottom: theme.spacing(2) }
					},
					opacity: isFetching ? 0.2 : 1
				})}
				PaperProps={{
					sx: {
						minWidth: 300,
						overflow: 'visible',
						backgroundColor: (theme) =>
							theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, .8)' : 'rgba(255, 255, 255, .8)'
					}
				}}
				aria-labelledby="loginDialog"
			>
				<DialogTitle id="loginDialog">
					<CrafterCMSLogo
						sxs={{
							root: {
								maxWidth: 250,
								display: 'block',
								margin: (theme) => `${theme.spacing(2)} auto ${theme.spacing(1)}`
							}
						}}
						width="auto"
						alt={formatMessage(translations.loginDialogTitle)}
					/>
				</DialogTitle>
				<CurrentView {...currentViewProps} />
				<LanguageDropDown language={language} languages={languages} onChange={setLanguage} />
			</Dialog>
			<Snackbar
				open={snack.open}
				autoHideDuration={snack.autoHideDuration ?? autoHideDuration}
				onClose={() => onSnack({ open: false, message: '' })}
				anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
				message={snack.message}
			/>
		</>
	);
}

export default LoginViewContainer;
