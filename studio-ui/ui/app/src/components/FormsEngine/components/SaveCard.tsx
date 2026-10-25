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
import { FormattedMessage, useIntl } from 'react-intl';
import React, { MouseEvent, useContext, useId } from 'react';
import { StableFormContext } from '../lib/formsEngineContext';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import FormHelperText from '@mui/material/FormHelperText';
import Grow from '@mui/material/Grow';
import Alert from '@mui/material/Alert';
import { SplitButton } from '../../SplitButton';

export interface SaveCardProps {
	isRepeatMode: boolean;
	isStackedForm: boolean;
	isEmbedded: boolean;
	setSaveAsDraft: (value: boolean) => void;
	invalidForm: boolean;
	onSave: (e: MouseEvent, draft?: boolean) => void;
	/** Called when Save is pressed and the form is invalid. Focus and announce the first error. */
	onInvalidSave: () => void;
}

export function SaveCard(props: SaveCardProps) {
	const { isEmbedded, isStackedForm, isRepeatMode, setSaveAsDraft, invalidForm, onSave, onInvalidSave } = props;
	const stableFormContext = useContext(StableFormContext);
	const isSubmitting = useAtomValue(stableFormContext.atoms.isSubmitting);
	const [versionComment, setVersionComment] = useAtom(stableFormContext.atoms.versionComment);
	const hasPendingChanges = useAtomValue(stableFormContext.atoms.hasPendingChanges);
	const [closeAfterSave, setCloseAfterSave] = useAtom(stableFormContext.atoms.closeAfterSave);
	const [minimizeAfterSave, setMinimizeAfterSave] = useAtom(stableFormContext.atoms.minimizeAfterSave);
	const versionCommentRequired = !isEmbedded && !isRepeatMode;
	const versionCommentMissing = versionCommentRequired && !versionComment.trim();
	const disableSave = versionCommentRequired && (isSubmitting || versionCommentMissing);
	const versionCommentFieldId = useId();
	const invalidFormHelpId = useId();
	const { formatMessage } = useIntl();
	const describedBy =
		[versionCommentMissing ? `${versionCommentFieldId}-helper-text` : '', invalidForm ? invalidFormHelpId : '']
			.filter(Boolean)
			.join(' ') || undefined;

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
	const handleSave = (e: MouseEvent, type: 'save' | 'saveDraft', draft?: boolean) => {
		if (type === 'save' && invalidForm) {
			onInvalidSave();
			return;
		}
		onSave(e, draft);
	};

	return (
		<Paper sx={{ p: 1 }}>
			{(!isEmbedded || !isStackedForm) && !isRepeatMode && (
				// TODO: Should embedded components and repeats get a version comment? How would that work?
				<TextField
					id={versionCommentFieldId}
					size="small"
					multiline
					fullWidth
					required={versionCommentRequired}
					label={<FormattedMessage defaultMessage="Version Comment" />}
					value={versionComment}
					onChange={(e) => setVersionComment(e.target.value)}
					onFocus={(e) => e.target.select()}
					helperText={
						versionCommentMissing ? formatMessage({ defaultMessage: 'Enter a version comment to save.' }) : undefined
					}
				/>
			)}
			{!isEmbedded && !isRepeatMode && (
				<>
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
				</>
			)}
			<SplitButton
				fullWidth
				loading={isSubmitting}
				disabled={disableSave}
				describedBy={describedBy}
				options={[
					{
						id: 'save',
						label:
							isRepeatMode || (isEmbedded && isStackedForm)
								? formatMessage({ defaultMessage: 'Done' })
								: formatMessage({ defaultMessage: 'Save' }),
						callback: (e) => {
							setSaveAsDraft(false);
							handleSave(e, 'save');
						}
					},
					{
						id: 'saveDraft',
						label:
							isRepeatMode || (isEmbedded && isStackedForm)
								? formatMessage({ defaultMessage: 'Done (Draft)' })
								: formatMessage({ defaultMessage: 'Save Draft' }),
						callback: (e) => {
							setSaveAsDraft(true);
							handleSave(e, 'saveDraft', true);
						}
					}
				]}
			/>
			{invalidForm && (
				<FormHelperText id={invalidFormHelpId}>
					{formatMessage({
						defaultMessage:
							'You cannot save until all form requirements are satisfied. If you still want to save, you can use the Save as draft option, but required fields left blank may cause errors when previewed or deployed.'
					})}
				</FormHelperText>
			)}
			{isStackedForm && isEmbedded && (
				<FormHelperText sx={{ textAlign: 'center' }}>
					<FormattedMessage defaultMessage="Changes are saved with the main item." />
				</FormHelperText>
			)}
			<Grow in={!hasPendingChanges} appear unmountOnExit>
				<Alert severity="info" variant="outlined" sx={{ p: 0, border: 'none', placeContent: 'center' }}>
					<FormattedMessage defaultMessage="No changes detected" />
				</Alert>
			</Grow>
		</Paper>
	);
}

export default SaveCard;
