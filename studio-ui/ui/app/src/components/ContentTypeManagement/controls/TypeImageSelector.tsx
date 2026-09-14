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

import OutlinedInput, { OutlinedInputProps } from '@mui/material/OutlinedInput';
import React, { useId } from 'react';
import FormsEngineField from '../../FormsEngine/components/FormsEngineField';
import Tooltip from '@mui/material/Tooltip';
import { FormattedMessage, useIntl } from 'react-intl';
import { useDispatch } from 'react-redux';
import { popDialog, pushDialog } from '../../../state/actions/dialogStack';
import { nanoid } from 'nanoid';
import IconButton from '@mui/material/IconButton';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import UploadRoundedIcon from '@mui/icons-material/UploadRounded';
import useActiveSiteId from '../../../hooks/useActiveSiteId';
import { useStableFormContext } from '../../FormsEngine/lib/formsEngineContext';
import { TypeBuilderControl } from '../utils';
import type { ImageRestrictions } from '../../ImageEditorDialog/types';
import { showImageCropDialog } from '../../FormsEngine/lib/controlHelpers';
import { validateImageRestrictions } from '../../../utils/content';
import { showSystemNotification } from '../../../state/actions/system';
import { ensureSingleSlash } from '../../../utils/string';
import { getFileNameFromPath } from '../../../utils/path';
import { uploadFile } from '../../../services/content';
import { pushErrorDialog } from '../../../utils/system';

export interface TypeImageSelectorProps extends TypeBuilderControl {
	value: string;
}

/** Content-type thumbnail size caps (WIDTHCONSTRAINS / HEIGHTCONSTRAINS). */
const TYPE_IMAGE_RESTRICTIONS: ImageRestrictions = {
	maxWidth: 775,
	maxHeight: 767
};

/**
 * Enables image selection through the ImageUploadDialog.
 * Opens ImageEditorDialog to crop when the upload exceeds the size restrictions.
 */
export function TypeImageSelector(props: TypeImageSelectorProps) {
	const { field, value, setValue, autoFocus } = props;
	const htmlId = useId();
	const siteId = useActiveSiteId();
	const dispatch = useDispatch();
	const { formatMessage } = useIntl();
	const basePath = '/config/studio/content-types';
	const stableFormContext = useStableFormContext();
	// stableFormContext.originalValues is of type `ContentType`, and `id` is the current contentTypeId.
	const contentTypeId = stableFormContext.originalValues.id;

	const handleChange: OutlinedInputProps['onChange'] = (e) => setValue(e.currentTarget.value);

	const onDeleteImage = () => {
		setValue('');
	};

	const onUploadImage = () => {
		const id = nanoid();
		dispatch(
			pushDialog({
				id,
				component: 'craftercms.components.SingleFileUploadDialog',
				props: {
					site: siteId,
					path: `${basePath}${contentTypeId}`,
					fileTypes: ['image/*'],
					onClose: () => dispatch(popDialog({ id })),
					onUploadComplete: (result) => {
						dispatch(popDialog({ id }));
						if (result.successful.length) {
							const uploaded = result.successful[0];
							const path = uploaded.meta?.path ?? ensureSingleSlash(`${basePath}${contentTypeId}/${uploaded.name}`);
							const mimeType = uploaded.type;
							// Config-folder paths aren't loadable as img src; use a blob URL for validation / cropper display.
							const objectUrl = URL.createObjectURL(uploaded.data);
							validateImageRestrictions(objectUrl, TYPE_IMAGE_RESTRICTIONS, mimeType)
								.then((meetsRestrictions) => {
									if (meetsRestrictions) {
										URL.revokeObjectURL(objectUrl);
										setValue(uploaded.name);
									} else {
										// Blob URLs force writeContent: false in showImageCropDialog; upload the cropped result ourselves.
										showImageCropDialog({
											dispatch,
											path: objectUrl,
											mimeType,
											restrictions: TYPE_IMAGE_RESTRICTIONS,
											writeContent: false,
											onCrop: (blob: Blob) => {
												URL.revokeObjectURL(objectUrl);
												const formData = new FormData();
												formData.append('file', blob, uploaded.name);
												formData.append('path', path);
												uploadFile(siteId, formData).subscribe({
													next: () => setValue(getFileNameFromPath(path)),
													error: ({ response }) => {
														dispatch(pushErrorDialog({ props: { error: response?.response } }));
													}
												});
											}
										});
									}
								})
								.catch(() => {
									URL.revokeObjectURL(objectUrl);
									dispatch(
										showSystemNotification({
											message: formatMessage({ defaultMessage: 'Unable to validate image restrictions.' })
										})
									);
								});
						} else if (result.failed.length) {
							dispatch(
								showSystemNotification({
									message: formatMessage(
										{ defaultMessage: 'Failed to upload image: {name}' },
										{ name: result.failed[0]?.name }
									),
									options: { variant: 'error' }
								})
							);
						}
					}
				}
			})
		);
	};

	return (
		<FormsEngineField htmlFor={htmlId} field={field}>
			<OutlinedInput
				autoFocus={autoFocus}
				id={htmlId}
				fullWidth
				value={value}
				onChange={handleChange}
				disabled
				endAdornment={
					<>
						{value && (
							<Tooltip title={<FormattedMessage defaultMessage="Remove image" />}>
								<IconButton onClick={() => onDeleteImage()}>
									<DeleteOutlineRoundedIcon />
								</IconButton>
							</Tooltip>
						)}
						<Tooltip title={<FormattedMessage defaultMessage="Upload Image" />}>
							<IconButton onClick={() => onUploadImage()}>
								<UploadRoundedIcon />
							</IconButton>
						</Tooltip>
					</>
				}
			/>
		</FormsEngineField>
	);
}

export default TypeImageSelector;
