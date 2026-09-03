/*
 * Copyright (C) 2007-2026 Crafter Software Corporation. All Rights Reserved.
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

import { EnhancedDialog, EnhancedDialogProps, useEnhancedDialogContext } from '../EnhancedDialog';
import { FormattedMessage } from 'react-intl';
import React, { useCallback } from 'react';
import { DialogBody } from '../DialogBody';
import useActiveSiteId from '../../hooks/useActiveSiteId';
import { SingleFileUpload } from '../SingleFileUpload';
import useEnv from '../../hooks/useEnv';
import type { Uppy } from 'uppy';
import type { UppyFile, Meta, Body } from '@uppy/utils/lib/UppyFile';
import { s3UploadUri, webDAVUploadUri } from '../../utils/constants';

export interface ExternalAssetUploadDialogBaseProps {
	path: string;
	profileId: string;
	profileType?: 'aws' | 'webdav';
	fileTypes?: string[];
	onUploadStart?(): void;
	onUploadComplete?(result: any): void;
	onUploadError?({ file, error, response }): void;
	onFileAdded?: (file: UppyFile<Meta, Body>, uppy: Uppy, callback: () => void) => void;
}

export interface ExternalAssetUploadDialogProps extends ExternalAssetUploadDialogBaseProps, EnhancedDialogProps {}

export interface ExternalAssetUploadDialogBodyProps
	extends ExternalAssetUploadDialogBaseProps, Pick<ExternalAssetUploadDialogProps, 'onClose'> {}

function ExternalAssetUploadDialogBody(props: ExternalAssetUploadDialogBodyProps) {
	const {
		path,
		profileId,
		profileType = 'aws',
		fileTypes,
		onUploadStart,
		onUploadComplete,
		onUploadError,
		onFileAdded
	} = props;
	const { updateSubmittingOrHasPendingChanges } = useEnhancedDialogContext();
	const siteId = useActiveSiteId();
	const { authoringBase } = useEnv();

	const url = `${authoringBase}${profileType === 'aws' ? s3UploadUri.replace('{siteId}', siteId) : webDAVUploadUri.replace('{siteId}', siteId)}`;
	const onStart = useCallback(() => {
		onUploadStart?.();
		updateSubmittingOrHasPendingChanges({ isSubmitting: true });
	}, [onUploadStart, updateSubmittingOrHasPendingChanges]);

	const onError = useCallback(
		({ file, error, response }) => {
			updateSubmittingOrHasPendingChanges({ isSubmitting: false });

			onUploadError?.({ file, error, response });
		},
		[onUploadError, updateSubmittingOrHasPendingChanges]
	);

	const onComplete = useCallback(
		(result) => {
			updateSubmittingOrHasPendingChanges({ isSubmitting: false });
			onUploadComplete?.(result);
		},
		[onUploadComplete, updateSubmittingOrHasPendingChanges]
	);

	return (
		<>
			<DialogBody sx={{ p: 4 }}>
				<form id="asset_upload_form">
					<input type="hidden" name="siteId" value={siteId} />
					<input type="hidden" name="profileId" value={profileId} />
					<input type="hidden" name="path" value={path} />
					<SingleFileUpload
						site={siteId}
						path={path}
						url={url}
						method="POST"
						fileTypes={fileTypes}
						onUploadStart={onStart}
						onComplete={onComplete}
						onError={onError}
						onFileAdded={onFileAdded}
					/>
				</form>
			</DialogBody>
		</>
	);
}

export function ExternalAssetUploadDialog(props: ExternalAssetUploadDialogProps) {
	const {
		path,
		profileId,
		profileType,
		fileTypes,
		onClose,
		onUploadStart,
		onUploadComplete,
		onUploadError,
		onFileAdded,
		...rest
	} = props;
	return (
		<EnhancedDialog
			title={<FormattedMessage id="words.upload" defaultMessage="Upload" />}
			maxWidth="xs"
			onClose={onClose}
			{...rest}
		>
			<ExternalAssetUploadDialogBody
				path={path}
				profileId={profileId}
				profileType={profileType}
				fileTypes={fileTypes}
				onClose={onClose}
				onUploadStart={onUploadStart}
				onUploadComplete={onUploadComplete}
				onUploadError={onUploadError}
				onFileAdded={onFileAdded}
			/>
		</EnhancedDialog>
	);
}

export default ExternalAssetUploadDialog;
