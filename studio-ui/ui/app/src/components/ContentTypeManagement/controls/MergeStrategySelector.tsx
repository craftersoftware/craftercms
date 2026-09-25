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
import FormsEngineField from '../../FormsEngine/components/FormsEngineField';
import TextField from '@mui/material/TextField';
import Autocomplete, { AutocompleteProps } from '@mui/material/Autocomplete';
import { TypeBuilderControl } from '../utils';

export interface MergeStrategySelectorProps extends TypeBuilderControl {
	value: string;
}

const mergeStrategies = ['inherit-levels'];

/**
 * Enables selection of merge strategies through an autocomplete input.
 */
export function MergeStrategySelector(props: MergeStrategySelectorProps) {
	const { field, value, setValue, readonly, autoFocus } = props;
	const htmlId = useId();
	const maxLength = field.validations.maxLength?.value;
	const handleChange: AutocompleteProps<string, false, true, true>['onInputChange'] = (event, value) => setValue(value);

	return (
		<FormsEngineField htmlFor={htmlId} field={field} max={maxLength} length={value.length}>
			<Autocomplete
				freeSolo
				options={mergeStrategies}
				onInputChange={handleChange}
				value={value}
				readOnly={readonly}
				autoFocus={autoFocus}
				renderInput={(params) => {
					return (
						<TextField
							{...params}
							slotProps={{
								htmlInput: { ...params.slotProps?.htmlInput, maxLength, id: htmlId }
							}}
						/>
					);
				}}
			/>
		</FormsEngineField>
	);
}

export default MergeStrategySelector;
