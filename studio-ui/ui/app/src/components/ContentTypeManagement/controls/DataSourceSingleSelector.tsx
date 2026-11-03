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

import React, { useMemo } from 'react';
import FormsEngineField from '../../FormsEngine/components/FormsEngineField';
import FormControlLabel from '@mui/material/FormControlLabel';
import RadioGroup, { RadioGroupProps } from '@mui/material/RadioGroup';
import Radio from '@mui/material/Radio';
import { TypeBuilderControl } from '../utils';
import { EmptyState } from '../../EmptyState';

export type DataSourceSingleSelectorProps = TypeBuilderControl<string>;

/**
 * Allows the selection of a single data source compatible with the field type, using a radio group layout.
 */
export function DataSourceSingleSelector(props: DataSourceSingleSelectorProps) {
	const { field, value, setValue, contentType } = props;
	const type = field.validations.type?.value;
	const filteredDataSources = useMemo(() => {
		return (contentType.dataSources ?? []).filter((ds) => ds.interface === type);
	}, [contentType?.dataSources, type]);

	const handleChange: RadioGroupProps['onChange'] = (e) => setValue(e.currentTarget.value);
	return (
		<FormsEngineField field={field}>
			<RadioGroup value={value ?? ''} onChange={handleChange}>
				{filteredDataSources.length ? (
					filteredDataSources.map((ds) => (
						<FormControlLabel key={ds.id} value={ds.id} control={<Radio />} label={ds.title} />
					))
				) : (
					<EmptyState title="No Data Sources available" sxs={{ image: { display: 'none' } }} />
				)}
			</RadioGroup>
		</FormsEngineField>
	);
}

export default DataSourceSingleSelector;
