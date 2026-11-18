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
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import { camelize } from '../../utils/string';
import React from 'react';
import { SORT_AUTO } from '../Search/utils';

export const filtersMessages = defineMessages({
	relevance: {
		id: 'words.relevance',
		defaultMessage: 'Relevance'
	},
	internalName: {
		id: 'searchFilter.internalName',
		defaultMessage: 'Name'
	},
	width: {
		id: 'words.width',
		defaultMessage: 'Width'
	},
	contentType: {
		id: 'searchFilter.contentType',
		defaultMessage: 'Content Type'
	},
	mimeType: {
		id: 'searchFilter.mimeType',
		defaultMessage: 'MIME Type'
	},
	size: {
		id: 'searchFilter.size',
		defaultMessage: 'Content Size'
	},
	lastEditDate: {
		id: 'searchFilter.lastEditDate',
		defaultMessage: 'Last Edit Date'
	},
	height: {
		id: 'words.height',
		defaultMessage: 'Height'
	}
});

interface SortByProps {
	sortBy?: string;
	filterKeys: string[];
	handleFilterChange(filter: FilterType, isFilter?: boolean): any;
}

export function SiteSearchSortBy(props: SortByProps) {
	const { formatMessage } = useIntl();
	const { handleFilterChange, filterKeys, sortBy = SORT_AUTO } = props;
	const sortByLabel = formatMessage({ id: 'searchFilter.sortBy', defaultMessage: 'Sort By' });

	return (
		<Select
			value={sortBy}
			sx={{
				width: '100%',
				'&.last': {
					marginTop: '10px'
				}
			}}
			onChange={(event) => handleFilterChange({ name: 'sortBy', value: event.target.value })}
			SelectDisplayProps={{
				'aria-label': sortByLabel,
				'aria-labelledby': undefined
			}}
			MenuProps={{
				slotProps: {
					list: {
						'aria-label': sortByLabel,
						'aria-labelledby': undefined
					}
				}
			}}
		>
			<MenuItem value={SORT_AUTO}>
				<FormattedMessage defaultMessage="Auto" />
			</MenuItem>
			<MenuItem value="_score">{formatMessage(filtersMessages.relevance)}</MenuItem>
			<MenuItem value="internalName">{formatMessage(filtersMessages.internalName)}</MenuItem>
			{filterKeys.map((name: string, i: number) => {
				const camelizedName = camelize(name);
				return (
					<MenuItem value={name} key={i}>
						{camelizedName in filtersMessages ? formatMessage(filtersMessages[camelizedName]) : name}
					</MenuItem>
				);
			})}
		</Select>
	);
}

export default SiteSearchSortBy;
