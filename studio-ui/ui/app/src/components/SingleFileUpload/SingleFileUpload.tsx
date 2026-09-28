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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Uppy, XHRUpload, Form } from 'uppy';
import ProgressBar from '@uppy/progress-bar';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import 'uppy/dist/uppy.css';
import '@uppy/progress-bar/dist/style.css';
import { getGlobalHeaders } from '../../utils/ajax';
import { validateActionPolicy } from '../../services/sites';
import { checkPathExistence } from '../../services/content';
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog';
import type { Body, Meta, UppyFile } from '@uppy/core';
import { useDispatch } from 'react-redux';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import useSiteUIConfig from '../../hooks/useSiteUIConfig';
import { ensureSingleSlash } from '../../utils/string';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { getResponseError } from '../UploadDialog/util';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import Box from '@mui/material/Box';
import { pushErrorDialog } from '../../utils/system';

const messages = defineMessages({
	chooseFile: {
		id: 'fileUpload.chooseFile',
		defaultMessage: 'Choose File'
	},
	validatingFile: {
		id: 'fileUpload.validatingFile',
		defaultMessage: 'Validating File'
	},
	uploadingFile: {
		id: 'fileUpload.uploadingFile',
		defaultMessage: 'Uploading File'
	},
	uploadedFile: {
		id: 'fileUpload.uploadedFile',
		defaultMessage: 'Uploaded File'
	},
	selectFileMessage: {
		id: 'fileUpload.selectFileMessage',
		defaultMessage: 'Please select a file to upload'
	},
	policyError: {
		defaultMessage: 'File "{fileName}" doesn\'t comply with project policies: {detail}'
	},
	overwriteConfirm: {
		id: 'fileUpload.overwriteConfirm',
		defaultMessage: 'A file named "{fileName}" already exists at this location. Do you want to overwrite it?'
	}
});

export interface FileUpload {
	data: File;
	extension: string;
	id: string;
	isPaused: boolean;
	isRemote: boolean;
	meta: { name: string; path: string; site: string; type: string };
	name: string;
	preview: any;
	progress: { uploadStarted: number; uploadComplete: boolean; percentage: 100; bytesUploaded: number };
	remote: string;
	response: { status: number; body: any; uploadUrl: string };
	size: number;
	source: string;
	type: string;
	uploadUrl: string;
}

export interface FileUploadResult {
	successful: FileUpload[];
	failed: FileUpload[];
	uploadID: string;
}

export interface SingleFileUploadProps {
	site: string;
	formTarget?: string;
	url?: string;
	path: string;
	customFileName?: string;
	fileTypes?: string[];
	onFileAdded?: (file: UppyFile<Meta, Body>, uppy: Uppy<Meta, Body>, callback: () => void) => void;
	method?: 'PUT' | 'POST';
	showFileDetails?: boolean;
	showProgressBar?: boolean;
	disabled?: boolean;
	onUploadStart?(): void;
	onComplete?(result: FileUploadResult): void;
	onError?({ file, error, response }): void;
}

export function SingleFileUpload(props: SingleFileUploadProps) {
	const {
		site,
		url = `/studio/api/2/content/${site}`,
		formTarget = '#asset_upload_form',
		onUploadStart,
		onComplete,
		onError,
		customFileName,
		fileTypes,
		path,
		onFileAdded: onFileAddedProp,
		method = 'PUT',
		showFileDetails = true,
		showProgressBar = true,
		disabled = false
	} = props;
	const { formatMessage } = useIntl();
	const dispatch = useDispatch();
	const [description, setDescription] = useState<string>(formatMessage(messages.selectFileMessage));
	const [file, setFile] = useState<UppyFile<Meta, Body>>(null);
	const fileRef = useRef(null);
	const [suggestedName, setSuggestedName] = useState(null);
	const suggestedNameRef = useRef(null);
	const [fileNameErrorClass, setFileNameErrorClass] = useState<string>();
	const [disableInput, setDisableInput] = useState(false);
	const { upload } = useSiteUIConfig();
	const [confirm, setConfirm] = useState<{
		body: string;
		type: 'policy' | 'overwrite' | 'error';
	}>(null);
	const [error, setError] = useState(null);
	fileRef.current = file;
	suggestedNameRef.current = suggestedName;

	const uppy = useMemo(
		() =>
			new Uppy<Meta, Body>({
				autoProceed: false,
				...(fileTypes ? { restrictions: { allowedFileTypes: fileTypes } } : {}),
				...(customFileName
					? {
							onBeforeFileAdded: (currentFile) => {
								return {
									...currentFile,
									name: customFileName,
									meta: {
										...currentFile.meta,
										name: customFileName,
										path: ensureSingleSlash(`${path}/${customFileName}`)
									}
								};
							}
						}
					: {}),
				onBeforeUpload: (files) => {
					if (suggestedNameRef.current) {
						const updatedFiles = {
							...files,
							[fileRef.current.id]: {
								...files[fileRef.current.id],
								name: suggestedNameRef.current,
								meta: {
									...files[fileRef.current.id].meta,
									name: suggestedNameRef.current,
									path: ensureSingleSlash(`${path}/${suggestedNameRef.current}`)
								}
							}
						};
						setSuggestedName(null);
						return updatedFiles;
					} else {
						return {
							...files,
							[fileRef.current.id]: {
								...files[fileRef.current.id],
								meta: {
									...files[fileRef.current.id].meta,
									path: ensureSingleSlash(`${path}/${files[fileRef.current.id].meta.name}`)
								}
							}
						};
					}
				}
			}),
		[fileTypes, customFileName, path]
	);

	const confirmUpload = () => {
		// When uploading large files to aws/s3, something causes requests to fail and get retried n times before finally stating it failed; despite the file seemingly actually getting uploaded.
		// This setTimeout avoids that issue. The mechanism of failure or why this avoids it is unknown.
		setTimeout(() => uppy.upload(), 50);
		setDescription(`${formatMessage(messages.uploadingFile)}:`);
		onUploadStart?.();
	};

	const checkExistenceAndUpload = (targetPath: string, fileName: string) => {
		checkPathExistence(site, targetPath).subscribe({
			next: (exists) => {
				if (exists) {
					setConfirm({
						type: 'overwrite',
						body: formatMessage(messages.overwriteConfirm, { fileName })
					});
				} else {
					confirmUpload();
				}
			},
			error: ({ response }) => {
				setDisableInput(false);
				dispatch(pushErrorDialog({ props: { error: response?.response } }));
			}
		});
	};

	const retryUpload = () => {
		setError(null);
		setConfirm(null);
		uppy.retryUpload(file.id);
	};

	useEffect(() => {
		const instance = uppy
			.use(Form, {
				target: formTarget,
				getMetaFromForm: true,
				addResultToForm: true,
				submitOnSuccess: false,
				triggerUploadOnSubmit: false
			})
			.use(ProgressBar, {
				target: '.uppy-progress-bar',
				hideAfterFinish: false
			})
			.use(XHRUpload, {
				endpoint: url,
				method,
				formData: true,
				fieldName: 'file',
				timeout: upload.timeout,
				headers: getGlobalHeaders(),
				onAfterResponse: (response) => {
					if (response.status !== 200) {
						throw getResponseError(response.responseText, formatMessage);
					}
				}
			});

		return () => {
			// https://uppy.io/docs/uppy/#uppy-close
			instance.cancelAll();
			instance.destroy();
		};
	}, [uppy, formTarget, url, upload.timeout, path, site, formatMessage, method]);

	useEffect(() => {
		const onUploadSuccess = () => {
			setDescription(`${formatMessage(messages.uploadedFile)}:`);
		};

		const onCompleteUpload = (result) => {
			// Uppy triggers 'complete' event even if the upload fails. When the upload fails, we call 'onError' instead of
			// 'onComplete'.
			if (result.successful.length > 0) {
				onComplete?.(result);
				setDisableInput(false);
			}
		};

		uppy.on('upload-success', onUploadSuccess);
		uppy.on('complete', onCompleteUpload);

		return () => {
			uppy.off('upload-success', onUploadSuccess);
			uppy.off('complete', onCompleteUpload);
		};
	}, [onComplete, dispatch, formatMessage, path, uppy]);

	useEffect(() => {
		const onUploadError = (file, error, response) => {
			setFileNameErrorClass('text-danger');
			setError(error);
			onError?.({ file, error, response });
			setDisableInput(false);
		};

		uppy.on('upload-error', onUploadError);

		return () => {
			uppy.off('upload-error', onUploadError);
		};
	}, [onError, uppy]);

	useEffect(() => {
		const onFileAdded = (file: UppyFile<Meta, Body>) => {
			setError(null);
			setFileNameErrorClass('');
			const fileName = file.name;
			const validatePolicy = () => {
				setDescription(`${formatMessage(messages.validatingFile)}:`);
				validateActionPolicy(site, {
					type: 'CREATE',
					target: ensureSingleSlash(`${path}/${fileName}`),
					contentMetadata: {
						fileSize: file.size
					}
				}).subscribe({
					next: ({ allowed, modifiedValue, message }) => {
						if (allowed) {
							setDisableInput(true);
							if (modifiedValue) {
								// Modified value is expected to be a path.
								const modifiedName = modifiedValue.match(/[^/]+$/)?.[0] ?? modifiedValue;
								setConfirm({
									type: 'policy',
									body: formatMessage(
										{
											defaultMessage:
												'Path `{fileName}` was transformed to `{modifiedName}` per the project file name policy'
										},
										{ fileName, modifiedName }
									)
								});
								setSuggestedName(modifiedName);
							} else {
								checkExistenceAndUpload(ensureSingleSlash(`${path}/${fileName}`), fileName);
							}
						} else {
							setConfirm({
								type: 'error',
								body: formatMessage(messages.policyError, { fileName: file.name, detail: message })
							});
						}
					},
					error: ({ response }) => {
						dispatch(pushErrorDialog({ props: { error: response?.response } }));
					}
				});
			};
			// When using the 'onFileAdded' prop, we need to make sure the 'file' state is set after the callback is executed,
			// then we call 'validatePolicy' to validate the file against action policies. If no 'onFileAdded' prop is provided,
			// we just set the 'file' state and call 'validatePolicy'.
			// 'onFileAdded' is useful when you need to do something with the file before starting the upload.
			if (onFileAddedProp) {
				onFileAddedProp?.(file, uppy, () => {
					setFile(file);
					validatePolicy();
				});
			} else {
				setFile(file);
				validatePolicy();
			}
		};

		uppy.on('file-added', onFileAdded);

		return () => {
			uppy.off('file-added', onFileAdded);
		};
	}, [onUploadStart, formatMessage, path, site, uppy, dispatch, onFileAddedProp]);

	const onConfirm = () => {
		if (confirm?.type === 'policy') {
			const name = suggestedName ?? file.name;
			setConfirm(null);
			checkExistenceAndUpload(ensureSingleSlash(`${path}/${name}`), name);
		} else if (confirm?.type === 'overwrite') {
			setConfirm(null);
			confirmUpload();
		}
	};

	const onConfirmCancel = () => {
		document.querySelector('.uppy-FileInput-btn')?.removeAttribute('disabled');
		uppy.removeFile(file.id);
		setFile(null);
		setSuggestedName(null);
		setConfirm(null);
		setDescription(formatMessage(messages.selectFileMessage));
		setDisableInput(false);
	};

	const onChange = ({ nativeEvent: event }) => {
		const files: File[] = Array.from(event.target.files);
		files.forEach((file) => {
			try {
				uppy.addFile({
					source: 'file input',
					name: file.name,
					type: file.type,
					data: file
				});
			} catch (err) {
				console.error(err);
			}
		});
	};

	// Clear input current value on click, so if you need to select the same file (in case of an error) it will re-trigger
	// the change/file selection.
	const onInputClick = (event: React.MouseEvent<HTMLInputElement, MouseEvent>) => {
		const element = event.target as HTMLInputElement;
		element.value = '';
	};

	return (
		<>
			<form id="asset_upload_form">
				<input type="hidden" name="site" value={site} />
			</form>
			<Box className="uppy-progress-bar" sx={{ display: !showProgressBar || error ? 'none' : null }} />
			<div className="uploaded-files">
				{error ? (
					<Alert
						icon={false}
						severity="error"
						action={
							<Tooltip title={<FormattedMessage defaultMessage="Retry" />}>
								<IconButton
									onClick={() => retryUpload()}
									size="small"
									aria-label={formatMessage({ defaultMessage: 'Retry' })}
								>
									<ReplayRoundedIcon />
								</IconButton>
							</Tooltip>
						}
						sx={{ mb: 2 }}
					>
						<Typography variant="subtitle1" component="h2">
							{error.message}
						</Typography>
					</Alert>
				) : (
					showFileDetails && (
						<Typography variant="subtitle1" component="h2" sx={{ mb: 2 }}>
							{description}
						</Typography>
					)
				)}
				{showFileDetails && (
					<Typography variant="subtitle1" component="h2" sx={{ mb: 2 }}>
						{file && (
							<Box
								component="em"
								className={`single-file-upload--filename ${fileNameErrorClass}`}
								sx={{
									overflow: 'hidden',
									textOverflow: 'ellipsis',
									whiteSpace: 'nowrap'
								}}
								title={file.name}
							>
								{file.name}
							</Box>
						)}
					</Typography>
				)}
				<Box sx={{ marginBottom: '10px' }}>
					<Box
						component="input"
						accept={fileTypes?.join(',')}
						sx={{ display: 'none !important' }}
						id="contained-button-file"
						type="file"
						onChange={onChange}
						onClick={onInputClick}
						disabled={disabled || disableInput}
					/>
					<label htmlFor="contained-button-file">
						<Button variant="outlined" component="span" disabled={disabled || disableInput}>
							{formatMessage(messages.chooseFile)}
						</Button>
					</label>
				</Box>
			</div>
			<ConfirmDialog
				open={Boolean(confirm)}
				body={confirm?.body}
				onOk={confirm?.type === 'error' ? onConfirmCancel : onConfirm}
				onCancel={confirm?.type === 'error' ? null : onConfirmCancel}
				disableEnforceFocus={true}
			/>
		</>
	);
}

export default SingleFileUpload;
