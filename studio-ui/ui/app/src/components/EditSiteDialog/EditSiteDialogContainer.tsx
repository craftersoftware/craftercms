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

import React, { MouseEvent, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import GlobalState from '../../models/GlobalState';
import { LookupTable } from '../../models/LookupTable';
import { isBlank } from '../../utils/string';
import { update } from '../../services/sites';
import { fetchSites } from '../../state/actions/sites';
import { EditSiteDialogContainerProps } from './utils';
import { batchActions, dispatchDOMEvent } from '../../state/actions/misc';
import { ConditionalLoadingState } from '../LoadingState/LoadingState';
import useProjectPreviewImage from '../../hooks/useProjectPreviewImage';
import useUpdateRefs from '../../hooks/useUpdateRefs';
import { FormattedMessage, useIntl } from 'react-intl';
import DialogBody from '../DialogBody';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import Switch from '@mui/material/Switch';
import Card from '@mui/material/Card';
import CardMedia from '@mui/material/CardMedia';
import CardActions from '@mui/material/CardActions';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DialogFooter from '../DialogFooter';
import SecondaryButton from '../SecondaryButton';
import PrimaryButton from '../PrimaryButton';
import { PROJECT_PREVIEW_IMAGE_UPDATED } from '../../utils/constants';
import { showSystemNotification } from '../../state/actions/system';
import { popDialog, pushDialog } from '../../state/actions/dialogStack';
import { nanoid } from 'nanoid';
import { createComponentId, pushErrorDialog } from '../../utils/system';
import { useEnhancedDialogContext } from '../EnhancedDialog';

export function EditSiteDialogContainer(props: EditSiteDialogContainerProps) {
	const { site, onClose, onSaveSuccess, onSiteImageChange, isSubmitting } = props;
	const [hasNameConflict, setHasNameConflict] = useState(false);
	const sites = useSelector<GlobalState, LookupTable>((state) => state.sites.byId);
	const dispatch = useDispatch();
	const originalName = site.name;
	const [name, setName] = useState(originalName);
	const originalDescription = site.description ?? '';
	const [description, setDescription] = useState(originalDescription);
	const [imageUrl, fetch] = useProjectPreviewImage(
		site.id,
		'/studio/static-assets/themes/cstudioTheme/images/default-contentType.jpg'
	);
	const disableSubmit =
		hasNameConflict || (originalName === name.trim() && originalDescription === description.trim()) || isBlank(name);
	const { formatMessage } = useIntl();
	const { updateSubmittingOrHasPendingChanges } = useEnhancedDialogContext();

	function checkSiteName(value: string) {
		if (
			(originalName !== value && sites && Object.keys(sites).filter((key) => sites[key].name === value).length) ||
			value.trim() === ''
		) {
			setHasNameConflict(true);
		} else {
			setHasNameConflict(false);
		}
	}

	const handleSubmit = (id: string, name: string, description: string) => {
		if (!disableSubmit) {
			updateSubmittingOrHasPendingChanges({ isSubmitting: true });
			update({ id, name: name.trim(), description: description.trim() }).subscribe({
				next(response) {
					updateSubmittingOrHasPendingChanges({ hasPendingChanges: false, isSubmitting: false });
					dispatch(fetchSites());
					onSaveSuccess?.(response);
				},
				error({ response: { response } }) {
					updateSubmittingOrHasPendingChanges({ isSubmitting: false });
					dispatch(pushErrorDialog({ props: { error: response } }));
				}
			});
		}
	};

	const onCloseButtonClick = (e: MouseEvent<HTMLButtonElement>) => onClose(e, null);

	const onSiteNameChange = (value: string) => {
		checkSiteName(value);
		setName(value);
		updateSubmittingOrHasPendingChanges({
			hasPendingChanges: originalDescription !== description.trim() || originalName !== value.trim()
		});
	};

	const onKeyPress = (event: React.KeyboardEvent) => {
		if (event.key === 'Enter') {
			handleSubmit(site.id, name, description);
		}
	};

	const onSiteDescriptionChange = (value: string) => {
		setDescription(value);
		updateSubmittingOrHasPendingChanges({
			hasPendingChanges: originalName !== name.trim() || originalDescription !== value.trim()
		});
	};

	const onEditSiteImage = () => {
		const singleFileUploadDialogDialogId = nanoid();
		dispatch(
			pushDialog({
				id: singleFileUploadDialogDialogId,
				component: createComponentId('SingleFileUploadDialog'),
				props: {
					path: '/.crafter/screenshots',
					site: site.id,
					customFileName: 'default.png',
					fileTypes: ['image/png'],
					onClose: () => dispatch(popDialog({ id: singleFileUploadDialogDialogId })),
					onUploadComplete: () =>
						dispatch(
							batchActions([
								popDialog({ id: singleFileUploadDialogDialogId }),
								dispatchDOMEvent({ id: PROJECT_PREVIEW_IMAGE_UPDATED })
							])
						)
				}
			})
		);
	};

	const handleEditSiteImageCompleteRef = useUpdateRefs(() => {
		dispatch(
			showSystemNotification({ message: formatMessage({ defaultMessage: 'Preview image updated successfully.' }) })
		);
		onSiteImageChange?.();
		fetch();
	});

	const onSubmit = () => handleSubmit(site.id, name, description);

	useEffect(() => {
		const callback = () => {
			handleEditSiteImageCompleteRef.current();
		};
		document.addEventListener(PROJECT_PREVIEW_IMAGE_UPDATED, callback);
		return () => {
			document.removeEventListener(PROJECT_PREVIEW_IMAGE_UPDATED, callback);
		};
	}, [handleEditSiteImageCompleteRef]);

	return (
		<ConditionalLoadingState isLoading={!site}>
			<>
				<DialogBody>
					<Grid container spacing={2}>
						<Grid size={{ sm: 6 }}>
							<Card elevation={2}>
								<CardMedia component="img" image={imageUrl} title={name} sx={{ height: '234px' }} />
								<CardActions sx={{ placeContent: 'center' }} disableSpacing>
									<Tooltip title={<FormattedMessage id="words.edit" defaultMessage="Edit" />}>
										<IconButton
											onClick={onEditSiteImage}
											aria-label={formatMessage({ id: 'words.edit', defaultMessage: 'Edit' })}
										>
											<EditRoundedIcon />
										</IconButton>
									</Tooltip>
								</CardActions>
							</Card>
						</Grid>
						<Grid size={{ sm: 6 }}>
							<Grid container spacing={1} component="form">
								<Grid size={12}>
									<TextField
										autoFocus
										fullWidth
										id="name"
										name="name"
										label={<FormattedMessage id="editSiteDialog.siteName" defaultMessage="Project Name" />}
										onChange={(event) => onSiteNameChange(event.target.value)}
										onKeyDown={onKeyPress}
										value={name}
										slotProps={{
											htmlInput: { maxLength: 255 }
										}}
										error={hasNameConflict}
										helperText={
											!name.trim()
												? formatMessage({
														id: 'editSiteDialog.siteNameRequired',
														defaultMessage: 'Project Name is required.'
													})
												: hasNameConflict
													? formatMessage({
															id: 'editSiteDialog.sitenameExists',
															defaultMessage: 'The name already exist.'
														})
													: ''
										}
									/>
								</Grid>
								<Grid size={12}>
									<TextField
										id="siteId"
										name="id"
										label={<FormattedMessage id="editSiteDialog.siteId" defaultMessage="Project ID" />}
										fullWidth
										value={site.id}
										disabled
										helperText={
											<FormattedMessage
												id="editSiteDialog.notEditable"
												defaultMessage="The project id is not editable"
											/>
										}
									/>
								</Grid>
								<Grid size={12}>
									<TextField
										id="description"
										name="description"
										label={
											<FormattedMessage id="editSiteDialog.siteDescription" defaultMessage="Project Description" />
										}
										fullWidth
										multiline
										onChange={(event) => onSiteDescriptionChange(event.target.value)}
										onKeyPress={(e) => {
											// This behaviour is kind of backwards from how it's usually seen in text editors.
											// Perhaps we should flip it to shift/ctrl + enter creating new lines and only enter submitting?
											if (e.key !== 'Enter' || e.ctrlKey || e.shiftKey) {
												onKeyPress?.(e);
											}
										}}
										value={description ?? ''}
										slotProps={{
											htmlInput: { maxLength: 4000 }
										}}
									/>
								</Grid>
								{site.stagingEnabled && (
									<Grid size={12} sx={{ mt: 1 }}>
										<FormControlLabel
											control={<Switch name="staging" checked disabled color="primary" />}
											label={<FormattedMessage defaultMessage="Staging enabled" />}
										/>
										<FormHelperText>
											<FormattedMessage defaultMessage="Staging cannot be turned off. Removing it means recreating the project." />
										</FormHelperText>
									</Grid>
								)}
							</Grid>
						</Grid>
					</Grid>
				</DialogBody>
				<DialogFooter>
					{onCloseButtonClick && (
						<SecondaryButton onClick={onCloseButtonClick} variant="contained" disabled={isSubmitting}>
							<FormattedMessage id="editSiteDialog.cancel" defaultMessage="Cancel" />
						</SecondaryButton>
					)}
					{onSubmit && (
						<PrimaryButton
							onClick={() => onSubmit()}
							variant="contained"
							color="primary"
							loading={isSubmitting}
							disabled={disableSubmit}
						>
							<FormattedMessage id="words.submit" defaultMessage="Submit" />
						</PrimaryButton>
					)}
				</DialogFooter>
			</>
		</ConditionalLoadingState>
	);
}
