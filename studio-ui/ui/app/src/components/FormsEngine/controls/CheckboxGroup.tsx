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

import React, { ChangeEvent, useMemo, useState } from 'react';
import { FormsEngineField } from '../components/FormsEngineField';
import { ControlProps } from '../types';
import Checkbox, { CheckboxProps } from '@mui/material/Checkbox';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel, { formControlLabelClasses } from '@mui/material/FormControlLabel';
import LookupTable from '../../../models/LookupTable';
import { useTheme } from '@mui/material/styles';
import { typographyClasses } from '@mui/material/Typography';
import { SearchBar } from '../../SearchBar';
import useDebouncedInput from '../../../hooks/useDebouncedInput';
import { List, type RowComponentProps } from 'react-window';
import Grid from '@mui/material/Grid';
import { FormattedMessage } from 'react-intl';
import { useWindowWidth } from '../../../hooks/useWindowWidth';
import { getPropertyValue, isFieldReadOnly } from '../lib/formUtils';
import Skeleton from '@mui/material/Skeleton';
import { useDataSourceListOptions } from '../dataSourceHooks/useDataSourceListOptions';
import type { DataSourceListItem } from '../dataSources/types';

export interface CheckboxGroupProps extends ControlProps {
	value: Array<{ key: string; value_smv: string }>;
}

export function CheckboxGroup(props: CheckboxGroupProps) {
	const theme = useTheme();
	const { field, value, setValue, autoFocus, readonly: formReadonly, dataSources } = props;
	const [searchFieldValue, setSearchFieldValue] = useState('');
	const [keyword, setKeyword] = useState('');
	const windowWidth = useWindowWidth();
	const numColumns = windowWidth >= 900 ? 2 : 1;

	// region field properties/validations
	const readonly: boolean = isFieldReadOnly(field, formReadonly);
	const selectAll: boolean = getPropertyValue(field.properties, 'selectAll') as boolean;
	const listDirection: 'horizontal' | 'vertical' = useMemo(() => {
		let listDirection: 'horizontal' | 'vertical' = 'horizontal';
		let directionArray: Array<{ value: string; selected?: boolean }>;
		try {
			const raw = getPropertyValue(field.properties, 'listDirection') as string;
			const parsed = raw ? JSON.parse(raw) : [];
			directionArray = Array.isArray(parsed) ? parsed : [];
		} catch {
			directionArray = [];
		}
		const verticalValue = Boolean(directionArray.find((item) => item.value === 'vertical')?.selected);
		if (verticalValue) listDirection = 'vertical';
		return listDirection;
	}, [field.properties]);
	// endregion

	const onKeyword$ = useDebouncedInput(() => {
		setKeyword(searchFieldValue);
	});
	// TB/legacy bind a single datasource (`datasource:item:singleSelection`). Use the first
	// list group only; extra groups would only appear from hand-edited multi-id XML.
	const options = useDataSourceListOptions(dataSources)?.[0]?.items;
	const finalOptions = useMemo(() => {
		if (!options) return undefined;
		let finalOptions = [...options];
		// If the list direction is vertical and there are two columns), we need to reorder the options to be top-down instead of left-right
		if (listDirection === 'vertical' && numColumns === 2) {
			// When there are two columns, we need to reorder the options to be top-down instead of left-right
			// So we need to take the first half and interleave it with the second half.
			const sortedOptions = [];
			const numRows = Math.ceil(finalOptions.length / 2);

			for (let i = 0; i < numRows; i++) {
				sortedOptions.push(finalOptions[i]);
				if (finalOptions[i + numRows]) {
					sortedOptions.push(finalOptions[i + Math.ceil(finalOptions.length / 2)]);
				}
			}
			finalOptions = sortedOptions;
		}
		if (!keyword.trim()) {
			return finalOptions;
		}
		const lowerKeyword = keyword.toLowerCase();
		return finalOptions?.filter((option) => {
			const label = typeof option.value === 'string' ? option.value.toLowerCase() : '';
			return label.includes(lowerKeyword) || option.key?.includes(lowerKeyword);
		});
	}, [options, keyword, listDirection, numColumns]);
	const checkedValuesLookup = useMemo(() => {
		return value.reduce((acc, item) => {
			acc[item.key] = true;
			return acc;
		}, {});
	}, [value]);
	const allInViewSelected = useMemo(() => {
		if (!finalOptions) return false;
		return finalOptions.every((option) => checkedValuesLookup[option.key]);
	}, [finalOptions, checkedValuesLookup]);
	const someInViewSelected = useMemo(() => {
		if (!finalOptions) return false;
		return finalOptions.some((option) => checkedValuesLookup[option.key]);
	}, [finalOptions, checkedValuesLookup]);

	if (!finalOptions) {
		return (
			<FormGroup>
				<Grid container spacing={2} sx={{ width: '100%' }}>
					{Array.from({ length: 2 }).map((_, i) => (
						<Grid size={{ sm: 12, md: 6 }} key={i}>
							<FormControlLabel control={<Checkbox disabled />} label={<Skeleton variant="text" width={120} />} />
						</Grid>
					))}
				</Grid>
			</FormGroup>
		);
	}
	const showFilter = options?.length > 2;
	const isVirtualized = finalOptions.length > 100;
	const virtualRows = Math.ceil(finalOptions.length / numColumns);
	const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
		const key = e.target.value;
		const checked = e.target.checked;
		if (checked) {
			setValue([...value, { key, value_smv: options.find((option) => option.key === key)?.value }]);
		} else {
			setValue(value.filter((item) => item.key !== key));
		}
	};

	const checkAll = () => {
		if (value.length === finalOptions.length) {
			setValue([]);
		} else {
			setValue(finalOptions.map((option) => ({ key: option.key, value_smv: option.value })));
		}
	};

	return (
		<FormsEngineField field={field} autoFocus={!showFilter && autoFocus}>
			{showFilter && (
				<SearchBar
					disabled={readonly}
					sx={{ mb: 1 }}
					autoFocus={autoFocus}
					showActionButton={searchFieldValue !== ''}
					keyword={searchFieldValue}
					onChange={(value) => {
						setSearchFieldValue(value);
						onKeyword$.next(value);
					}}
				/>
			)}
			{selectAll && (
				<FormControlLabel
					sx={{ mb: 1 }}
					control={
						<Checkbox
							disabled={readonly}
							color="info"
							indeterminate={someInViewSelected}
							checked={allInViewSelected}
							onChange={checkAll}
						/>
					}
					label={<FormattedMessage defaultMessage="Select All" />}
				/>
			)}
			<FormGroup
				sx={{
					p: 1,
					gap: 1,
					maxHeight: isVirtualized ? undefined : 350,
					overflow: 'auto',
					flexWrap: 'wrap',
					flexDirection: 'row',
					borderWidth: 1,
					borderRadius: 1,
					borderStyle: 'solid',
					borderColor: 'divider',
					[`.${formControlLabelClasses.root}`]: {
						height: isVirtualized ? '50px' : undefined,
						flexBasis: `calc(32.5% - ${theme.spacing(1)})`,
						[`.${typographyClasses.root}`]: {
							display: '-webkit-box',
							WebkitLineClamp: '2',
							WebkitBoxOrient: 'vertical',
							overflow: 'hidden',
							whiteSpace: 'normal'
						}
					},
					'.checkbox-group-virtual-list': {},
					'.checkbox-group-virtual-row': { display: 'flex' }
				}}
			>
				{isVirtualized ? (
					<List
						rowHeight={50}
						rowCount={virtualRows}
						rowComponent={VirtualRow}
						className="checkbox-group-virtual-list"
						rowProps={{ options: finalOptions, onChange: handleChange, checkedValuesLookup, numColumns, readonly }}
					/>
				) : (
					<Grid container spacing={2} sx={{ width: '100%' }}>
						{finalOptions?.map((option) => (
							<Grid size={{ sm: 12, md: 6 }} key={option.key}>
								{buildOption(option, handleChange, checkedValuesLookup, readonly)}
							</Grid>
						))}
					</Grid>
				)}
			</FormGroup>
		</FormsEngineField>
	);
}

const buildOption = (
	option: DataSourceListItem,
	onChange: CheckboxProps['onChange'],
	checkedValuesLookup: LookupTable<boolean>,
	readonly: boolean = false
) => (
	<FormControlLabel
		key={option.key}
		control={
			<Checkbox
				disabled={readonly}
				color="info"
				checked={checkedValuesLookup[option.key] ?? false}
				onChange={onChange}
				value={option.key}
			/>
		}
		label={option.value}
	/>
);

const VirtualRow = (
	props: RowComponentProps<{
		options: DataSourceListItem[];
		onChange: CheckboxProps['onChange'];
		checkedValuesLookup: LookupTable<boolean>;
		numColumns: number;
		readonly: boolean;
	}>
) => {
	const { index, style, options, onChange, checkedValuesLookup, numColumns, readonly } = props;
	const adjustedIndex = index * numColumns;
	return (
		<Grid container className="checkbox-group-virtual-row" spacing={2} sx={{ width: '100%' }} style={style}>
			{options.slice(adjustedIndex, adjustedIndex + numColumns).map((option) => (
				<Grid size={{ sm: 12, md: 6 }} key={option.key}>
					{buildOption(option, onChange, checkedValuesLookup, readonly)}
				</Grid>
			))}
		</Grid>
	);
};

export default CheckboxGroup;
