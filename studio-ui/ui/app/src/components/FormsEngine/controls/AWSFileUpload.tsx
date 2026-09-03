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

import type { ControlProps } from '../types';
import FormsEngineField from '../components/FormsEngineField';
import { getPropertyValue, isFieldReadOnly } from '../lib/formUtils';
import useActiveSiteId from '../../../hooks/useActiveSiteId';
import { FileUploadResult, SingleFileUpload } from '../../SingleFileUpload';
import useEnv from '../../../hooks/useEnv';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import FieldBox from '../components/FieldBox';
import { nou } from '../../../utils/object';
import { FormattedMessage, useIntl } from 'react-intl';
import Card from '@mui/material/Card';
import { useDispatch } from 'react-redux';
import { showSystemNotification } from '../../../state/actions/system';

export interface AwsFile {
	key: string;
	bucket: string;
	url: string;
}

export interface AwsFileUploadProps extends ControlProps {
	value: AwsFile;
}

export function AwsFileUpload(props: AwsFileUploadProps) {
	const { field, value, setValue, readonly: formReadonly } = props;
	const siteId = useActiveSiteId();
	const { authoringBase } = useEnv();
	const url = `${authoringBase}/api/2/aws/${siteId}/s3/upload.json`;
	const fileType = getAwsFileType(value?.url);
	const dispatch = useDispatch();
	const { formatMessage } = useIntl();

	const profileId = getPropertyValue(field.properties, 'profile_id') as string;
	const readonly = isFieldReadOnly(field, formReadonly);

	const handleFileUploaded = (result: FileUploadResult) => {
		if (result.failed.length) {
			dispatch(
				showSystemNotification({
					message: formatMessage({ defaultMessage: 'An error occurred while uploading the file.' })
				})
			);
		} else {
			const item = result.successful[0]?.response?.body?.item;
			if (!item) {
				// This is to guard against nullish `response.body.item`. Visual feedback is handled by SingleFileUpload component.
				return;
			}
			const awsFile: AwsFile = {
				key: item.name,
				bucket: item.bucketName ? `${item.bucketName}${item.prefix ? `/${item.prefix}` : ''}` : (item.bucket ?? ''),
				url: item.url ?? ''
			};
			setValue(awsFile);
		}
	};

	return (
		<FormsEngineField field={field}>
			{value && (
				<Box display="flex" flexDirection="row" justifyContent="space-between" mt={1}>
					<Typography variant="body2">{`s3://${value.bucket}/${value.key}`}</Typography>
					<Typography variant="body2" color="textSecondary">
						{value.url}
					</Typography>
				</Box>
			)}
			<FieldBox sx={{ my: 2, px: 1, pt: 1 }}>
				<form id="asset_upload_form">
					<input type="hidden" name="siteId" value={siteId} />
					<input type="hidden" name="profileId" value={profileId} />
					<input type="hidden" name="path" value={'/'} />
					<SingleFileUpload
						site={siteId}
						path="/"
						url={url}
						method="POST"
						showFileDetails={nou(value)}
						showProgressBar={nou(value)}
						onComplete={handleFileUploaded}
						disabled={readonly}
					/>
				</form>
			</FieldBox>
			{/* region Preview */}
			{value && (
				<Box sx={{ display: 'flex', justifyContent: 'center' }}>
					<Card sx={{ width: fileType === 'asset' ? '100%' : 'auto' }}>
						{fileType === 'image' ? (
							<Box
								component="img"
								src={value.url}
								alt={value.key}
								sx={{
									maxWidth: '100%',
									maxHeight: 220
								}}
							/>
						) : fileType === 'video' ? (
							<Box
								component="video"
								controls
								muted
								sx={{
									maxWidth: '100%',
									maxHeight: 220
								}}
							>
								<source src={value.url} type={`video/${value.url.match(/\.([a-z0-9]+)(?:\?|$)/i)?.[1] ?? 'mp4'}`} />
							</Box>
						) : fileType === 'asset' ? (
							<Box
								component="iframe"
								src={value.url}
								title={formatMessage({ defaultMessage: 'File preview' })}
								sandbox="allow-same-origin"
								sx={{
									width: '100%',
									maxHeight: 250,
									border: 'none'
								}}
							></Box>
						) : (
							<Typography>
								<FormattedMessage defaultMessage="(Preview not available)" />
							</Typography>
						)}
					</Card>
				</Box>
			)}
			{/*	endregion */}
		</FormsEngineField>
	);
}

function getAwsFileType(fileUrl?: string): 'image' | 'video' | 'asset' | 'unknown' {
	if (!fileUrl) return 'unknown';
	if (/\.(jpg|jpeg|png|gif|bmp|ico|svg|webp)(?:\?|$)/i.test(fileUrl)) return 'image';
	if (/\.(mp4|webm|ogv)(?:\?|$)/i.test(fileUrl)) return 'video';
	if (/\.(pdf|html|js|css|txt|json|md|jsx|ts|tsx|yaml|ftl)(?:\?|$)/i.test(fileUrl)) return 'asset';
	return 'unknown';
}

export default AwsFileUpload;
