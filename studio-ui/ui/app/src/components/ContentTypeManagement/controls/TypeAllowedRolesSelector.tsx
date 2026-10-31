/*
 * Copyright (C) 2007-2026 Crafter Software Corporation. All Rights Reserved.
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
import Box from '@mui/material/Box';
import { defineMessages } from 'react-intl';
import { TypeBuilderControl } from '../utils';
import { StringListEditor } from './StringListEditor';

const messages = defineMessages({
	role: { id: 'typeAllowedRoles.role', defaultMessage: 'Role {index}' },
	add: { id: 'typeAllowedRoles.add', defaultMessage: 'Add Role' },
	remove: { id: 'typeAllowedRoles.remove', defaultMessage: 'Remove Role {index}' }
});

export interface TypeAllowedRolesSelectorProps extends TypeBuilderControl {
	value: string[];
}

/**
 * Free-text roles for the content type. The list UI is {@link StringListEditor}.
 */
export function TypeAllowedRolesSelector(props: TypeAllowedRolesSelectorProps) {
	const { field, setValue } = props;
	const value = Array.isArray(props.value) ? props.value : [];
	const htmlId = useId();
	const maxLength = field.validations.maxLength?.value;
	return (
		<FormsEngineField labelId={htmlId} field={field} max={maxLength}>
			<Box role="group" aria-labelledby={htmlId} sx={{ display: 'flex', flexDirection: 'column', rowGap: 2, mt: 2 }}>
				<StringListEditor
					values={value}
					onChange={setValue}
					maxLength={maxLength}
					itemLabel={messages.role}
					addLabel={messages.add}
					removeLabel={messages.remove}
				/>
			</Box>
		</FormsEngineField>
	);
}

export default TypeAllowedRolesSelector;
