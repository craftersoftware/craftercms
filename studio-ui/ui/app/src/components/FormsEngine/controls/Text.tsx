/*
 * Copyright (C) 2007-2024 Crafter Software Corporation. All Rights Reserved.
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

import OutlinedInput, { OutlinedInputProps } from '@mui/material/OutlinedInput';
import React, { useId } from 'react';
import { FormsEngineField } from '../components/FormsEngineField';
import { ControlProps } from '../types';
import { getValidationValue, isFieldReadOnly } from '../lib/formUtils';

export type TextProps = ControlProps<string>;

export function Text(props: TextProps) {
	const { field, value, setValue, readonly: formReadonly, autoFocus } = props;
	const htmlId = useId();

	// region field properties/validations
	const maxLength: number | undefined = getValidationValue(field.validations, 'maxLength');
	const readonly: boolean = isFieldReadOnly(field, formReadonly);
	// endregion

	const handleChange: OutlinedInputProps['onChange'] = (e) => setValue(e.currentTarget.value);
	return (
		<FormsEngineField htmlFor={htmlId} field={field} max={maxLength} length={value.length}>
			<OutlinedInput
				autoFocus={autoFocus}
				id={htmlId}
				fullWidth
				inputProps={{ maxLength }}
				value={value}
				onChange={handleChange}
				disabled={readonly}
			/>
		</FormsEngineField>
	);
}

export default Text;
