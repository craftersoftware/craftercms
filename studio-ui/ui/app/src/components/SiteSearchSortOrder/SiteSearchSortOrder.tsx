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

import { Filter as FilterType } from '../../models/Search';
import { defineMessages, useIntl } from 'react-intl';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import React from 'react';

const messages = defineMessages({
	asc: {
		id: 'searchFilter.asc',
		defaultMessage: 'Ascending'
	},
	desc: {
		id: 'searchFilter.desc',
		defaultMessage: 'Descending'
	},
	moreRelevantFirst: {
		id: 'searchFilter.byRelevanceDescMessage',
		defaultMessage: 'Most relevant first'
	},
	lessRelevantFirst: {
		id: 'searchFilter.byRelevanceAscMessage',
		defaultMessage: 'Less relevant first'
	},
	sortOrder: {
		id: 'searchFilter.sortOrder',
		defaultMessage: 'Sort order'
	}
});

interface SortOrderProps {
	sortBy?: string;
	sortOrder?: string;
	handleFilterChange(filter: FilterType, isFilter?: boolean): any;
}

export function SiteSearchSortOrder(props: SortOrderProps) {
	const { formatMessage } = useIntl();
	const { handleFilterChange, sortBy, sortOrder = 'desc' } = props;
	// sortBy === undefined: this means the current filter is the default === _score
	const isRelevance = sortBy === '_score' || sortBy === undefined;
	const options = isRelevance
		? [
				{
					name: formatMessage(messages.moreRelevantFirst),
					value: 'desc'
				},
				{
					name: formatMessage(messages.lessRelevantFirst),
					value: 'asc'
				}
			]
		: [
				{
					name: formatMessage(messages.asc),
					value: 'asc'
				},
				{
					name: formatMessage(messages.desc),
					value: 'desc'
				}
			];
	// No visible label of its own (the accordion title names Sort by). The open listbox is named only through labelId.
	const sortOrderLabel = formatMessage(messages.sortOrder);
	return (
		<Select
			value={sortOrder}
			inputProps={{ 'aria-label': sortOrderLabel }}
			MenuProps={{ slotProps: { list: { 'aria-label': sortOrderLabel } } }}
			sx={{
				width: '100%',
				marginTop: '10px'
			}}
			onChange={(event) => handleFilterChange({ name: 'sortOrder', value: event.target.value })}
		>
			<MenuItem value={options[0].value}>{options[0].name}</MenuItem>
			<MenuItem value={options[1].value}>{options[1].name}</MenuItem>
		</Select>
	);
}

export default SiteSearchSortOrder;
