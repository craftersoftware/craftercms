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
import DialogTitle from '@mui/material/DialogTitle';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import DialogContent from '@mui/material/DialogContent';
import TextField from '@mui/material/TextField';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import React, { CSSProperties, PropsWithChildren, useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { login, loginComplete, logout } from '../../state/actions/auth';
import loginGraphicUrl from '../../assets/authenticate.svg';
import { isBlank } from '../../utils/string';
import Typography from '@mui/material/Typography';
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded';
import LogInForm from '../LoginForm';
import { me } from '../../services/users';
import ApiResponseErrorState from '../ApiResponseErrorState';
import ErrorState from '../ErrorState/ErrorState';
import { useSelection } from '../../hooks/useSelection';
import { PartialSxRecord } from '../../models';
import Box from '@mui/material/Box';
import palette from '../../styles/palette';
import { WarningRounded } from '@mui/icons-material';
import { INCORRECT_CREDENTIALS_ERROR_CODE } from '../../state/reducers/auth';

const translations = defineMessages({
	sessionExpired: {
		id: 'authMonitor.sessionExpiredMessage',
		defaultMessage: 'Your session has expired. Please log back in.'
	},
	incorrectPasswordMessage: {
		id: 'authMonitor.incorrectPasswordMessage',
		defaultMessage: 'Incorrect username or password. Please try again.'
	},
	postSSOLoginMismatch: {
		id: 'authMonitor.postSSOLoginMismatchMessage',
		defaultMessage:
			"Looks like you've logged in with a user different from the owner of this session. For security reasons, your screen will now be refreshed."
	}
});

export function AuthMonitor() {
	const dispatch = useDispatch();
	const { formatMessage } = useIntl();
	const { username, authenticationType } = useSelection((state) => state.user) ?? {
		username: '',
		authenticationType: 'db'
	};
	const { authoringBase, logoutUrl } = useSelection((state) => state.env);
	const { active } = useSelection((state) => state.auth);
	const isSSO = authenticationType === 'saml' || authenticationType === 'auth_headers';
	const firstRender = useRef(true);
	useEffect(() => {
		// On regular login dialog, the username is locked to the user whose session expired; on the
		// SSO form however, users can enter any username/password. So this check ensures that if a
		// different user logs in after timeout, he won't be working on top of the previous user's work/session.
		if (firstRender.current) {
			firstRender.current = false;
		} else if (active) {
			// Move this call to the next tick to avoid it getting dispatched
			// before the epics set the new JWT header.
			setTimeout(() => {
				me().subscribe((user) => {
					if (user.username !== username) {
						alert(formatMessage(translations.postSSOLoginMismatch));
						window.location.reload();
					}
				});
			}, 0);
		}
	}, [active, dispatch, formatMessage, username]);
	return (
		<Dialog open={!active} id="authMonitorDialog" aria-labelledby="craftercmsReLoginDialog">
			<AuthMonitorBody
				isSSO={isSSO}
				username={username}
				logoutUrl={logoutUrl}
				authoringUrl={authoringBase}
				dispatch={dispatch}
				formatMessage={formatMessage}
			/>
		</Dialog>
	);
}

interface AuthMonitorBodyProps {
	logoutUrl: string;
	authoringUrl: string;
	username: string;
	isSSO: boolean;
	dispatch: Function;
	formatMessage: Function;
}

function AuthMonitorBody(props: AuthMonitorBodyProps) {
	const { authoringUrl, username, isSSO, dispatch, formatMessage } = props;
	const { error, isFetching } = useSelection((state) => state.auth);
	const [password, setPassword] = useState<string>('');
	const [ssoButtonClicked, setSSOButtonClicked] = useState(false);
	const styles: CSSProperties = isFetching ? { visibility: 'hidden' } : {};
	const onSubmit = (e: any) => {
		e.preventDefault();
		e.stopPropagation();
		if (isSSO) {
			dispatch(loginComplete());
			setSSOButtonClicked(false);
		} else {
			!isBlank(password) && dispatch(login({ username, password }));
		}
	};
	const onClose = () => dispatch(logout());
	return (
		<>
			<DialogTitle id="craftercmsReLoginDialog" sx={{ textAlign: 'center' }} style={styles}>
				<FormattedMessage id="authMonitor.dialogTitleText" defaultMessage="Session Expired" />
			</DialogTitle>
			<DialogContent sx={{ width: '400px' }}>
				<>
					{error ? (
						error.code === INCORRECT_CREDENTIALS_ERROR_CODE ? (
							<Typography
								variant="body2"
								role="alert"
								sx={(theme) => ({
									backgroundColor: palette.red.tint,
									color: palette.white,
									marginBottom: theme.spacing(2),
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
								})}
							>
								<WarningRounded /> {formatMessage(translations.incorrectPasswordMessage)}
							</Typography>
						) : (
							<ApiResponseErrorState error={error} sxs={{ image: { width: 150 } }} />
						)
					) : (
						<ErrorState
							imageUrl={loginGraphicUrl}
							sxs={{ image: { width: 150 } }}
							message={formatMessage(translations.sessionExpired)}
						/>
					)}
					{isSSO ? (
						<SSOForm
							authoringUrl={authoringUrl}
							username={username}
							onSubmit={onSubmit}
							ssoButtonClicked={ssoButtonClicked}
							onSetSSOButtonClicked={setSSOButtonClicked}
						/>
					) : (
						<LogInForm
							username={username}
							isFetching={isFetching}
							onSubmit={onSubmit}
							password={password}
							onSetPassword={setPassword}
						/>
					)}
				</>
			</DialogContent>
			<DialogActions sx={{ placeContent: 'center space-between' }} style={styles}>
				{isSSO && (
					<Button fullWidth type="button" color="primary" onClick={onSubmit} disabled={isFetching} variant="contained">
						<FormattedMessage id="authMonitor.validateSessionButtonLabel" defaultMessage="Resume" />
					</Button>
				)}
				<Button fullWidth type="button" color="primary" onClick={onClose} disabled={isFetching} variant="text">
					<FormattedMessage id="authMonitor.logOutButtonLabel" defaultMessage="Log Out" />
				</Button>
			</DialogActions>
		</>
	);
}

type SSOFormProps = PropsWithChildren<{
	username: string;
	authoringUrl: string;
	onSubmit: (e) => any;
	ssoButtonClicked: boolean;
	onSetSSOButtonClicked: Function;
	classes?: Record<'ssoAction' | 'input', string>;
	sxs?: PartialSxRecord<'ssoAction' | 'input'>;
}>;

function SSOForm(props: SSOFormProps) {
	const { username, onSubmit, authoringUrl, ssoButtonClicked, onSetSSOButtonClicked, classes, sxs } = props;
	const onOpenLogin = () => {
		window.open(`${authoringUrl}/login/resume`, '_blank', 'toolbar=0,location=0,menubar=0,dependent=true');
		onSetSSOButtonClicked(true);
	};
	return (
		<form onSubmit={onSubmit}>
			<TextField
				fullWidth
				disabled
				type="email"
				value={username}
				className={classes?.input}
				sx={sxs?.input}
				label={<FormattedMessage id="authMonitor.usernameTextFieldLabel" defaultMessage="Username" />}
			/>
			<Box
				component="section"
				className={classes?.ssoAction}
				sx={{
					textAlign: 'center',
					display: 'flex',
					flexDirection: 'column',
					marginTop: (theme) => theme.spacing(1),
					...sxs?.ssoAction
				}}
			>
				<Button
					type="button"
					color="primary"
					variant={ssoButtonClicked ? 'outlined' : 'contained'}
					onClick={onOpenLogin}
					endIcon={<OpenInNewRounded />}
				>
					<FormattedMessage id="authMonitor.openSSOLoginButtonLabel" defaultMessage="Open Login Form" />
				</Button>
				<Typography variant="caption">
					<FormattedMessage
						id="authMonitor.ssoOpenPopupMessage"
						defaultMessage={
							'Make sure pop ups are not blocked. Once you log in, come back to ' +
							'this window and click on `Resume` button below.'
						}
					/>
				</Typography>
			</Box>
		</form>
	);
}

export default AuthMonitor;
