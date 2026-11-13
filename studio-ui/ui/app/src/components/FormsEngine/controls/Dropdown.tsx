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

import React, { useId } from 'react';
import { FormsEngineField } from '../components/FormsEngineField';
import { fieldDescribedById, useFieldControlA11y } from '../lib/fieldA11y';
import { ControlProps } from '../types';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import ListSubheader from '@mui/material/ListSubheader';
import Skeleton from '@mui/material/Skeleton';
import { useDataSourceListOptions, type DataSourceListOptionGroup } from '../dataSourceHooks/useDataSourceListOptions';
import { getNumericValidationValue } from '../lib/formUtils';

export type DropdownProps = ControlProps<string>;

export function Dropdown(props: DropdownProps) {
	const { field, value, setValue, readonly, autoFocus, dataSources, inputId, labelId } = props;
	const maxLength = getNumericValidationValue(field.validations, 'maxLength');
	const handleChange = (event: SelectChangeEvent) => setValue(event.target.value);
	const optionGroups = useDataSourceListOptions(dataSources);
	const generatedId = useId();
	const controlId = inputId || generatedId;
	const a11y = useFieldControlA11y(field, fieldDescribedById(labelId, controlId));
	if (!optionGroups) {
		return (
			<FormsEngineField field={field} labelId={labelId} max={maxLength} length={value.length}>
				<Skeleton variant="rounded" height={56} />
			</FormsEngineField>
		);
	}
	const renderGroup = (group: DataSourceListOptionGroup) =>
		group.items.map((option, index) => (
			<MenuItem key={`${group.id}_${option.key}_${index}`} value={option.key}>
				{option.value}
			</MenuItem>
		));
	return (
		<FormsEngineField field={field} controlId={controlId} labelId={labelId} max={maxLength} length={value.length}>
			<Select
				value={value}
				label=""
				onChange={handleChange}
				disabled={readonly}
				autoFocus={autoFocus}
				aria-describedby={a11y['aria-describedby']}
			>
				{optionGroups.length === 0
					? null
					: optionGroups.length > 1
						? optionGroups.map((group) => [
								<ListSubheader key={group.id}>{group.label}</ListSubheader>,
								renderGroup(group)
							])
						: renderGroup(optionGroups[0])}
			</Select>
		</FormsEngineField>
	);
}

export default Dropdown;
