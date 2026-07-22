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

import { DialogBody } from '../DialogBody';
import { DialogFooter } from '../DialogFooter';
import { useEffect, useRef, useState } from 'react';
import type { ImageEditorDialogProps } from './types';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import SecondaryButton from '../SecondaryButton';
import { FormattedMessage } from 'react-intl';
import PrimaryButton from '../PrimaryButton';
import Grid from '@mui/material/Grid';
import FormControl from '@mui/material/FormControl';
import { useSpreadState } from '../../hooks/useSpreadState';
import { Cropper, CropperRef } from 'react-advanced-cropper';
import 'react-advanced-cropper/dist/style.css';
import useActiveSiteId from '../../hooks/useActiveSiteId';
import { uploadFile } from '../../services/content';
import TextField from '@mui/material/TextField';
import CachedIcon from '@mui/icons-material/Cached';
import { getFileExtension, getFileNameFromPath, removeExtension } from '../../utils/path';
import { pushDialog } from '../../state/actions/dialogStack';
import { useDispatch } from 'react-redux';
import { createComponentId } from '../../utils/system';
import { applyAssetNameRules, isBlobUrl } from '../../utils/content';
import { isEmpty } from '../../utils/string';
import { Slider } from '@mui/material';
import AdjustableBackground from './AdjustableBackground';
import ActionsBar from './ActionsBar';
import Alert from '@mui/material/Alert';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';

export type EditorMode = 'crop' | 'saturation' | 'brightness' | 'contrast' | null;
const sliderModes = ['saturation', 'brightness', 'contrast'];
type SliderMode = (typeof sliderModes)[number];
type Adjustments = Record<SliderMode, number>;
const initialAdjustments: Adjustments = { brightness: 0, saturation: 0, contrast: 0 };

const maxHeight = 550;
const getBlob = (cropper: CropperRef, fileExtension: string, mimeType: string) => {
	if (!cropper) return null;

	return new Promise<Blob | null>((resolve) => {
		const croppedCanvas = cropper.getCanvas();
		if (!croppedCanvas) {
			resolve(null);
			return;
		}
		const ext = (fileExtension || '').toLowerCase();
		const mime =
			mimeType ??
			(ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'svg' ? 'image/svg+xml' : 'image/jpeg');
		const quality = mime === 'image/jpeg' ? 0.92 : undefined;
		croppedCanvas.toBlob(
			(blob) => {
				if (!blob) return;
				resolve(blob);
			},
			mime,
			quality
		);
	});
};

export function ImageEditorDialogContainer(props: ImageEditorDialogProps) {
	const {
		path,
		mimeType,
		onCrop,
		restrictions,
		writeContent,
		tools = ['crop', 'rotate', 'flip', 'adjustments'],
		onClose
	} = props;
	const cropperRef = useRef<CropperRef | null>(null);
	const siteId = useActiveSiteId();
	const fileExtension = getFileExtension(path);
	const fileNameWithoutExtension = removeExtension(getFileNameFromPath(path));
	const [overwriteState, setOverwriteState] = useSpreadState<{
		blobToWrite: Blob | null;
		fileName: string;
	}>({
		blobToWrite: null,
		fileName: fileNameWithoutExtension
	});
	const [coordinates, setCoordinates] = useState(null);
	const dispatch = useDispatch();
	const [editorMode, setEditorMode] = useState<EditorMode>(tools.includes('crop') ? 'crop' : null);
	const [adjustments, setAdjustments] = useState<Adjustments>(initialAdjustments);
	const cropperEnabled = editorMode && editorMode === 'crop';
	const isSliderMode = editorMode && sliderModes.includes(editorMode);
	const isNewFileName = overwriteState.fileName !== fileNameWithoutExtension;

	useEffect(() => {
		if (path && isBlobUrl(path)) {
			return () => URL.revokeObjectURL(path);
		}
	}, [path]);

	const handleSubmit = (newPath?: string) => {
		const cropper = cropperRef.current;
		if (!cropper) return;

		getBlob(cropper, fileExtension, mimeType).then((blob) => {
			if (!blob) return;
			onCrop?.(blob, newPath);
		});
	};

	const handleChange = (cropper: CropperRef) => {
		setCoordinates(cropper.getCoordinates());
	};

	/** Called when the `writeContent` param is true. Uploads the cropped image to the specified path.
	 *
	 * @param writePath The path where the cropped image will be saved.
	 */
	const handleWriteContent = (writePath: string) => {
		const cropper = cropperRef.current;
		if (!cropper) return;
		const fileName = getFileNameFromPath(writePath);
		const formData = new FormData();
		getBlob(cropper, fileExtension, mimeType).then((blob) => {
			if (!blob) return;
			formData.append('file', blob, fileName);
			formData.append('path', writePath);
			uploadFile(siteId, formData).subscribe({
				next: () => {
					handleSubmit(writePath !== path ? writePath : null);
				},
				error: ({ response }) => {
					dispatch(
						pushDialog({
							component: createComponentId('ErrorDialog'),
							props: { error: response?.response }
						})
					);
				}
			});
		});
	};

	/** Handles renaming the file when the user changes the file name and clicks "Accept". */
	const handleRename = () => {
		const newFileName = `${overwriteState.fileName}.${fileExtension}`;
		const newPath = path.replace(getFileNameFromPath(path), newFileName);
		handleWriteContent(newPath);
	};

	const handleReset = () => {
		setCoordinates({
			height: restrictions?.height ?? restrictions?.maxHeight,
			width: restrictions?.width ?? restrictions?.maxWidth
		});
		setAdjustments(initialAdjustments);
		cropperRef.current?.reset();
	};

	// region Image editing functions
	const rotate = (angle: number) => {
		if (cropperRef.current) {
			cropperRef.current.rotateImage(angle);
		}
	};

	const flip = (horizontal: boolean, vertical: boolean) => {
		if (cropperRef.current) {
			cropperRef.current.flipImage(horizontal, vertical);
		}
	};

	const onChangeAdjustment = (value: number) => {
		if (isSliderMode) {
			setAdjustments((previousValue) => ({
				...previousValue,
				[editorMode]: value / 100
			}));
		}
	};
	// endregion

	return (
		<>
			<DialogBody>
				<Grid container spacing={2}>
					{writeContent && (
						<Grid size={{ xs: 12, md: 6 }} rowSpacing={2} container alignItems="start" justifyContent="space-between">
							<FormControl fullWidth>
								<TextField
									label={<FormattedMessage defaultMessage="File name" />}
									size="small"
									slotProps={{
										inputLabel: { shrink: true },
										input: {
											endAdornment: (
												<Box component="span" sx={{ color: (theme) => theme.palette.text.disabled }}>
													.{fileExtension}
												</Box>
											),
											sx: {
												maxWidth: { md: 500 },
												...(writeContent &&
													!isNewFileName && {
														borderBottomRightRadius: 0,
														borderBottomLeftRadius: 0,
														borderBottomWidth: 0
													})
											}
										}
									}}
									variant="outlined"
									value={overwriteState.fileName}
									onChange={(e) => setOverwriteState({ fileName: applyAssetNameRules(e.target.value) })}
								/>
								{writeContent && !isNewFileName && (
									<Alert
										severity="warning"
										sx={{
											maxWidth: { md: 500 },
											py: 0,
											borderTopLeftRadius: 0,
											borderTopRightRadius: 0,
											borderTop: 'none'
										}}
										iconMapping={{
											warning: <WarningAmberRoundedIcon sx={{ fontSize: '16px', alignSelf: 'center' }} />
										}}
									>
										<FormattedMessage defaultMessage="File already exists. Rename to avoid overwriting existing." />
									</Alert>
								)}
							</FormControl>
						</Grid>
					)}
					<Grid size={{ xs: 12, md: 6 }} container alignItems="start">
						<Box display="flex" gap={2}>
							<FormControl>
								<TextField
									label={<FormattedMessage defaultMessage="Width" />}
									size="small"
									slotProps={{ inputLabel: { shrink: true } }}
									variant="outlined"
									disabled
									value={coordinates?.width ?? ''}
								/>
							</FormControl>
							<FormControl>
								<TextField
									label={<FormattedMessage defaultMessage="Height" />}
									size="small"
									slotProps={{ inputLabel: { shrink: true } }}
									variant="outlined"
									disabled
									value={coordinates?.height ?? ''}
								/>
							</FormControl>
							<FormControl>
								<Button onClick={handleReset} startIcon={<CachedIcon />}>
									<FormattedMessage defaultMessage="Reset" />
								</Button>
							</FormControl>
						</Box>
					</Grid>
					<Grid size={{ xs: 12 }}>
						<Box maxHeight={maxHeight}>
							<Cropper
								ref={cropperRef}
								src={path}
								minHeight={restrictions?.height ?? restrictions?.minHeight}
								minWidth={restrictions?.width ?? restrictions?.minWidth}
								maxHeight={restrictions?.height ?? restrictions?.maxHeight}
								maxWidth={restrictions?.width ?? restrictions?.maxWidth}
								stencilProps={{
									handlers: cropperEnabled && !(restrictions?.height && restrictions?.width),
									movable: cropperEnabled,
									resizable: cropperEnabled,
									lines: cropperEnabled
								}}
								onUpdate={handleChange}
								backgroundComponent={AdjustableBackground}
								backgroundProps={adjustments}
								backgroundWrapperProps={{
									scaleImage: cropperEnabled,
									moveImage: cropperEnabled
								}}
								style={{ maxHeight: maxHeight }}
							/>
						</Box>
						{isSliderMode && (
							<Box sx={{ px: 1, mt: 1 }}>
								<Slider
									size="small"
									min={-100}
									max={100}
									marks={[{ value: 0 }]}
									value={isSliderMode ? Math.trunc(adjustments[editorMode] * 100) : 0}
									aria-label="Slider"
									valueLabelDisplay="auto"
									onChange={(_, value) => onChangeAdjustment(value as number)}
								/>
							</Box>
						)}
						{!tools.every((tool) => tool === 'crop') && (
							<ActionsBar
								tools={tools}
								currentMode={editorMode}
								setMode={setEditorMode}
								onRotate={rotate}
								onFlip={flip}
							/>
						)}
					</Grid>
				</Grid>
			</DialogBody>
			<DialogFooter>
				<SecondaryButton onClick={(e) => onClose?.(e, null)}>
					<FormattedMessage defaultMessage="Cancel" />
				</SecondaryButton>
				{!writeContent || (writeContent && isNewFileName) ? (
					<PrimaryButton
						disabled={isEmpty(overwriteState.fileName)}
						onClick={() => {
							if (writeContent) {
								handleRename();
							} else {
								handleSubmit();
							}
						}}
					>
						<FormattedMessage defaultMessage="Accept" />
					</PrimaryButton>
				) : (
					<PrimaryButton
						disabled={!coordinates?.width || !coordinates?.height}
						onClick={() => handleWriteContent(path)}
					>
						<FormattedMessage defaultMessage="Overwrite" />
					</PrimaryButton>
				)}
			</DialogFooter>
		</>
	);
}

export default ImageEditorDialogContainer;
