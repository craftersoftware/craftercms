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

import type { ImageEditorDialogProps } from './types';
import type { EditorMode } from './ImageEditorDialogContainer';
import Tooltip from '@mui/material/Tooltip';
import { useIntl } from 'react-intl';
import IconButton from '@mui/material/IconButton';
import CropIcon from '@mui/icons-material/Crop';
import Divider from '@mui/material/Divider';
import RotateLeftIcon from '@mui/icons-material/RotateLeft';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import SaturationIcon from '@mui/icons-material/WaterDrop';
import BrightnessIcon from '@mui/icons-material/Brightness7';
import ContrastIcon from '@mui/icons-material/Contrast';
import FlipIcon from '@mui/icons-material/Flip';
import Box from '@mui/material/Box';

export interface ActionsBarProps {
	tools: ImageEditorDialogProps['tools'];
	currentMode: EditorMode | null;
	setMode(mode: EditorMode | null): void;
	onRotate(angle: number): void;
	onFlip(horizontal: boolean, vertical: boolean): void;
}

const shouldRenderCrop = (tools: ImageEditorDialogProps['tools']) => tools && tools.includes('crop');
const shouldRenderAdjustments = (tools: ImageEditorDialogProps['tools']) => tools && tools.includes('adjustments');
const shouldRenderRotate = (tools: ImageEditorDialogProps['tools']) => tools && tools.includes('rotate');
const shouldRenderFlip = (tools: ImageEditorDialogProps['tools']) => tools && tools.includes('flip');

/** Toolbar of actions for the image editor. Contains crop, rotate, flip and adjustments (saturation, brightness,
 * contrast), and it renders only the actions configured in the `tools` prop */
export function ActionsBar(props: ActionsBarProps) {
	const { tools, currentMode, setMode: setEditorMode, onRotate, onFlip } = props;
	const { formatMessage } = useIntl();
	const cropLabel = formatMessage({ defaultMessage: 'Crop' });
	const rotateLeftLabel = formatMessage({ defaultMessage: 'Rotate left' });
	const rotateRightLabel = formatMessage({ defaultMessage: 'Rotate right' });
	const flipVerticalLabel = formatMessage({ defaultMessage: 'Flip vertical' });
	const flipHorizontalLabel = formatMessage({ defaultMessage: 'Flip horizontal' });
	const saturationLabel = formatMessage({ defaultMessage: 'Saturation' });
	const brightnessLabel = formatMessage({ defaultMessage: 'Brightness' });
	const contrastLabel = formatMessage({ defaultMessage: 'Contrast' });

	return (
		<Box
			sx={{
				backgroundColor: (theme) => theme.palette.background.paper,
				p: 1,
				display: 'flex',
				gap: 3,
				justifyContent: 'center'
			}}
		>
			{shouldRenderCrop(tools) && (
				<Tooltip title={cropLabel}>
					<IconButton
						color={currentMode === 'crop' ? 'primary' : 'default'}
						onClick={() => setEditorMode(currentMode !== 'crop' ? 'crop' : null)}
					>
						<CropIcon />
					</IconButton>
				</Tooltip>
			)}
			{shouldRenderRotate(tools) && (
				<>
					{shouldRenderCrop(tools) && (
						<Divider orientation="vertical" flexItem sx={{ height: 30, alignSelf: 'center' }} />
					)}
					<Tooltip title={rotateLeftLabel}>
						<IconButton onClick={() => onRotate(-90)}>
							<RotateLeftIcon />
						</IconButton>
					</Tooltip>
					<Tooltip title={rotateRightLabel}>
						<IconButton onClick={() => onRotate(90)}>
							<RotateRightIcon />
						</IconButton>
					</Tooltip>
				</>
			)}
			{shouldRenderFlip(tools) && (
				<>
					<Tooltip title={flipHorizontalLabel}>
						<IconButton onClick={() => onFlip(true, false)}>
							<FlipIcon />
						</IconButton>
					</Tooltip>
					<Tooltip title={flipVerticalLabel}>
						<IconButton onClick={() => onFlip(false, true)}>
							<FlipIcon sx={{ transform: 'rotate(90deg)' }} />
						</IconButton>
					</Tooltip>
				</>
			)}
			{shouldRenderAdjustments(tools) && (
				<>
					{(shouldRenderCrop(tools) || shouldRenderRotate(tools) || shouldRenderFlip(tools)) && (
						<Divider orientation="vertical" flexItem sx={{ height: 30, alignSelf: 'center' }} />
					)}
					<Tooltip title={saturationLabel}>
						<IconButton
							color={currentMode === 'saturation' ? 'primary' : 'default'}
							onClick={() => setEditorMode(currentMode !== 'saturation' ? 'saturation' : null)}
						>
							<SaturationIcon />
						</IconButton>
					</Tooltip>
					<Tooltip title={brightnessLabel}>
						<IconButton
							color={currentMode === 'brightness' ? 'primary' : 'default'}
							onClick={() => setEditorMode(currentMode !== 'brightness' ? 'brightness' : null)}
						>
							<BrightnessIcon />
						</IconButton>
					</Tooltip>
					<Tooltip title={contrastLabel}>
						<IconButton
							color={currentMode === 'contrast' ? 'primary' : 'default'}
							onClick={() => setEditorMode(currentMode !== 'contrast' ? 'contrast' : null)}
						>
							<ContrastIcon />
						</IconButton>
					</Tooltip>
				</>
			)}
		</Box>
	);
}

export default ActionsBar;
