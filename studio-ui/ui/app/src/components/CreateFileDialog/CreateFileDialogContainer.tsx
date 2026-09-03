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

import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useActiveSiteId } from '../../hooks/useActiveSiteId';
import { FormattedMessage, useIntl } from 'react-intl';
import { checkPathExistence, createFile } from '../../services/content';
import { validateActionPolicy } from '../../services/sites';
import DialogBody from '../DialogBody/DialogBody';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import DialogFooter from '../DialogFooter/DialogFooter';
import SecondaryButton from '../SecondaryButton';
import PrimaryButton from '../PrimaryButton';
import ConfirmDialog from '../ConfirmDialog';
import { CreateFileContainerProps, DEFAULT_TEMPLATE_EXTENSION, TEMPLATE_EXTENSIONS, TemplateExtension } from './utils';
import { translations } from './translations';
import useEnhancedDialogContext from '../EnhancedDialog/useEnhancedDialogContext';
import useItemsByPath from '../../hooks/useItemsByPath';
import { UNDEFINED } from '../../utils/constants';
import { isBlank } from '../../utils/string';
import { applyAssetNameRules } from '../../utils/content';
import { getFileNameWithExtensionForItemType, pickExtensionForItemType } from '../../utils/path';
import { pushErrorDialog } from '../../utils/system';
import { extractErrorPayload } from '../../utils/ajax';
import { AjaxError } from 'rxjs/ajax';

export function CreateFileDialogContainer(props: CreateFileContainerProps) {
	const { onClose, onCreated, type, path, allowBraces } = props;
	const { isSubmitting, hasPendingChanges } = useEnhancedDialogContext();
	const [name, setName] = useState('');
	const [extension, setExtension] = useState<TemplateExtension>(DEFAULT_TEMPLATE_EXTENSION);
	const [confirm, setConfirm] = useState(null);
	const dispatch = useDispatch();
	const site = useActiveSiteId();
	const { formatMessage } = useIntl();
	const itemLookup = useItemsByPath();
	const getFileName = (fileName: string) =>
		getFileNameWithExtensionForItemType(type, fileName, type === 'template' ? extension : undefined);
	const computedFilePath = `${path}/${getFileName(name)}`;
	// When calling the validation API, we need to check if the item with the suggested name exists. This is an extra validation for the
	// fileExists const.
	const [itemExists, setItemExists] = useState(false);
	const fileExists = itemExists || itemLookup[computedFilePath] !== UNDEFINED;
	const isValid = !isBlank(name) && !fileExists;
	const { updateSubmittingOrHasPendingChanges } = useEnhancedDialogContext();

	const onError = (error: AjaxError) => {
		updateSubmittingOrHasPendingChanges({ isSubmitting: false });
		dispatch(pushErrorDialog({ props: { error: extractErrorPayload(error) } }));
	};

	const onCreateFile = (site: string, path: string, fileName: string) => {
		createFile(site, path, fileName).subscribe({
			next() {
				updateSubmittingOrHasPendingChanges({ hasPendingChanges: false, isSubmitting: false });
				onCreated?.({
					path,
					fileName,
					mode: pickExtensionForItemType(type, fileName, type === 'template' ? 'ftl' : undefined),
					openOnSuccess: true
				});
			},
			error: onError
		});
	};

	const onSubmit = () => {
		updateSubmittingOrHasPendingChanges({ isSubmitting: true });
		if (name) {
			const fileName = getFileName(name);
			validateActionPolicy(site, {
				type: 'CREATE',
				target: `${path}/${fileName}`
			}).subscribe({
				next: ({ allowed, modifiedValue, message }) => {
					if (allowed) {
						const pathToCheckExists = modifiedValue ?? `${path}/${fileName}`;
						setItemExists(false);
						checkPathExistence(site, pathToCheckExists).subscribe({
							next: (exists) => {
								if (exists) {
									setItemExists(true);
									updateSubmittingOrHasPendingChanges({ isSubmitting: false });
								} else {
									if (modifiedValue) {
										setConfirm({ body: message });
									} else {
										onCreateFile(site, path, fileName);
									}
								}
							},
							error: onError
						});
					} else {
						setConfirm({
							error: true,
							body: formatMessage(translations.policyError, { fileName, detail: message })
						});
						updateSubmittingOrHasPendingChanges({ isSubmitting: false });
					}
				},
				error: onError
			});
		}
	};

	const onConfirm = () => {
		onCreateFile(site, path, getFileName(name));
	};

	const onConfirmCancel = () => {
		setConfirm(null);
		updateSubmittingOrHasPendingChanges({ isSubmitting: false });
	};

	const onInputChanges = (value: string) => {
		setName(value);
		setItemExists(false);
		const newHasPending = !isBlank(value);
		hasPendingChanges !== newHasPending && updateSubmittingOrHasPendingChanges({ hasPendingChanges: newHasPending });
	};

	const onExtensionChange = (event: SelectChangeEvent<TemplateExtension>) => {
		setExtension(event.target.value);
		setItemExists(false);
	};

	const fileNameField = (
		<TextField
			label={<FormattedMessage id="createFileDialog.fileName" defaultMessage="File Name" />}
			value={name}
			fullWidth={type !== 'template'}
			autoFocus
			required
			error={(!name && Boolean(isSubmitting)) || fileExists}
			placeholder={formatMessage(translations.placeholder)}
			helperText={
				fileExists ? (
					<FormattedMessage
						id="createFileDialog.fileAlreadyExists"
						defaultMessage="A file with that name already exists"
					/>
				) : !name && isSubmitting ? (
					<FormattedMessage id="createFileDialog.fileNameRequired" defaultMessage="File name is required." />
				) : (
					<FormattedMessage
						id="createFileDialog.helperText"
						defaultMessage="Consisting of letters, numbers, dot (.), dash (-) and underscore (_)."
					/>
				)
			}
			disabled={isSubmitting}
			margin={type === 'template' ? 'none' : 'normal'}
			sx={type === 'template' ? { flex: 1 } : undefined}
			slotProps={{
				inputLabel: { shrink: true }
			}}
			onChange={(event) => onInputChanges(applyAssetNameRules(event.target.value, { allowBraces }))}
		/>
	);

	const extensionField = (
		<FormControl variant="outlined" sx={{ minWidth: 110, flexShrink: 0 }} disabled={isSubmitting}>
			<Select id="createFileDialogExtension" value={extension} onChange={onExtensionChange}>
				{TEMPLATE_EXTENSIONS.map((templateExtension) => (
					<MenuItem key={templateExtension} value={templateExtension}>
						{`.${templateExtension}`}
					</MenuItem>
				))}
			</Select>
		</FormControl>
	);

	return (
		<>
			<DialogBody>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						if (isValid) {
							onSubmit();
						}
					}}
				>
					{type === 'template' ? (
						<Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 2, mb: 1 }}>
							{fileNameField}
							{extensionField}
						</Box>
					) : (
						fileNameField
					)}
				</form>
			</DialogBody>
			<DialogFooter>
				<SecondaryButton onClick={(e) => onClose(e, null)} disabled={isSubmitting}>
					<FormattedMessage id="words.close" defaultMessage="Close" />
				</SecondaryButton>
				<PrimaryButton onClick={onSubmit} disabled={isSubmitting || !isValid} loading={isSubmitting}>
					<FormattedMessage id="words.create" defaultMessage="Create" />
				</PrimaryButton>
			</DialogFooter>
			<ConfirmDialog
				open={Boolean(confirm)}
				body={confirm?.body}
				onOk={confirm?.error ? onConfirmCancel : onConfirm}
				onCancel={confirm?.error ? null : onConfirmCancel}
			/>
		</>
	);
}

export default CreateFileDialogContainer;
