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

import { ComponentProps, forwardRef, useId } from 'react';
import OutlinedInput, { OutlinedInputProps } from '@mui/material/OutlinedInput';
import { FormsEngineField } from '../components/FormsEngineField';
import type { ControlProps } from '../types';
import AddRounded from '@mui/icons-material/AddRounded';
import Box, { BoxProps } from '@mui/material/Box';
import Button from '@mui/material/Button';
import MinusRounded from '@mui/icons-material/RemoveRounded';
import { NumberField } from '@base-ui-components/react/number-field';
import { getValidationValue, isFieldReadOnly } from '../lib/formUtils';

type NumberFieldRootProps = ComponentProps<typeof NumberField.Root>;

export interface NumberProps extends ControlProps {
	value: number | null;
}

const decrementButtonSx: BoxProps['sx'] = {
	borderTopRightRadius: 0,
	borderBottomRightRadius: 0,
	boxShadow: 'none',
	borderRight: 'none'
};

const incrementButtonSx: BoxProps['sx'] = {
	borderTopLeftRadius: 0,
	borderBottomLeftRadius: 0,
	boxShadow: 'none',
	borderLeft: 'none'
};

// MUI OutlinedInput's ref points to the wrapper elements, not to the input. BaseUI needs the input directly.
const OutlinedInputWithRef = forwardRef<HTMLInputElement, OutlinedInputProps>((props, ref) => {
	const { sx, ...other } = props;
	return (
		<OutlinedInput
			{...other}
			fullWidth
			inputRef={ref}
			sx={{ borderRadius: 0, py: '0px', input: { textAlign: 'center' }, ...sx }}
		/>
	);
});

export function Numeric(props: NumberProps) {
	const { field, value, setValue, readonly: formReadonly, autoFocus } = props;
	const htmlId = useId();

	// region field properties/validations
	const maxLength: number | undefined = getValidationValue(field.validations, 'maxLength');
	const maxValue: number | undefined = getValidationValue(field.validations, 'maxValue');
	const minValue: number | undefined = getValidationValue(field.validations, 'minValue');
	const readonly: boolean = isFieldReadOnly(field, formReadonly);
	// endregion

	const handleChange: NumberFieldRootProps['onValueChange'] = (newValue) => setValue(newValue);
	return (
		<FormsEngineField htmlFor={htmlId} field={field} max={maxLength}>
			<NumberField.Root
				id={htmlId}
				value={value}
				onValueChange={handleChange}
				readOnly={readonly}
				autoFocus={autoFocus}
				min={minValue}
				max={maxValue}
			>
				<NumberField.Group
					render={
						<Box
							sx={{
								display: 'flex'
							}}
						/>
					}
				>
					<NumberField.Decrement render={<Button variant="outlined" sx={decrementButtonSx} />}>
						<MinusRounded />
					</NumberField.Decrement>
					<NumberField.Input render={<OutlinedInputWithRef />} />
					<NumberField.Increment render={<Button variant="outlined" sx={incrementButtonSx} />}>
						<AddRounded />
					</NumberField.Increment>
				</NumberField.Group>
			</NumberField.Root>
		</FormsEngineField>
	);
}

export default Numeric;
