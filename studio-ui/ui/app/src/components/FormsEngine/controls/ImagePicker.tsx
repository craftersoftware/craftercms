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

import React, { MouseEvent as ReactMouseEvent, useEffect, useRef, useState } from 'react';
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
import { FormattedMessage } from 'react-intl';
import { useConsolidatedImagePickerData } from '../dataSourceHooks/useConsolidatedImagePickerData';
import { menuItemClasses } from '@mui/material/MenuItem';
import { listItemIconClasses } from '@mui/material/ListItemIcon';
import Menu from '@mui/material/Menu';
import { useImageInfo } from '../../../hooks/useImageInfo';
import { svgIconClasses } from '@mui/material/SvgIcon';
import Dialog from '@mui/material/Dialog';
import { DialogHeader } from '../../DialogHeader';
import { DialogBody } from '../../DialogBody';
import type { AllowedPathsData } from './NodeSelector';
import { processPathMacros } from '../../../utils/path';
import type { MediaItem } from '../../../models';
import { ensureSingleSlash } from '../../../utils/string';
import { useDispatch } from 'react-redux';
import { useItemContext, useItemMetaContext } from '../lib/formsEngineContext';
import type { FileUploadResult } from '../../SingleFileUpload';
import { ContentPicker } from '../components/ContentPicker';
import useActiveSiteId from '../../../hooks/useActiveSiteId';
import Tooltip from '@mui/material/Tooltip';
import { useExtractDataSources } from '../dataSourceHooks/useExtractDataSources';
import {
	createMediaMenuOptions,
	downloadMedia,
	getImageRestrictionMessages,
	showBrowseFilesDialog,
	showImageCropDialog,
	showSearchDialog,
	showSingleFileUploadDialog
} from '../lib/controlHelpers';
import type { ImageRestrictions } from '../../ImageEditorDialog/types';
import Skeleton from '@mui/material/Skeleton';
import { nnou, nou } from '../../../utils/object';
import { validateImageRestrictions } from '../../../utils/content';

export interface ImagePickerProps extends ControlProps {
	value: string | null;
}

export type ImagePickerType = 'browse' | 'upload' | 'search';

export function ImagePicker(props: ImagePickerProps) {
	const { field, value: valueProp, setValue, contentType, autoFocus, readonly: formReadonly } = props;
	const siteId = useActiveSiteId();
	const { guestBase } = useEnv();
	const contextItem = useItemContext();
	const { id, pathInSite } = useItemMetaContext();

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
	const { imageInfo, isFetchingDimensions, isFetchingMetadata, errorDimensions, errorMetadata } = useImageInfo(
		value ? ensureSingleSlash(`${guestBase}${value}`) : ''
	);
	const hasValue = Boolean(value);
	const dataSourceSummary = useConsolidatedImagePickerData(useExtractDataSources(contentType, field, 'imageManager'));
	const { allowedBrowsePaths, allowedUploadPaths, allowedSearchPaths } = dataSourceSummary;
	const addMenuButtonRef = useRef<HTMLButtonElement>(undefined);
	const [addMenuOpen, setAddMenuOpen] = useState(false);
	const dispatch = useDispatch();
	const [openPickerDialog, setOpenPickerDialog] = useState(false);
	const [pickerType, setPickerType] = useState<ImagePickerType | null>(null);

	useEffect(() => {
		// If there's a default value and no value has been set yet, set it as the value.
		if (nou(valueProp) && defaultValue != null) {
			setValue(defaultValue);
		}
	}, [defaultValue, setValue, valueProp]);

	const imageRestrictionMessages = getImageRestrictionMessages(restrictions);
	/* TODO: handleDataSourceOptionClick and executeDataSourceOption only handle hardcoded 'browse', 'upload' and 'search' options.
	    We need to make them dynamic to support plugins. */
	const handleDataSourceOptionClick = (option: ImagePickerType) => {
		setAddMenuOpen(false);
		switch (option) {
			case 'browse': {
				if (allowedBrowsePaths.length === 1) {
					executeDataSourceOption('browse', allowedBrowsePaths[0]);
				} else {
					// Open browse picker
					setPickerType('browse');
					setOpenPickerDialog(true);
				}
				break;
			}
			case 'upload': {
				if (allowedUploadPaths.length === 1) {
					executeDataSourceOption('upload', allowedUploadPaths[0]);
				} else {
					// Open upload picker
					setPickerType('upload');
					setOpenPickerDialog(true);
				}
				break;
			}
			case 'search': {
				if (allowedSearchPaths.length === 1) {
					executeDataSourceOption('search', allowedSearchPaths[0]);
				} else {
					// Open search picker
					setPickerType('search');
					setOpenPickerDialog(true);
				}
				break;
			}
		}
	};
	const executeDataSourceOption = (optionType: ImagePickerType, choice: AllowedPathsData) => {
		const processPath = (path: string) =>
			processPathMacros({ path, objectId: id, fullParentPath: contextItem?.path ?? pathInSite });

		switch (optionType) {
			case 'browse': {
				showBrowseFilesDialog({
					dispatch,
					path: processPath(choice.path),
					multiSelect: false,
					preselectedPaths: value ? [value] : [],
					initialParameters: {
						sortBy: choice.options?.sortBy,
						sortOrder: choice.options?.sortOrder
					},
					onSuccess(imageData: MediaItem) {
						// Check if the image meets restrictions
						validateImageRestrictions(imageData.path, restrictions).then((meetsRestrictions) => {
							if (!meetsRestrictions) {
								showImageCropDialog({
									dispatch,
									path: imageData.path,
									mimeType: imageData.mimeType,
									restrictions,
									writeContent: true,
									onCrop: (blob: Blob, newPath: string) => {
										setValue(newPath ?? imageData.path);
									}
								});
							} else {
								setValue(imageData.path);
							}
						});
					}
				});
				break;
			}
			case 'search': {
				showSearchDialog({
					dispatch,
					path: ensureSingleSlash(`${processPath(choice.path)}/.+`),
					preselectedPaths: value ? [value] : [],
					initialParameters: {
						sortBy: choice.options?.sortBy,
						sortOrder: choice.options?.sortOrder
					},
					onAcceptSelection(images) {
						validateImageRestrictions(images[0], restrictions).then((meetsRestrictions) => {
							if (!meetsRestrictions) {
								showImageCropDialog({
									dispatch,
									path: images[0],
									restrictions,
									writeContent: true,
									onCrop: (blob: Blob, newPath: string) => {
										setValue(newPath ?? images[0]);
									}
								});
							} else {
								setValue(images[0]);
							}
						});
					}
				});
				break;
			}
			case 'upload': {
				showSingleFileUploadDialog({
					dispatch,
					siteId,
					path: processPath(choice.path),
					fileTypes: ['image/*'],
					onFileAdded: (file, uppy, callback) => {
						const data = file.data;
						const url = URL.createObjectURL(data as Blob | MediaSource);
						validateImageRestrictions(url, restrictions).then((meetsRestrictions) => {
							if (!meetsRestrictions) {
								showImageCropDialog({
									dispatch,
									path: url,
									mimeType: file.type,
									restrictions,
									onCrop: (blob: Blob) => {
										uppy.setFileState(file.id, {
											source: 'crop',
											name: file.name,
											type: blob.type,
											data: blob
										});
										callback?.();
										URL.revokeObjectURL(url);
									}
								});
							} else {
								callback?.();
								URL.revokeObjectURL(url);
							}
						});
					},
					onUploadComplete(result: FileUploadResult) {
						if (result.successful.length) {
							const newValue = ensureSingleSlash(`${result.successful[0].meta.path}`);
							setValue(newValue);
						}
					}
				});
				break;
			}
		}
	};
	const handleDataSourcePickerDialogChange = (event, choice: AllowedPathsData) => {
		if (!pickerType) return;
		executeDataSourceOption(pickerType, choice);
		setOpenPickerDialog(false);
	};

	const { menuOptions, availableOptions } = createMediaMenuOptions(
		dataSourceSummary,
		handleDataSourceOptionClick,
		readonly
	);

	const handleRemoveImage = () => {
		setValue(null);
	};

	return (
		<>
			<Menu
				anchorEl={addMenuButtonRef.current}
				open={addMenuOpen}
				onClose={() => setAddMenuOpen(false)}
				sx={{
					[`.${menuItemClasses.root}`]: { pl: 3 }
				}}
			>
				{menuOptions}
			</Menu>
			<Dialog open={openPickerDialog} onClose={() => setOpenPickerDialog(false)} fullWidth maxWidth="sm">
				<DialogHeader
					title={<FormattedMessage defaultMessage="Choose how to proceed" />}
					onCloseButtonClick={() => setOpenPickerDialog(false)}
				/>
				<DialogBody>
					{(() => {
						switch (pickerType) {
							case 'browse':
								return (
									<ContentPicker
										label={<FormattedMessage defaultMessage="Browse Settings" />}
										allowedPaths={allowedBrowsePaths}
										onChange={handleDataSourcePickerDialogChange}
									/>
								);
							case 'upload':
								return (
									<ContentPicker
										label={<FormattedMessage defaultMessage="Upload Settings" />}
										allowedPaths={allowedUploadPaths}
										onChange={handleDataSourcePickerDialogChange}
									/>
								);
							case 'search':
								return (
									<ContentPicker
										label={<FormattedMessage defaultMessage="Search Settings" />}
										allowedPaths={allowedSearchPaths}
										onChange={handleDataSourcePickerDialogChange}
									/>
								);
						}
					})()}
				</DialogBody>
			</Dialog>
			<FormsEngineField field={field}>
				{hasValue ? (
					<Card sx={{ display: 'flex' }}>
						<CardMedia
							component="img"
							sx={{ width: '40%' }}
							image={`${guestBase}${value}`}
							alt="Live from space album cover"
						/>
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
											ref={addMenuButtonRef}
											disabled={readonly}
											autoFocus={autoFocus}
											onClick={() => {
												if (availableOptions.length === 1) {
													handleDataSourceOptionClick(availableOptions[0]);
												} else if (availableOptions.length > 1) {
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
						{menuOptions}
					</Box>
				)}
			</FormsEngineField>
		</>
	);
}

export default ImagePicker;
