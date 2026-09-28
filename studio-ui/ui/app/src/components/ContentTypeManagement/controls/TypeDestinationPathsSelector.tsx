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

import React, { ChangeEvent, useId } from 'react';
import FormsEngineField from '../../FormsEngine/components/FormsEngineField';
import Box from '@mui/material/Box';
import { FormattedMessage } from 'react-intl';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import Tooltip from '@mui/material/Tooltip';
import RemoveCircleOutlineRoundedIcon from '@mui/icons-material/RemoveCircleOutlineRounded';
import { TypeBuilderControl } from '../utils';
import Typography from '@mui/material/Typography';

export interface TypeDestinationPathsSelectorProps extends TypeBuilderControl {
	value: DestinationPaths;
}

type Destination = 'includes' | 'excludes';
interface DestinationPaths {
	includes: { pattern: string[] };
	excludes: { pattern: string[] };
}
/**
 * Allows users to specify "includes" and "excludes" destination paths for content types.
 */
export function TypeDestinationPathsSelector(props: TypeDestinationPathsSelectorProps) {
	const { field, setValue } = props;
	const value = props.value ?? { includes: { pattern: [] }, excludes: { pattern: [] } };
	const htmlId = useId();
	const maxLength = field.validations.maxLength?.value;
	const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, prop: Destination, index: number) => {
		const nextArr = [...(value[prop]?.pattern ?? [])];
		nextArr[index] = e.currentTarget.value;
		setValue({ ...value, [prop]: { pattern: nextArr } });
	};

	const addPath = (prop: Destination) => {
		setValue({ ...value, [prop]: { pattern: [...(value[prop]?.pattern ?? []), ''] } });
	};

	const removePath = (prop: Destination, index: number) => {
		const nextArr = (value[prop]?.pattern ?? []).filter((_, i) => i !== index);
		setValue({ ...value, [prop]: { pattern: nextArr } });
	};

	return (
		<FormsEngineField htmlFor={htmlId} field={field} max={maxLength}>
			{Object.entries(value).map(([key, value]) => (
				<Box key={key} sx={{ display: 'flex', flexDirection: 'column', rowGap: 2, mt: 2 }}>
					<Typography variant="subtitle2">
						{key === 'includes' ? (
							<FormattedMessage defaultMessage="Includes" />
						) : (
							<FormattedMessage defaultMessage="Excludes" />
						)}
					</Typography>
					{value?.pattern?.map((path, index) => (
						<Box key={index} sx={{ display: 'flex', gap: 2 }}>
							<TextField
								fullWidth
								label={<FormattedMessage defaultMessage="Pattern" />}
								value={path}
								variant="outlined"
								slotProps={{
									htmlInput: { maxLength }
								}}
								onChange={(e) => handleChange(e, key as Destination, index)}
							/>
							<Box
								sx={{
									display: 'flex',
									alignItems: 'center'
								}}
							>
								<Tooltip title={<FormattedMessage defaultMessage="Remove Option" />}>
									<IconButton onClick={() => removePath(key as Destination, index)}>
										<RemoveCircleOutlineRoundedIcon />
									</IconButton>
								</Tooltip>
							</Box>
						</Box>
					))}
					<Box
						sx={{
							display: 'flex',
							justifyContent: 'center'
						}}
					>
						<Tooltip title={<FormattedMessage defaultMessage="Add Path" />}>
							<IconButton onClick={() => addPath(key as Destination)}>
								<AddCircleOutlineRoundedIcon />
							</IconButton>
						</Tooltip>
					</Box>
				</Box>
			))}
		</FormsEngineField>
	);
}

export default TypeDestinationPathsSelector;
