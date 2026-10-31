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

import React, { useMemo, useState } from 'react';
import FormsEngineField from '../../FormsEngine/components/FormsEngineField';
import useContentTypes from '../../../hooks/useContentTypes';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemButton from '@mui/material/ListItemButton';
import CheckBoxRoundedIcon from '@mui/icons-material/CheckBoxRounded';
import CheckBoxOutlineBlankRoundedIcon from '@mui/icons-material/CheckBoxOutlineBlankRounded';
import { TypeBuilderControl } from '../utils';
import { asArray, createPresenceTable } from '../../../utils/array';
import { EmptyState } from '../../EmptyState';
import { FormattedMessage } from 'react-intl';
import { reversePluckProps } from '../../../utils/object';
import { SearchBar, type SearchBarProps } from '../../SearchBar';
import { getPropertyValue } from '../../FormsEngine/lib/formUtils';

export type ContentTypesSelectorProps = TypeBuilderControl<string[] | '*'>;

/**
 * Enables the selection of multiple content types using a checkbox group layout.
 */
export function ContentTypesSelector(props: ContentTypesSelectorProps) {
	const { field, value, setValue } = props;
	const maxLength = field.validations?.maxLength?.value;
	const type = getPropertyValue(field.properties, 'type', 'component') as string;
	const contentTypes = useContentTypes();
	const [selectedLookup, setSelectedLookup] = useState<Record<string, boolean>>(createPresenceTable(asArray(value)));
	const [searchTerm, setSearchTerm] = useState('');
	const components = useMemo(
		() =>
			Object.values(contentTypes).filter((contentType) => {
				return (
					contentType.type === type &&
					(contentType.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
						contentType.name.toLowerCase().includes(searchTerm.toLowerCase()))
				);
			}),
		[contentTypes, searchTerm, type]
	);

	const handleToggle = (selectionValue: string) => () => {
		let newSelectedLookup = {};
		// We use '*' meaning that all components are selected
		if (selectionValue === '*') {
			const isSelected = value === '*';
			if (!isSelected) {
				newSelectedLookup[selectionValue] = true;
			}
		} else {
			const isSelected = selectedLookup[selectionValue];
			// ensure that when selecting individual content types, '*' won't be in the selectedLookup
			newSelectedLookup = { ...reversePluckProps(selectedLookup, '*'), [selectionValue]: !isSelected };
		}
		setSelectedLookup(newSelectedLookup);
		const selectedArray = Object.entries(newSelectedLookup)
			.filter(([, value]) => value)
			.map(([key]) => key);
		setValue(selectedArray);
	};

	const handleSearchChange: SearchBarProps['onChange'] = (value) => {
		setSearchTerm(value);
	};

	return (
		<FormsEngineField field={field} max={maxLength}>
			<SearchBar keyword={searchTerm} onChange={handleSearchChange} autoFocus={true} />
			<List>
				{components.length === 0 ? (
					<EmptyState title={<FormattedMessage defaultMessage="No content types available" />} />
				) : (
					<>
						<ListItem sx={{ bgcolor: 'background.paper', p: 0 }}>
							<ListItemButton
								role="checkbox"
								aria-checked={Boolean(selectedLookup['*'])}
								onClick={handleToggle('*')}
								dense
							>
								<ListItemIcon sx={{ py: 1 }}>
									{selectedLookup['*'] ? <CheckBoxRoundedIcon color="primary" /> : <CheckBoxOutlineBlankRoundedIcon />}
								</ListItemIcon>
								<ListItemText
									primary={
										type === 'page' ? (
											<FormattedMessage defaultMessage="Allow any page" />
										) : (
											<FormattedMessage defaultMessage="Allow any component" />
										)
									}
								/>
							</ListItemButton>
						</ListItem>
						{components.map((contentType) => (
							<ListItem key={contentType.id} sx={{ bgcolor: 'background.paper', p: 0 }}>
								<ListItemButton onClick={handleToggle(contentType.id)} dense disabled={value === '*'}>
									<ListItemIcon sx={{ py: 1 }}>
										{selectedLookup[contentType.id] ? (
											<CheckBoxRoundedIcon color="primary" />
										) : (
											<CheckBoxOutlineBlankRoundedIcon />
										)}
									</ListItemIcon>
									<ListItemText primary={contentType.name} />
								</ListItemButton>
							</ListItem>
						))}
					</>
				)}
			</List>
		</FormsEngineField>
	);
}

export default ContentTypesSelector;
