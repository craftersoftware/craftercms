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
import { encrypt as encryptService } from '../../services/security';
import Snackbar from '@mui/material/Snackbar';
import SnackbarContent from '@mui/material/SnackbarContent';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { green, red } from '@mui/material/colors';
import { setRequestForgeryToken } from '../../utils/auth';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import GlobalAppToolbar from '../GlobalAppToolbar';
import Box from '@mui/material/Box';
import { useSpreadState } from '../../hooks/useSpreadState';
import Paper from '@mui/material/Paper';
import { onSubmittingAndOrPendingChangeProps } from '../../hooks/useEnhancedDialogState';
import useUpdateRefs from '../../hooks/useUpdateRefs';
import { copyToClipboard } from '../../utils/system';
import useSnackbarDuration from '../../hooks/useSnackbarDuration';

export interface EncryptToolProps {
	site?: string;
	embedded?: boolean;
	showAppsButton?: boolean;
	onSubmittingAndOrPendingChange?(value: onSubmittingAndOrPendingChangeProps): void;
}

const messages = defineMessages({
	inputLabel: {
		id: 'encryptTool.inputLabel',
		defaultMessage: 'Raw Text'
	},
	buttonText: {
		id: 'encryptTool.buttonText',
		defaultMessage: 'Encrypt Text'
	},
	successMessage: {
		id: 'encryptTool.successMessage',
		defaultMessage: 'Encrypted text copied to clipboard.'
	},
	errorMessage: {
		id: 'encryptTool.errorMessage',
		defaultMessage: 'Text encryption failed. Please try again momentarily.'
	},
	clearResultButtonText: {
		id: 'encryptTool.clearResultButtonText',
		defaultMessage: 'Clear'
	}
});

const notificationInitialState = {
	open: false,
	variant: 'success'
};

export const EncryptTool = (props: EncryptToolProps) => {
	const { site, embedded = false, showAppsButton, onSubmittingAndOrPendingChange } = props;
	const inputRef = useRef<HTMLInputElement>(undefined);
	const [text, setText] = useState('');
	const [result, setResult] = useState(null);
	const [fetching, setFetching] = useState(null);
	const [notificationSettings, setNotificationSettings] = useSpreadState(notificationInitialState);
	const { formatMessage } = useIntl();
	const fnRefs = useUpdateRefs({ onSubmittingAndOrPendingChange });
	const hasText = Boolean(text);
	const autoHideDuration = useSnackbarDuration();

	const focus = () => {
		const toolRawTextInput: HTMLInputElement = document.querySelector('#encryptionToolRawText');
		toolRawTextInput.focus();
	};

	const encrypt = (e: any) => {
		e.preventDefault();
		if (text) {
			setRequestForgeryToken();
			setFetching(true);
			setResult(null);
			encryptService(text, site).subscribe({
				next(encryptedText) {
					const resultingText = `\${enc:${encryptedText}}`;
					setFetching(false);
					setText('');
					setResult(resultingText);
					copyToClipboard(resultingText)
						.then(() => {
							setNotificationSettings({ open: true, variant: 'success' });
						})
						.catch(() => {
							inputRef.current.focus();
							inputRef.current.select();
						});
				},
				error() {
					setNotificationSettings({ open: true, variant: 'error' });
				}
			});
		} else {
			focus();
		}
	};

	const clear = () => {
		setText('');
		setResult(null);
		focus();
	};

	useEffect(() => {
		fnRefs.current.onSubmittingAndOrPendingChange?.({ hasPendingChanges: hasText });
	}, [hasText, fnRefs]);

	return (
		<Paper elevation={0}>
			{!embedded && (
				<GlobalAppToolbar
					title={<FormattedMessage id="encryptTool.pageTitle" defaultMessage="Encryption Tool" />}
					showAppsButton={showAppsButton}
				/>
			)}
			<Box
				sx={{
					p: '20px'
				}}
			>
				<form onSubmit={encrypt}>
					<TextField
						sx={{ mb: 2 }}
						label={formatMessage(messages.inputLabel)}
						value={text}
						onChange={(e) => setText(e.target.value)}
						onKeyUp={(e) => {
							if (e.key === 'Enter' && e.ctrlKey) {
								encrypt(e);
							}
						}}
						fullWidth
						id="encryptionToolRawText"
						name="encryptionToolRawText"
						autoFocus
						disabled={fetching}
						multiline
					/>

					{result && (
						<TextField
							fullWidth
							type="text"
							color="success"
							sx={{ mb: 2 }}
							ref={inputRef}
							label={<FormattedMessage id="words.result" defaultMessage="Result" />}
							slotProps={{
								input: { readOnly: true }
							}}
							value={result}
							onClick={(e: any) => {
								const input = e.target;
								const value = input.value;
								input.select();
								copyToClipboard(value).then(() => {
									setNotificationSettings({ open: true, variant: 'success' });
								});
							}}
						/>
					)}
					<div>
						<Button type="button" onClick={clear} disabled={fetching} variant="outlined" sx={{ mr: 1 }}>
							{formatMessage(messages.clearResultButtonText)}
						</Button>
						<Button type="submit" onClick={encrypt} disabled={fetching} color="primary" variant="contained">
							{formatMessage(messages.buttonText)}
						</Button>
					</div>
					<Snackbar
						anchorOrigin={{
							vertical: 'top',
							horizontal: 'right'
						}}
						open={notificationSettings.open}
						autoHideDuration={autoHideDuration}
						onClose={() => {
							setNotificationSettings({ open: false });
						}}
					>
						<SnackbarContent
							sx={{
								backgroundColor: notificationSettings.variant === 'success' ? green[600] : red[600],
								opacity: 0.9,
								marginRight: (theme) => theme.spacing(1)
							}}
							aria-describedby="encryptToolSnackbar"
							message={
								<Box
									component="span"
									id="encryptToolSnackbar"
									sx={{
										display: 'flex',
										alignItems: 'center'
									}}
								>
									{notificationSettings.variant === 'success' ? (
										<CheckCircleIcon
											sx={{
												fontSize: 20,
												opacity: 0.9,
												marginRight: (theme) => theme.spacing(1)
											}}
										/>
									) : (
										<ErrorIcon
											sx={{
												fontSize: 20,
												opacity: 0.9,
												marginRight: (theme) => theme.spacing(1)
											}}
										/>
									)}
									{formatMessage(
										notificationSettings.variant === 'success' ? messages.successMessage : messages.errorMessage
									)}
								</Box>
							}
							action={[
								<IconButton
									key="close"
									aria-label="close"
									color="inherit"
									onClick={() => setNotificationSettings({ open: false })}
									size="large"
								>
									<CloseIcon sx={{ fontSize: 20 }} />
								</IconButton>
							]}
						/>
					</Snackbar>
				</form>
			</Box>
		</Paper>
	);
};

export default EncryptTool;
