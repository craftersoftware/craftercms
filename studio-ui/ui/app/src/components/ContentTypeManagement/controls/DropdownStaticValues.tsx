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

import React, { useId } from 'react';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormsEngineField from '../../FormsEngine/components/FormsEngineField';
import { TypeBuilderControl } from '../utils';

interface DropdownStaticValue {
	value: string;
	label: string;
	selected: boolean;
}

export type DropdownStaticValuesProps = TypeBuilderControl<DropdownStaticValue[]>;

/**
 * Enables the selection of a key/value pair from a predefined list of options.
 */
export function DropdownStaticValues(props: DropdownStaticValuesProps) {
	const { field, value: options, setValue, readonly, autoFocus } = props;
	const htmlId = useId();
	const selectedOption = options.find((option) => option.selected);

	const handleChange = (event: SelectChangeEvent) => {
		const selectedValue = event.target.value;
		const newOptions = options.map((option) => ({
			...option,
			selected: option.value === selectedValue
		}));

		setValue(newOptions);
	};
	return (
		<FormsEngineField field={field} labelId={htmlId}>
			<Select
				value={selectedOption?.value ?? ''}
				labelId={htmlId}
				onChange={handleChange}
				disabled={readonly}
				autoFocus={autoFocus}
			>
				{options.map((option) => (
					<MenuItem key={option.value} value={option.value}>
						{option.label}
					</MenuItem>
				))}
			</Select>
		</FormsEngineField>
	);
}

export default DropdownStaticValues;
