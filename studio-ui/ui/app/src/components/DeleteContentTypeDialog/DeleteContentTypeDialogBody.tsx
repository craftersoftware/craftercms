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

import * as React from 'react';
import { useEffect, useState } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { FetchContentTypeUsageResponse } from '../../services/contentTypes';
import DialogBody from '../DialogBody/DialogBody';
import EmptyState from '../EmptyState/EmptyState';
import Alert from '@mui/material/Alert';
import { TextField } from '@mui/material';
import DialogFooter from '../DialogFooter/DialogFooter';
import SecondaryButton from '../SecondaryButton/SecondaryButton';
import PrimaryButton from '../PrimaryButton/PrimaryButton';
import LoadingState from '../LoadingState/LoadingState';
import ContentTypeUsageReport from './ContentTypeUsageReport';
import { ContentItem } from '../../models/Item';
import { DeleteContentTypeDialogBodyProps } from './utils';
import Box from '@mui/material/Box';

const messages = defineMessages({
	content: {
		id: 'words.content',
		defaultMessage: 'Content'
	},
	templates: {
		id: 'words.templates',
		defaultMessage: 'Templates'
	},
	scripts: {
		id: 'words.scripts',
		defaultMessage: 'Scripts'
	}
});

export function DeleteContentTypeDialogBody(props: DeleteContentTypeDialogBodyProps) {
	const { onCloseButtonClick, data, contentType, onSubmit: onSubmitProp, password = 'delete', submitting } = props;
	const { formatMessage } = useIntl();
	const dataEntries = Object.entries(data) as Array<[keyof FetchContentTypeUsageResponse, ContentItem[]]>;
	const entriesWithItems = dataEntries.filter(([, items]) => items.length > 0);
	const noUsages = entriesWithItems.length === 0;
	const hasUsages = !noUsages;
	const [confirmPasswordPassed, setConfirmPasswordPassed] = useState(false);
	const [passwordFieldValue, setPasswordFieldValue] = useState('');
	useEffect(() => {
		setConfirmPasswordPassed(passwordFieldValue.toLowerCase() === password.toLowerCase());
	}, [password, passwordFieldValue]);
	const onSubmit = (e) => {
		e.preventDefault();
		if (confirmPasswordPassed || noUsages) {
			onSubmitProp?.();
		}
	};
	return (
		<>
			<DialogBody>
				{noUsages ? (
					<Box sx={{ background: (theme) => theme.palette.background.paper }}>
						<EmptyState
							title={<FormattedMessage id="deleteContentTypeDialog.noUsagesFound" defaultMessage="No usages found" />}
							subtitle={
								<FormattedMessage
									id="deleteContentTypeDialog.safeToDelete"
									defaultMessage="The content type can be safely deleted."
								/>
							}
						/>
					</Box>
				) : (
					<>
						<Alert variant="outlined" severity="warning" sx={{ marginBottom: '1em' }} icon={false}>
							<FormattedMessage defaultMessage="Please review and confirm all content type references that will be deleted." />
						</Alert>
						<ContentTypeUsageReport
							entries={entriesWithItems}
							messages={{
								content: formatMessage(messages.content),
								templates: formatMessage(messages.templates),
								scripts: formatMessage(messages.scripts)
							}}
						/>
						<Alert severity="warning" sx={{ marginBottom: '.5em' }}>
							<FormattedMessage
								defaultMessage={`Type the word "<b>{password}</b>" to confirm the deletion of "{name}" and all its references.`}
								values={{
									password,
									name: contentType.name,
									b: (message) => {
										return (
											<Box key="" component="strong" sx={{ fontWeight: 600 }}>
												{message}
											</Box>
										);
									}
								}}
							/>
							<TextField
								fullWidth
								disabled={submitting}
								sx={{
									marginTop: '1em',
									'& legend': {
										width: 0
									}
								}}
								value={passwordFieldValue}
								onChange={(e) => setPasswordFieldValue(e.target.value)}
								onKeyPress={(e) => e.key === 'Enter' && onSubmit(e)}
							/>
						</Alert>
					</>
				)}
			</DialogBody>
			<DialogFooter>
				<SecondaryButton onClick={onCloseButtonClick} autoFocus disabled={submitting}>
					<FormattedMessage id="words.cancel" defaultMessage="Cancel" />
				</SecondaryButton>
				<PrimaryButton disabled={(hasUsages && !confirmPasswordPassed) || submitting} onClick={onSubmit}>
					<FormattedMessage id="deleteContentTypeDialog.submitButton" defaultMessage="Delete" />
				</PrimaryButton>
			</DialogFooter>
			{submitting && (
				<Box
					sx={{
						position: 'absolute',
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						display: 'flex',
						background: 'rgba(255,255,255,0.7)'
					}}
				>
					<LoadingState />
				</Box>
			)}
		</>
	);
}

export default DeleteContentTypeDialogBody;
