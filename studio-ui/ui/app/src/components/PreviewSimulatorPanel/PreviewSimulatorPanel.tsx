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

import { defineMessages, useIntl } from 'react-intl';
import React, { useEffect, useMemo, useReducer } from 'react';
import { getTranslation } from '../../utils/i18n';
import IconButton from '@mui/material/IconButton';
import { ScreenRotationRounded } from '@mui/icons-material';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import TextField from '@mui/material/TextField';
import { setHostSize } from '../../state/actions/preview';
import { useDispatch } from 'react-redux';
import { WidthAndHeight } from '../../models/WidthAndHeight';
import { useSelection } from '../../hooks/useSelection';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';

const SIMULATOR_PANEL_RESPONSIVE_MODE = 'previewSimulatorPanel.previewWindowSize';
const SIMULATOR_PANEL_CUSTOM_MODE = 'previewSimulatorPanel.custom';

const translations = defineMessages({
	simulatorPanel: {
		id: 'previewSimulatorPanel.title',
		defaultMessage: 'Device Simulator'
	},
	smartPhone: {
		id: 'words.phone',
		defaultMessage: 'Phone'
	},
	width: {
		id: 'words.width',
		defaultMessage: 'Width'
	},
	height: {
		id: 'words.height',
		defaultMessage: 'Height'
	},
	tablet: {
		id: 'words.tablet',
		defaultMessage: 'Tablet'
	},
	desktop: {
		id: 'words.desktop',
		defaultMessage: 'Desktop'
	},
	previewWindowSize: {
		id: 'previewSimulatorPanel.previewWindowSize',
		defaultMessage: 'Preview Window Size'
	},
	presets: {
		id: 'words.presets',
		defaultMessage: 'Presets'
	},
	custom: {
		id: 'words.custom',
		defaultMessage: 'Custom'
	}
});

const INITIAL_STATE = {
	width: '',
	height: '',
	preset: SIMULATOR_PANEL_RESPONSIVE_MODE
};

const reducer = (a: any, b: any) => ({ ...a, ...b });

export function PreviewSimulatorPanel(props: any) {
	const { formatMessage } = useIntl();
	const toolsPanelWidth = useSelection<number>((state) => state.preview.toolsPanelWidth);
	const maxWidth = window.innerWidth - toolsPanelWidth;

	const devices = useMemo(() => {
		let _devices = props.devices;
		if (_devices) {
			// TODO: Fix bad config crashes if not an array. Show error state?
			if (!Array.isArray(_devices)) {
				_devices = Array.from(_devices);
				console.error(`[SimulatorPanel] Expected devices to be array but instead got "${typeof _devices}"`);
			}
			return _devices.map((device) => ({
				...device,
				value: `${device.width}_${device.height}`
			}));
		}
		return [];
	}, [props.devices]);

	const [{ width, height, preset }, setState] = useReducer(reducer, INITIAL_STATE);
	const setWidth = (value) => setState({ width: value });
	const setHeight = (value) => setState({ height: value });

	const handlePresetChange = (e: any) => {
		const value = e.target.value;
		if (value === SIMULATOR_PANEL_RESPONSIVE_MODE) {
			dispatch(
				setHostSize({
					width: null,
					height: null
				})
			);
		} else {
			const device = devices.find((dev) => dev.value === value);
			device &&
				dispatch(
					setHostSize({
						width: device.width > maxWidth ? maxWidth : device.width,
						height: device.height
					})
				);
		}
	};

	const dispatch = useDispatch();
	const hostSize = useSelection<WidthAndHeight>((state) => state.preview.hostSize);
	const onDimensionKeyUp = (e: any) => {
		if (e.key === 'Enter') {
			let widthToSet, heightToSet;

			if (!width) {
				widthToSet = null;
			} else if (!isNaN(width as any)) {
				widthToSet = parseInt(width);
			} else {
				widthToSet = hostSize.width;
			}

			if (!height) {
				heightToSet = null;
			} else if (!isNaN(height as any)) {
				heightToSet = parseInt(height);
			} else {
				heightToSet = hostSize.height;
			}

			dispatch(
				setHostSize({
					width: widthToSet > maxWidth ? maxWidth : widthToSet,
					height: heightToSet
				})
			);
		}
	};

	useEffect(() => {
		const nextState: any = {};
		if (hostSize.width != null) {
			nextState.width = `${hostSize.width}`;
		} else {
			nextState.width = '';
		}
		if (hostSize.height != null) {
			nextState.height = `${hostSize.height}`;
		} else {
			nextState.height = '';
		}
		if (hostSize.width != null || hostSize.height != null) {
			const matchingPreset = devices.find(
				(device) =>
					// @ts-ignore
					// eslint-disable-next-line
					device.width == hostSize.width && device.height == hostSize.height
			);
			nextState.preset = matchingPreset ? matchingPreset.value : SIMULATOR_PANEL_CUSTOM_MODE;
		} else {
			nextState.preset = SIMULATOR_PANEL_RESPONSIVE_MODE;
		}
		setState(nextState);
	}, [hostSize, props.config, devices]);

	const onFlipDimensions = () => {
		const nextWidth = parseInt(height);
		const nextHeight = parseInt(width);
		dispatch(
			setHostSize({
				width: nextWidth > maxWidth ? maxWidth : nextWidth,
				height: nextHeight
			})
		);
	};

	const PRESETS = formatMessage(translations.presets);

	return (
		<section>
			<Box
				component="section"
				sx={{
					display: 'flex',
					padding: '15px',
					alignItems: 'flex-end',
					'& > div:first-child': {
						marginRight: '10px'
					}
				}}
			>
				<TextField
					label={formatMessage(translations.width)}
					name="width"
					type="number"
					onKeyUp={onDimensionKeyUp}
					onChange={(e) => setWidth(e.target.value)}
					value={width}
				/>
				<TextField
					label={formatMessage(translations.height)}
					type="number"
					name="height"
					onKeyUp={onDimensionKeyUp}
					onChange={(e) => setHeight(e.target.value)}
					value={height}
				/>
				<Tooltip title={formatMessage({ defaultMessage: 'Rotate screen' })}>
					<IconButton
						onClick={onFlipDimensions}
						edge="end"
						size="large"
						aria-label={formatMessage({ defaultMessage: 'Rotate screen' })}
					>
						<ScreenRotationRounded />
					</IconButton>
				</Tooltip>
			</Box>
			<Divider />
			<FormControl
				sx={{
					padding: '15px',
					width: '100%'
				}}
			>
				<FormLabel focused={false} sx={{ marginBottom: '10px' }}>
					{PRESETS}
				</FormLabel>
				<RadioGroup value={preset} onChange={handlePresetChange} aria-label={PRESETS} name="words.device">
					<FormControlLabel
						value={SIMULATOR_PANEL_CUSTOM_MODE}
						control={<Radio />}
						label={formatMessage(translations.custom)}
						disabled={true}
					/>
					<FormControlLabel
						value={SIMULATOR_PANEL_RESPONSIVE_MODE}
						control={<Radio />}
						label={formatMessage(translations.previewWindowSize)}
					/>
					{devices.map((device) => (
						<FormControlLabel
							key={device.value}
							value={device.value}
							control={<Radio />}
							label={getTranslation(device.title, translations, formatMessage)}
						/>
					))}
				</RadioGroup>
			</FormControl>
		</section>
	);
}

export default PreviewSimulatorPanel;
