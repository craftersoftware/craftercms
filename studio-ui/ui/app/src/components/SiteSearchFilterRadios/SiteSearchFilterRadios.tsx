/*
 * Copyright (C) 2007-2022 Crafter Software Corporation. All Rights Reserved.
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

import { Facet } from '../../models/Search';
import { LookupTable } from '../../models/LookupTable';
import { defineMessages, useIntl, type MessageValue } from 'react-intl';
import { capitalize, formatBytes } from '../../utils/string';
import RadioGroup from '@mui/material/RadioGroup';
import { nnou } from '../../utils/object';
import FormControlLabel, { formControlLabelClasses } from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import React from 'react';

const messages = defineMessages<{
	under: { readonly unit: MessageValue; readonly value: MessageValue };
	above: { readonly unit: MessageValue; readonly value: MessageValue };
}>({
	under: {
		id: 'searchFilter.under',
		defaultMessage: 'Under {value}{unit}'
	},
	above: {
		id: 'searchFilter.above',
		defaultMessage: 'Above {value}{unit}'
	}
});

interface FilterRadiosProps {
	facetData: Facet;
	facet: string;
	checkedFilters: LookupTable;

	handleRadioClick(value: string, facet: string): any;
}

export function SiteSearchFilterRadios(props: FilterRadiosProps) {
	const { facetData, facet, handleRadioClick, checkedFilters } = props;
	const items = facetData.values;
	const { formatMessage } = useIntl();

	const formatValue = (facet: string, key: string, value: any) => {
		if (facetData.date) {
			return `${value.from}TODATE${value.to}ID${facet}${key}`;
		} else if (facetData.range) {
			return `${value.from !== null ? value.from : ''}TO${value.to !== null ? value.to : ''}`;
		} else {
			return key;
		}
	};

	const formatLabel = (facet: string, key: string, value: any) => {
		if (facet === 'size') {
			if (value.from === null) {
				return `${formatMessage(messages.under, { value: formatBytes(value.to), unit: '' })}`;
			} else if (value.to === null) {
				return `${formatMessage(messages.above, { value: formatBytes(value.from), unit: '' })}`;
			} else {
				return `${formatBytes(value.from)} - ${formatBytes(value.to)}`;
			}
		} else if (facet === 'width' || facet === 'height') {
			if (value.from === null) {
				return `${formatMessage(messages.under, { value: value.to, unit: 'px' })}`;
			} else if (value.to === null) {
				return `${formatMessage(messages.above, { value: value.from, unit: 'px' })}`;
			} else {
				return `${value.from}px - ${value.to}px`;
			}
		} else if (facet === 'last-edit-date') {
			return capitalize(key.replace(/-/g, ' '));
		}
		return key;
	};

	return (
		<RadioGroup>
			{Object.keys(items).map((key) => {
				let count = nnou(items[key].count) ? items[key].count : items[key];
				let label = formatLabel(facet, key, items[key]);
				let value = formatValue(facet, key, items[key]);
				return (
					<FormControlLabel
						key={key}
						name={key}
						onChange={(e: any) => handleRadioClick(e.target.value, facet)}
						control={
							<Radio checked={checkedFilters && checkedFilters[facet] === value} color="primary" value={value} />
						}
						label={`${label} (${count})`}
						labelPlacement="start"
						sx={{
							marginRight: '5px',
							[`& .${formControlLabelClasses.label}`]: {
								width: '100%',
								overflow: 'hidden',
								display: '-webkit-box',
								WebkitLineClamp: 1,
								WebkitBoxOrient: 'vertical'
							}
						}}
					/>
				);
			})}
		</RadioGroup>
	);
}

export default SiteSearchFilterRadios;
