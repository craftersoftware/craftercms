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

import React, { ChangeEvent, useId } from 'react';
import { FormsEngineField } from '../components/FormsEngineField';
import { ControlProps } from '../types';
import Switch from '@mui/material/Switch';
import { isFieldReadOnly } from '../lib/formUtils';

export type CheckboxProps = ControlProps<boolean>;

export function Checkbox(props: CheckboxProps) {
	const { field, value, setValue, readonly: formReadonly, autoFocus } = props;

	//  region field properties/validations
	const readonly = isFieldReadOnly(field, formReadonly);
	// endregion

	const htmlId = useId();
	const handleChange = (e: ChangeEvent<HTMLInputElement>) => setValue(e.target.checked);
	return (
		<FormsEngineField htmlFor={htmlId} field={field}>
			<Switch checked={value} onChange={handleChange} disabled={readonly} autoFocus={autoFocus} />
		</FormsEngineField>
	);
}

export default Checkbox;
