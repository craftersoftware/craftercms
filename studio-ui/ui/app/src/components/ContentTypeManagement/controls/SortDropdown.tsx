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

import { TypeBuilderControl } from '../utils';
import FormsEngineField from '../../FormsEngine/components/FormsEngineField';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import { useId } from 'react';
import { defineMessage, useIntl } from 'react-intl';
import MenuItem from '@mui/material/MenuItem';
import { getPropertyValue } from '../../FormsEngine/lib/formUtils';

const sortByOptions = [
	{
		key: '-AUTO-',
		value: defineMessage({ defaultMessage: 'Auto' })
	},
	{
		key: '_score',
		value: defineMessage({ defaultMessage: 'Relevance' })
	},
	{
		key: 'internalName',
		value: defineMessage({ defaultMessage: 'Name' })
	}
];
const sortOrderOptions = [
	{
		key: '',
		value: defineMessage({ defaultMessage: 'None' })
	},
	{
		key: 'asc',
		value: defineMessage({ defaultMessage: 'Ascending' })
	},
	{
		key: 'desc',
		value: defineMessage({ defaultMessage: 'Descending' })
	}
];

export type SortDropdownProps = TypeBuilderControl<string | undefined>;

export function SortDropdown(props: SortDropdownProps) {
	const { field, value, setValue, readonly, autoFocus } = props;
	const htmlId = useId();
	const { formatMessage } = useIntl();
	const type = getPropertyValue(field.properties, 'type', 'sortBy');
	const options = type === 'sortBy' ? sortByOptions : sortOrderOptions;

	const handleChange = (event: SelectChangeEvent) => {
		setValue(event.target.value || undefined);
	};

	return (
		<FormsEngineField field={field} labelId={htmlId}>
			<Select value={value ?? ''} labelId={htmlId} onChange={handleChange} disabled={readonly} autoFocus={autoFocus}>
				{options.map((option) => (
					<MenuItem key={option.key} value={option.key}>
						{formatMessage(option.value)}
					</MenuItem>
				))}
			</Select>
		</FormsEngineField>
	);
}

export default SortDropdown;
