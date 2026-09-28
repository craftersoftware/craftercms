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

import React, { useId, useState } from 'react';
import Box from '@mui/material/Box';
import FormsEngineField from '../../FormsEngine/components/FormsEngineField';
import TextField, { TextFieldProps } from '@mui/material/TextField';
import { FormattedMessage } from 'react-intl';
import IconButton from '@mui/material/IconButton';
import CompareArrowsOutlinedIcon from '@mui/icons-material/CompareArrowsOutlined';
import Tooltip from '@mui/material/Tooltip';
import { TypeBuilderControl } from '../utils';

export interface RangeProps extends TypeBuilderControl {
	value: {
		exact: string;
		min: string;
		max: string;
	};
}

/**
 * Enables selection of a range of values through two text fields.
 * It allows switching between a range and an exact value using a button.
 */
/* TODO: Rename or rethink control as it does more than only range. It may also be very specific to ImagePicker.
    We might want to do a show/hide of controls based on the value of another.
    When updating the control(s), also consider the retriever/serializer updates.
 */
export function Range(props: RangeProps) {
	const { value, field, setValue } = props;
	const htmlId = useId();
	const maxLength = field.validations.maxLength?.value;
	const minValue = value?.min ? (isNaN(parseInt(value.min)) ? 0 : parseInt(value.min)) : null;
	const maxValue = value?.max ? (isNaN(parseInt(value.max)) ? 0 : parseInt(value.max)) : null;
	const exactValue = value?.exact ? (isNaN(parseInt(value.exact)) ? 0 : parseInt(value.exact)) : null;
	// Parsed value is an object like `{ exact: '', min: '50', max: '100' }` or `{ exact: '50', min: '', max: '' }`.
	// So to determine if it's a range or exact value, we check if any of the values are set.
	const [isRange, setIsRange] = useState<boolean>((value?.min ?? '') !== '' || (value?.max ?? '') !== '');

	const handleChange: TextFieldProps['onChange'] = (event) => {
		if (isRange) {
			switch (event.currentTarget.name) {
				case 'min':
					setValue({ ...value, min: event.currentTarget.value, exact: '' });
					break;
				case 'max':
					setValue({ ...value, max: event.currentTarget.value, exact: '' });
					break;
			}
		} else {
			setValue({ exact: event.currentTarget.value, min: '', max: '' });
		}
	};
	const switchRange = () => {
		setValue({ ...value, min: '', max: '', exact: '' });
		setIsRange((prev) => !prev);
	};
	return (
		<FormsEngineField htmlFor={htmlId} field={field}>
			<Box sx={{ display: 'flex', mt: 1, gap: 2 }}>
				<Box
					sx={{
						display: 'flex',
						alignItems: 'center'
					}}
				>
					<Tooltip title={<FormattedMessage defaultMessage="Switch mode" />}>
						<IconButton onClick={switchRange}>
							<CompareArrowsOutlinedIcon />
						</IconButton>
					</Tooltip>
				</Box>
				{isRange ? (
					<>
						<TextField
							fullWidth
							id={htmlId}
							value={minValue ?? ''}
							label={<FormattedMessage defaultMessage="Min" />}
							variant="outlined"
							name="min"
							type="number"
							onChange={handleChange}
							slotProps={{ htmlInput: { maxLength } }}
						/>
						<TextField
							fullWidth
							value={maxValue ?? ''}
							label={<FormattedMessage defaultMessage="Max" />}
							variant="outlined"
							type="number"
							name="max"
							onChange={handleChange}
							slotProps={{ htmlInput: { maxLength } }}
						/>
					</>
				) : (
					<TextField
						fullWidth
						id={htmlId}
						value={exactValue ?? ''}
						label={<FormattedMessage defaultMessage="Exact" />}
						variant="outlined"
						name="exact"
						type="number"
						onChange={handleChange}
					/>
				)}
			</Box>
		</FormsEngineField>
	);
}

export default Range;
