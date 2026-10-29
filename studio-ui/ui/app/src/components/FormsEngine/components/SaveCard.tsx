/*
 * Copyright (C) 2007-2025 Crafter Software Corporation. All Rights Reserved.
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

import { useAtom, useAtomValue } from 'jotai';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import React, { MouseEvent, useContext, useRef } from 'react';
import { StableFormContext } from '../lib/formsEngineContext';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import FormHelperText from '@mui/material/FormHelperText';
import Grow from '@mui/material/Grow';
import Alert from '@mui/material/Alert';
import { SplitButton } from '../../SplitButton';
import { useDispatch } from 'react-redux';
import { pushConfirmDialog, pushErrorDialog } from '../../../utils/system';
import { showSystemNotification } from '../../../state/actions/system';
import type { FormsEngineAtoms } from '../lib/formsEngineContext';
import { popDialog } from '../../../state/actions/dialogStack';
import { nanoid } from 'nanoid';
import type { SaveFormResult } from '../lib/useSaveForm';
import type { ApiResponse } from '../../../models/ApiResponse';

const messages = defineMessages({
	saveReadFailed: { defaultMessage: 'The form could not be checked before saving.' }
});

export interface SaveCardProps {
	isRepeatMode: boolean;
	isStackedForm: boolean;
	isEmbedded: boolean;
	setSaveAsDraft: (value: boolean) => void;
	/** Defaults to this form's atoms. A selected-fields item form passes the parent's atoms. */
	atoms?: FormsEngineAtoms;
	/**
	 * Runs the save. `revealed` opened a hidden field and wrote nothing.
	 * `invalid` is the cannot-proceed dialog. `saved` started a write.
	 */
	onSave: (e: MouseEvent, draft?: boolean) => Promise<SaveFormResult | void>;
}

export function SaveCard(props: SaveCardProps) {
	const { isEmbedded, isStackedForm, isRepeatMode, setSaveAsDraft, onSave } = props;
	const stableFormContext = useContext(StableFormContext);
	const formAtoms = props.atoms ?? stableFormContext.atoms;
	const isSubmitting = useAtomValue(formAtoms.isSubmitting);
	const [versionComment, setVersionComment] = useAtom(formAtoms.versionComment);
	const hasPendingChanges = useAtomValue(formAtoms.hasPendingChanges);
	const [closeAfterSave, setCloseAfterSave] = useAtom(formAtoms.closeAfterSave);
	const [minimizeAfterSave, setMinimizeAfterSave] = useAtom(formAtoms.minimizeAfterSave);
	const disableSave = !isEmbedded && !isRepeatMode && (isSubmitting || !versionComment);
	const showVersionComment = (!isEmbedded || !isStackedForm) && !isRepeatMode;
	const showSaveOptions = !isEmbedded && !isRepeatMode;
	const { formatMessage } = useIntl();
	const dispatch = useDispatch();
	// Click guard. It returns before setSaveAsDraft, so a second click cannot flip the draft
	// flag. save() also checks isSubmitting, which stays set through preload and the write
	// after this handler has finished waiting on the validity decision.
	const saveInFlight = useRef(false);

	const handleSetCloseAfterSave = (checked: boolean) => {
		if (checked) {
			setMinimizeAfterSave(false);
		}
		setCloseAfterSave(checked);
	};
	const handleSetMinimizeAfterSave = (checked: boolean) => {
		if (checked) {
			setCloseAfterSave(false);
		}
		setMinimizeAfterSave(checked);
	};
	const showCannotProceed = () => {
		const dialogId = nanoid();
		dispatch(
			pushConfirmDialog({
				id: dialogId,
				props: {
					title: formatMessage({ defaultMessage: 'Cannot Proceed' }),
					body: formatMessage({
						defaultMessage:
							'You cannot save until all form requirements are satisfied. If you still want to save, you can use the Save as draft option, but required fields left blank may cause errors when previewed or deployed.'
					}),
					cancelButtonText: formatMessage({ defaultMessage: 'Ok' }),
					onCancel: () => dispatch(popDialog({ id: dialogId }))
				}
			})
		);
	};
	const handleSave = async (e: MouseEvent, draft?: boolean) => {
		if (saveInFlight.current) return;
		saveInFlight.current = true;
		setSaveAsDraft(Boolean(draft));
		try {
			const status = await onSave(e, draft);
			if (status === 'invalid') showCannotProceed();
			else if (status === 'revealed') {
				dispatch(
					showSystemNotification({
						options: { variant: 'warning', autoHideDuration: 10000 },
						message: formatMessage({
							defaultMessage: 'Not saved. A field with an error was out of view.'
						})
					})
				);
			}
		} catch (error) {
			dispatch(
				pushErrorDialog({
					props: { error: saveReadError(error, formatMessage(messages.saveReadFailed)) }
				})
			);
		} finally {
			saveInFlight.current = false;
		}
	};

	return (
		<Paper sx={{ p: 1 }}>
			{/* One gap between whichever blocks are actually shown, so the button is not flush with the comment. */}
			<Stack spacing={1}>
				{showVersionComment && (
					// TODO: Should embedded components and repeats get a version comment? How would that work?
					<TextField
						size="small"
						multiline
						fullWidth
						label={<FormattedMessage defaultMessage="Version Comment" />}
						value={versionComment}
						onChange={(e) => setVersionComment(e.target.value)}
						onFocus={(e) => e.target.select()}
					/>
				)}
				{showSaveOptions && (
					<Stack spacing={0}>
						<FormControlLabel
							label={<FormattedMessage defaultMessage="Minimize after saving" />}
							control={
								<Checkbox
									size="small"
									checked={minimizeAfterSave}
									onChange={(e, checked) => handleSetMinimizeAfterSave(checked)}
								/>
							}
						/>
						<FormControlLabel
							label={<FormattedMessage defaultMessage="Close after saving" />}
							control={
								<Checkbox
									size="small"
									checked={closeAfterSave}
									onChange={(e, checked) => handleSetCloseAfterSave(checked)}
								/>
							}
						/>
					</Stack>
				)}
				<SplitButton
					fullWidth
					loading={isSubmitting}
					disabled={disableSave}
					options={[
						{
							id: 'save',
							label:
								isRepeatMode || (isEmbedded && isStackedForm)
									? formatMessage({ defaultMessage: 'Done' })
									: formatMessage({ defaultMessage: 'Save' }),
							callback: (e) => {
								handleSave(e);
							}
						},
						{
							id: 'saveDraft',
							label:
								isRepeatMode || (isEmbedded && isStackedForm)
									? formatMessage({ defaultMessage: 'Done (Draft)' })
									: formatMessage({ defaultMessage: 'Save Draft' }),
							callback: (e) => {
								handleSave(e, true);
							}
						}
					]}
				/>
				{isStackedForm && isEmbedded && (
					<FormHelperText sx={{ m: 0, textAlign: 'center' }}>
						<FormattedMessage defaultMessage="Changes are saved with the main item." />
					</FormHelperText>
				)}
				<Grow in={!hasPendingChanges} appear unmountOnExit>
					<Alert severity="info" variant="outlined" sx={{ p: 0, border: 'none', placeContent: 'center' }}>
						<FormattedMessage defaultMessage="No changes detected" />
					</Alert>
				</Grow>
			</Stack>
		</Paper>
	);
}

function saveReadError(error: unknown, fallbackMessage: string): ApiResponse {
	if (error instanceof Error) return { message: error.message };
	if (error && typeof error === 'object') return error as ApiResponse;
	return { message: fallbackMessage };
}

export default SaveCard;
