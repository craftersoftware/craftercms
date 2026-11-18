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

import React, { forwardRef } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import Select, { SelectProps } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import SystemType from '../../models/SystemType';
import useArchetypesList from '../../hooks/useArchetypesList';
import { getPossibleTranslation } from '../../utils/i18n';

export type ContentTypesFilterProps = SelectProps;

export type ObjectTypeOption = 'all' | Extract<SystemType, 'page' | 'component'>;

export const ContentTypesFilter = forwardRef<HTMLDivElement, ContentTypesFilterProps>((props, ref) => {
	const { formatMessage } = useIntl();
	const archetypes = useArchetypesList();
	const contentTypeLabel = formatMessage({ id: 'searchFilter.contentType', defaultMessage: 'Content Type' });
	const { MenuProps, SelectDisplayProps, ...rest } = props;
	const callerList = MenuProps?.slotProps?.list;
	return (
		<Select
			{...rest}
			ref={ref}
			SelectDisplayProps={{
				...SelectDisplayProps,
				'aria-label': contentTypeLabel,
				'aria-labelledby': undefined
			}}
			MenuProps={{
				...MenuProps,
				slotProps: {
					...MenuProps?.slotProps,
					// MUI calls a function list slot with ownerState. Resolve it, then keep the name on top.
					list: (ownerState) => ({
						...(typeof callerList === 'function' ? callerList(ownerState) : callerList),
						'aria-label': contentTypeLabel,
						'aria-labelledby': undefined
					})
				}
			}}
		>
			<MenuItem value="all">
				<FormattedMessage defaultMessage="Show all types" />
			</MenuItem>
			{archetypes.map((option) => (
				<MenuItem key={option.id} value={option.id}>
					<FormattedMessage
						defaultMessage="{label} only"
						values={{
							label: getPossibleTranslation(option.name, formatMessage)
						}}
					/>
				</MenuItem>
			))}
		</Select>
	);
});

export default ContentTypesFilter;
