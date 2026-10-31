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

import OutlinedInput, { OutlinedInputProps } from '@mui/material/OutlinedInput';
import React, { useEffect, useId, useRef, useState } from 'react';
import FormsEngineField from '../../FormsEngine/components/FormsEngineField';
import { ControlProps } from '../../FormsEngine/types';
import controlDescriptors from '../descriptors/controls';
import Tooltip from '@mui/material/Tooltip';
import { FormattedMessage, useIntl } from 'react-intl';
import AddCircleOutlineOutlinedIcon from '@mui/icons-material/AddCircleOutlineOutlined';
import { DropDownMenu } from '../../DropDownMenuButton';
import { suffixesMap, SuffixesType } from '../suffixesMap';
import { useStableFormContext } from '../../FormsEngine/lib/formsEngineContext';
import { useAtomValue } from 'jotai';
import useUpdateRefs from '../../../hooks/useUpdateRefs';
import { isFieldReadOnly } from '../../FormsEngine/lib/formUtils';

export type VariableProps = ControlProps<string>;

const disabledFields = ['internal-name', 'file-name'];
const disableSuffixes = ['internal-name', 'file-name', 'disabled'];

export function Variable(props: VariableProps) {
	const { field, value, setValue, readonly, autoFocus, contentType } = props;
	const [allowAutoValue, setAllowAutoValue] = useState<boolean>(!value);
	const htmlId = useId();
	const maxLength = field.validations.maxLength?.value;
	const controlDescriptor = contentType?.id && controlDescriptors[contentType?.id];
	const supportedSuffixes: SuffixesType[] = controlDescriptor?.metadata?.suffixes;
	const { formatMessage } = useIntl();
	const disabled = isFieldReadOnly(field, readonly) || disabledFields.includes(value);
	const showSuffixes = supportedSuffixes && !disableSuffixes.includes(value);
	const effectRefs = useUpdateRefs({
		value,
		setValue,
		supportedSuffixes,
		allowAutoValue,
		disabled
	});
	const {
		atoms: { valueByFieldId }
	} = useStableFormContext();
	const title = (useAtomValue(valueByFieldId['title']) as string) || '';
	const inputRef = useRef<HTMLInputElement>(null); // ref for the input

	useEffect(() => {
		const { setValue, supportedSuffixes, allowAutoValue, disabled } = effectRefs.current;
		// If allowAutoValue is true and the field is not disabled, set the value from the title.
		if (allowAutoValue && !disabled && title) {
			setValue(getValueFromTitle(title, supportedSuffixes));
		}
	}, [title, effectRefs]);

	const handleChange: OutlinedInputProps['onChange'] = (e) => {
		const newValue = cleanVariable(e.currentTarget.value);
		// If when manually updating the variable, the value is empty, allow auto value to be set again.
		setAllowAutoValue(newValue === '');
		setValue(newValue);
	};

	const onAddSuffix = (suffix: string) => {
		setValue(getValueWithSuffix(value, suffix, supportedSuffixes));
		setTimeout(() => {
			inputRef.current?.focus(); // Focus the input after updating the value
			const length = inputRef.current.value.length; // Get the length of the input value
			inputRef.current.setSelectionRange(length, length); // Set the cursor at the end
		});
	};

	return (
		<FormsEngineField htmlFor={htmlId} field={field} max={maxLength} length={value?.length}>
			<OutlinedInput
				autoFocus={autoFocus}
				id={htmlId}
				fullWidth
				inputProps={{ maxLength }}
				value={value}
				onChange={handleChange}
				disabled={disabled}
				inputRef={inputRef}
				endAdornment={
					showSuffixes && (
						<Tooltip title={<FormattedMessage defaultMessage="Add/update suffix" />}>
							<DropDownMenu
								onMenuItemClick={(event, optionId) => onAddSuffix(optionId)}
								options={supportedSuffixes.map((suffix) => {
									const translation = formatMessage(suffixesMap[suffix]);
									return {
										id: suffix,
										primaryText: suffix,
										secondaryText: translation
									};
								})}
								endIcon={null}
								sx={{
									color: (theme) =>
										theme.palette.mode === 'dark' ? theme.palette.text.primary : theme.palette.text.secondary,
									minWidth: 'unset',
									borderRadius: '50%',
									p: 1,
									'&:hover': {
										backgroundColor: (theme) => theme.palette.action.hover
									}
								}}
								menuProps={{
									anchorOrigin: {
										vertical: 'bottom',
										horizontal: 'right'
									},
									transformOrigin: {
										vertical: 'top',
										horizontal: 'right'
									}
								}}
							>
								<AddCircleOutlineOutlinedIcon />
							</DropDownMenu>
						</Tooltip>
					)
				}
			/>
		</FormsEngineField>
	);
}

const cleanVariable = (value) => {
	let sanitized = value.replace(/-/g, '_').replace(/[^A-Za-z0-9_]/g, '');
	// Ensure the first character is a letter or underscore
	if (sanitized !== '' && !/^[_A-Za-z]/.test(sanitized)) {
		sanitized = `_${sanitized}`;
	}
	return sanitized;
};

const getValueWithSuffix = (value: string, suffix: string, supportedSuffixes: SuffixesType[]): string => {
	const currentSuffix = value.match(/_[a-z]+$/)?.[0];
	const isSuffix = currentSuffix && supportedSuffixes?.includes(currentSuffix as SuffixesType);
	return isSuffix ? value.replace(/_[a-z]+$/, `${suffix}`) : `${value}${suffix}`;
};

const getValueFromTitle = (title: string, supportedSuffixes: SuffixesType[]): string => {
	let newValue = cleanVariable(title);
	// Lowercase the first letter
	newValue = newValue.charAt(0).toLowerCase() + newValue.slice(1);
	// If there are supported suffixes and the value is not in the disableSuffixes list, add the first one.
	if (supportedSuffixes?.length && !disableSuffixes.includes(newValue)) {
		newValue = getValueWithSuffix(newValue, supportedSuffixes[0], supportedSuffixes);
	}
	return newValue;
};

export default Variable;
