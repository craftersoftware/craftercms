/*
 * Copyright (C) 2007-2023 Crafter Software Corporation. All Rights Reserved.
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

import { FilterSystemTypeGroups, LookupTable } from '../../models';
import SystemType from '../../models/SystemType';
import { FormattedMessage } from 'react-intl';
import { DropDownMenu } from '../DropDownMenuButton';
import React, { ReactElement, useMemo } from 'react';

export const filterOptionsLookup: LookupTable<{
	name: ReactElement;
	types: Array<SystemType>;
}> = {
	all: {
		name: <FormattedMessage defaultMessage="All" />,
		types: []
	},
	item: {
		name: <FormattedMessage defaultMessage="Items" />,
		types: ['page', 'component', 'levelDescriptor', 'taxonomy']
	},
	asset: {
		name: <FormattedMessage defaultMessage="Assets" />,
		types: ['asset']
	},
	contentType: {
		name: <FormattedMessage defaultMessage="Content Types" />,
		types: ['content type']
	},
	template: {
		name: <FormattedMessage defaultMessage="Templates" />,
		types: ['renderingTemplate']
	},
	script: {
		name: <FormattedMessage defaultMessage="Scripts" />,
		types: ['script']
	},
	other: {
		name: <FormattedMessage defaultMessage="Other" />,
		types: ['file', 'folder']
	}
};

export interface DashletFilterProps {
	selectedKeys: FilterSystemTypeGroups[];
	onChange: (e: Event, key: FilterSystemTypeGroups) => void;
}

export function DashletFilter(props: DashletFilterProps) {
	const { selectedKeys, onChange } = props;

	const options = useMemo(
		() =>
			Object.keys(filterOptionsLookup).map((key) => ({
				id: key,
				primaryText: filterOptionsLookup[key].name,
				selected: selectedKeys.includes(key as FilterSystemTypeGroups)
			})),
		[selectedKeys]
	);

	return (
		<DropDownMenu
			size="small"
			variant="text"
			onMenuItemClick={onChange}
			options={options}
			closeOnSelection={false}
			menuProps={{ sx: { minWidth: 180 } }}
		>
			{selectedKeys.includes('all') ? (
				<FormattedMessage defaultMessage="Show All" />
			) : (
				<FormattedMessage defaultMessage="Filters active: {count}" values={{ count: selectedKeys.length }} />
			)}
		</DropDownMenu>
	);
}

export default DashletFilter;
