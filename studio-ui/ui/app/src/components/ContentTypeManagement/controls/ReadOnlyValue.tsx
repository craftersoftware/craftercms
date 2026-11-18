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

import OutlinedInput from '@mui/material/OutlinedInput';
import React, { useId } from 'react';
import FormsEngineField from '../../FormsEngine/components/FormsEngineField';
import { TypeBuilderControl } from '../utils';

export type ReadOnlyValueProps = TypeBuilderControl<string>;

/**
 * Displays a read-only value in an input field.
 */
export function ReadOnlyValue(props: ReadOnlyValueProps) {
	const { field, value, autoFocus } = props;
	const htmlId = useId();
	const maxLength = field.validations.maxLength?.value;
	return (
		<FormsEngineField htmlFor={htmlId} field={field} max={maxLength} length={value.length}>
			<OutlinedInput autoFocus={autoFocus} id={htmlId} fullWidth inputProps={{ maxLength }} value={value} disabled />
		</FormsEngineField>
	);
}

export default ReadOnlyValue;
