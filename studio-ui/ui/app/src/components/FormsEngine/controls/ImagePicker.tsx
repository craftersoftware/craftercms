/*
 * Copyright (C) 2007-2024 Crafter Software Corporation. All Rights Reserved.
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
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import CardMedia from '@mui/material/CardMedia';
import IconButton from '@mui/material/IconButton';
import { DeleteOutlined, DownloadOutlined, EditOutlined } from '@mui/icons-material';
import { FormsEngineField } from '../components/FormsEngineField';
import useEnv from '../../../hooks/useEnv';
import { ControlProps } from '../types';
import { FormattedMessage, useIntl } from 'react-intl';
import { menuItemClasses } from '@mui/material/MenuItem';
import { listItemIconClasses } from '@mui/material/ListItemIcon';
import Menu from '@mui/material/Menu';
import { useImageInfo } from '../../../hooks/useImageInfo';
import { svgIconClasses } from '@mui/material/SvgIcon';
import { isExternalMediaUrl, resolveMediaUrl } from '../../../utils/string';
import { useDispatch } from 'react-redux';
import Tooltip from '@mui/material/Tooltip';
import Alert from '@mui/material/Alert';
import {
	downloadMedia,
	getImageRestrictionMessages,
	ImageRestrictionSubtitle,
	showImageCropDialog
} from '../lib/controlHelpers';
import type { ImageRestrictions } from '../../ImageEditorDialog/types';
import Skeleton from '@mui/material/Skeleton';
import { nnou, nou } from '../../../utils/object';
import { validateImageRestrictions } from '../../../utils/content';
import GroupedDataSourceActionMenuItems from '../components/GroupedDataSourceActionMenuItems';
import type { DataSourceAssetSelection, DataSourceSelection } from '../dataSources/types';
import { showSystemNotification } from '../../../state/actions/system';
import { EmptyState } from '../../EmptyState';

export interface ImagePickerProps extends ControlProps {
	value: string | null;
}

export function ImagePicker(props: ImagePickerProps) {
	const { field, value: valueProp, setValue, autoFocus, readonly: formReadonly, dataSources } = props;
	const { guestBase } = useEnv();
	const { formatMessage } = useIntl();
	const dispatch = useDispatch();

	// region field properties/validations
	const readonly = formReadonly || (field.properties?.readonly?.value as boolean);
	const defaultValue = field.defaultValue as string;
	const restrictions: ImageRestrictions = {
		height: field.validations?.height?.value,
		width: field.validations?.width?.value,
		maxHeight: field.validations?.maxHeight?.value,
		maxWidth: field.validations?.maxWidth?.value,
		minHeight: field.validations?.minHeight?.value,
		minWidth: field.validations?.minWidth?.value
	};
	// endregion

	const value = nnou(valueProp) ? valueProp : (defaultValue ?? '');
	const mediaUrl = value ? resolveMediaUrl(guestBase, value) : '';
	const { imageInfo, isFetchingDimensions, isFetchingMetadata, errorDimensions, errorMetadata } =
		useImageInfo(mediaUrl);
	const hasValue = Boolean(value);
	const actions = dataSources?.actions ?? [];
	const dataSourcesLoading = dataSources?.status === 'loading';
	const dataSourcesError = dataSources?.status === 'error';
	const actionsReady = Boolean(dataSources?.context) && actions.length > 0 && !dataSourcesLoading;
	const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
	const [addMenuOpen, setAddMenuOpen] = useState(false);
	const [rejectedExternalUrl, setRejectedExternalUrl] = useState<string | null>(null);
	const selectionRequestRef = useRef(0);

	useEffect(() => {
		// If there's a default value and no value has been set yet, set it as the value.
		if (nou(valueProp) && defaultValue != null) {
			setValue(defaultValue);
		}
	}, [defaultValue, setValue, valueProp]);

	const imageRestrictionMessages = getImageRestrictionMessages(restrictions);
	const applySelection = (selection: DataSourceSelection | DataSourceSelection[] | null) => {
		const requestId = ++selectionRequestRef.current;
		const selected = Array.isArray(selection) ? selection[0] : selection;
		const path =
			selected?.kind === 'asset' && typeof selected.relativeUrl === 'string'
				? selected.relativeUrl
				: selected?.kind === 'item' && typeof selected.path === 'string'
					? selected.path
					: undefined;
		if (!path) return;
		setRejectedExternalUrl(null);
		validateImageRestrictions(path, restrictions, (selected as DataSourceAssetSelection).mimeType)
			.then((meetsRestrictions) => {
				if (requestId !== selectionRequestRef.current) return;
				if (meetsRestrictions) {
					setValue(path);
				} else if (isExternalMediaUrl(path)) {
					// Cropping requires writing the result to a site path, which isn't possible for an external URL. The
					// crop would be discarded and the field would keep the offending URL, so reject the selection instead.
					setRejectedExternalUrl(path);
				} else {
					showImageCropDialog({
						dispatch,
						path,
						mimeType:
							selected.kind === 'asset' && typeof selected.mimeType === 'string' ? selected.mimeType : undefined,
						restrictions,
						writeContent: true,
						onCrop: (_blob: Blob, newPath: string) => setValue(newPath ?? path)
					});
				}
			})
			.catch(() => {
				if (requestId !== selectionRequestRef.current) return;
				dispatch(
					showSystemNotification({
						message: formatMessage({ defaultMessage: 'Unable to validate image restrictions.' })
					})
				);
			});
	};
	const actionMenuItems = actionsReady ? (
		<GroupedDataSourceActionMenuItems
			actions={actions}
			context={dataSources.context}
			disabled={readonly}
			onResult={applySelection}
			onError={console.error}
			onMenuClose={() => setAddMenuOpen(false)}
		/>
	) : null;

	const handleRemoveImage = () => {
		selectionRequestRef.current += 1;
		setRejectedExternalUrl(null);
		setValue(null);
	};

	return (
		<>
			<Menu
				anchorEl={anchorEl}
				open={addMenuOpen}
				onClose={() => setAddMenuOpen(false)}
				sx={{
					[`.${menuItemClasses.root}`]: { pl: 3 }
				}}
			>
				{actionMenuItems}
			</Menu>
			<FormsEngineField field={field} isValid={rejectedExternalUrl ? false : undefined}>
				{rejectedExternalUrl && (
					<Alert
						severity="error"
						variant="outlined"
						sx={{ border: 'none' }}
						onClose={() => setRejectedExternalUrl(null)}
					>
						<FormattedMessage
							defaultMessage="The image at {url} was not applied."
							values={{ url: rejectedExternalUrl }}
						/>{' '}
						<ImageRestrictionSubtitle restrictions={restrictions} />{' '}
						<FormattedMessage defaultMessage="External images can't be cropped. Select an image that meets the requirements." />
					</Alert>
				)}
				{hasValue ? (
					<Card sx={{ display: 'flex' }}>
						<CardMedia component="img" sx={{ width: '40%' }} image={mediaUrl} alt="" />
						<Box sx={{ display: 'flex', flexDirection: 'column' }}>
							<CardContent sx={{ flex: '1 0 auto' }}>
								<Typography component="div" variant="body1" marginBottom={1}>
									{value}
								</Typography>
								<Typography variant="body2" component="div" color="textSecondary" marginBottom={1}>
									{isFetchingMetadata ? (
										<>
											<Skeleton variant="text" />
											<Skeleton variant="text" />
										</>
									) : errorMetadata ? (
										<Typography color="error" variant="body2">
											<FormattedMessage defaultMessage="Error loading image metadata" />
										</Typography>
									) : (
										<>
											{imageInfo?.contentType}
											<br />
											{imageInfo?.size ? `${imageInfo.size} Kb` : ''}
											<br />
										</>
									)}
									{isFetchingDimensions ? (
										<Skeleton variant="text" />
									) : errorDimensions ? (
										<Typography color="error" variant="body2">
											<FormattedMessage defaultMessage="Error loading image dimensions" />
										</Typography>
									) : (
										`${imageInfo?.width} x ${imageInfo?.height}`
									)}
								</Typography>
								{Object.values(restrictions).some((restriction) => restriction) && (
									<>
										<Typography variant="caption" fontWeight="bold">
											<FormattedMessage defaultMessage="Image Requirements:" />
										</Typography>
										<Typography variant="caption" component="div" color="textSecondary" marginBottom={1}>
											<FormattedMessage defaultMessage="Width: " />
											{imageRestrictionMessages.width}
											<br />
											<FormattedMessage defaultMessage="Height:" />
											{imageRestrictionMessages.height}
										</Typography>
									</>
								)}
								<Box>
									<Tooltip title={<FormattedMessage defaultMessage="Replace" />}>
										<IconButton
											size="small"
											disabled={readonly || !actionsReady}
											autoFocus={autoFocus}
											onClick={(event) => {
												if (actionsReady) {
													setAnchorEl(event.currentTarget);
													setAddMenuOpen(true);
												}
											}}
										>
											<EditOutlined />
										</IconButton>
									</Tooltip>
									<Tooltip title={<FormattedMessage defaultMessage="Download" />}>
										<IconButton
											size="small"
											onClick={() => {
												if (value) downloadMedia(guestBase, value);
											}}
										>
											<DownloadOutlined />
										</IconButton>
									</Tooltip>
									<Tooltip title={<FormattedMessage defaultMessage="Delete" />}>
										<IconButton size="small" onClick={handleRemoveImage} disabled={readonly}>
											<DeleteOutlined />
										</IconButton>
									</Tooltip>
								</Box>
							</CardContent>
						</Box>
					</Card>
				) : dataSourcesLoading ? (
					<Skeleton variant="rounded" height={56} />
				) : dataSourcesError ? (
					<Typography color="error" variant="body2">
						<FormattedMessage defaultMessage="Error loading image sources" />
					</Typography>
				) : !actionsReady ? (
					<EmptyState
						title={<FormattedMessage defaultMessage="No options are available for this control" />}
						subtitle={
							<FormattedMessage defaultMessage="Update the content type definition to add options to this control" />
						}
					/>
				) : (
					<Box
						sx={{
							p: 1,
							gap: 1,
							py: 0.5,
							display: 'flex',
							flexDirection: 'row',
							flexWrap: 'wrap',
							color: 'primary.main',
							justifyContent: 'center',
							[`.${svgIconClasses.root}`]: {
								color: 'primary.main'
							},
							[`.${menuItemClasses.root}`]: {
								flexDirection: 'column',
								justifyContent: 'center',
								borderRadius: 1
							},
							[`.${listItemIconClasses.root}`]: {
								justifyContent: 'center'
							}
						}}
					>
						{actionMenuItems}
					</Box>
				)}
			</FormsEngineField>
		</>
	);
}

export default ImagePicker;
