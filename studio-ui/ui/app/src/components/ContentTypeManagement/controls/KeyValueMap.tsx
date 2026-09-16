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
import RemoveCircleOutlineRoundedIcon from '@mui/icons-material/RemoveCircleOutlineRounded';
import Tooltip from '@mui/material/Tooltip';
import { TypeBuilderControl } from '../utils';

export interface KeyValueMapProps extends TypeBuilderControl {
	value: {
		key: string;
		value: string;
	}[];
}
/**
 * Displays a list of key/value pairs, allowing the user to add, remove, and edit them.
 */
export function KeyValueMap(props: KeyValueMapProps) {
	const { value: options, field, setValue } = props;
	const htmlId = useId();
	const maxLength = field.validations.maxLength?.value;

	const handleChange = (
		e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
		prop: 'key' | 'value',
		index: number
	) => {
		const newOptions = options.map((option, i) =>
			i === index ? { ...option, [prop]: e.currentTarget.value } : option
		);
		setValue(newOptions);
	};

	const addOption = (index: number) => {
		const newOptions = [...options.slice(0, index + 1), { key: '', value: '' }, ...options.slice(index + 1)];
		setValue(newOptions);
	};

	const removeOption = (index: number) => {
		const newOptions = options.filter((option, i) => i !== index);
		setValue(newOptions);
	};

	return (
        <FormsEngineField htmlFor={htmlId} field={field} sx={{ mt: 2 }}>
            {options.map((option, index) => (
				<Box key={index} sx={{ display: 'flex', gap: 2, mt: 2 }}>
					<TextField
						fullWidth
						label={<FormattedMessage defaultMessage="Key" />}
						value={option.key}
						variant="outlined"
						name="key"
						id={index === 0 ? htmlId : undefined}
						slotProps={{
							htmlInput: { maxLength }
						}}
						onChange={(e) => handleChange(e, 'key', index)}
					/>
					<TextField
						fullWidth
						label={<FormattedMessage defaultMessage="Value" />}
						value={option.value}
						variant="outlined"
						name="value"
						slotProps={{
							htmlInput: { maxLength }
						}}
						onChange={(e) => handleChange(e, 'value', index)}
					/>
					<Box
                        sx={{
                            display: "flex",
                            alignItems: "center"
                        }}>
						<Tooltip title={<FormattedMessage defaultMessage="Add Option" />}>
							<IconButton onClick={() => addOption(index)}>
								<AddCircleOutlineRoundedIcon />
							</IconButton>
						</Tooltip>
						<Tooltip title={<FormattedMessage defaultMessage="Remove Option" />}>
							<IconButton onClick={() => removeOption(index)}>
								<RemoveCircleOutlineRoundedIcon />
							</IconButton>
						</Tooltip>
					</Box>
				</Box>
			))}
            {options.length === 0 && (
				<Box
                    sx={{
                        display: "flex",
                        justifyContent: "center"
                    }}>
					<Tooltip title={<FormattedMessage defaultMessage="Add Option" />}>
						<IconButton onClick={() => addOption(0)}>
							<AddCircleOutlineRoundedIcon />
						</IconButton>
					</Tooltip>
				</Box>
			)}
        </FormsEngineField>
    );
}

export default KeyValueMap;
