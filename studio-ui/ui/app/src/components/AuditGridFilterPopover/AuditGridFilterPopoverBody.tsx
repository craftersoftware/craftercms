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

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import React, { ChangeEvent, useCallback, useMemo, useState } from 'react';
import ClearRoundedIcon from '@mui/icons-material/ClearRounded';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { AdapterMoment as DateAdapter } from '@mui/x-date-pickers/AdapterMoment';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Autocomplete from '@mui/material/Autocomplete';
import TextField, { textFieldClasses } from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import { AuditGridFilterPopoverProps } from './AuditGridFilterPopover';
import moment, { Moment } from 'moment-timezone';
import { useDebouncedInput } from '../../hooks/useDebouncedInput';

const translations = defineMessages({
	siteId: {
		id: 'auditGridFilterPopover.filterBySite',
		defaultMessage: 'Filter by Project'
	},
	user: {
		id: 'auditGridFilterPopover.filterByUser',
		defaultMessage: 'Filter by User'
	},
	origin: {
		id: 'auditGridFilterPopover.filterByOrigin',
		defaultMessage: 'Filter by Origin'
	},
	operations: {
		id: 'auditGridFilterPopover.filterByOperations',
		defaultMessage: 'Filter by Operations'
	},
	target: {
		id: 'auditGridFilterPopover.filterByTarget',
		defaultMessage: 'Filter by Target Value'
	},
	allOperations: {
		id: 'auditGridFilterPopover.allOperations',
		defaultMessage: 'All Operations'
	}
});

export function AuditGridFilterPopoverBody(props: AuditGridFilterPopoverProps) {
	const { filterId, value, onFilterChange, timezone, onTimezoneSelected, onResetFilter, onClose } = props;
	const { sites, users, operations, origins, timezones } = props.options;
	const { formatMessage } = useIntl();
	const [keyword, setKeyword] = useState(props.value ?? '');
	const [fromDate, setFromDate] = useState(props.dateFrom ? moment(props.dateFrom) : null);
	const [toDate, setToDate] = useState(props.dateTo ? moment(props.dateTo) : null);
	const onSearch = useCallback((keywords: string) => onFilterChange(filterId, keywords), [onFilterChange, filterId]);

	const onSearch$ = useDebouncedInput(onSearch, 400);

	const options = useMemo<{ id: string; value: string; name: string | React.ReactNode }[]>(() => {
		switch (filterId) {
			case 'siteId': {
				return [
					{
						id: 'all',
						value: 'all',
						name: <FormattedMessage id="auditGrid.allSites" defaultMessage="All Projects" />
					},
					{
						id: 'studio_root',
						value: 'studio_root',
						name: <FormattedMessage id="words.system" defaultMessage="System" />
					},
					...sites.map((site) => ({ id: site.id, name: site.name, value: site.id }))
				];
			}
			case 'user': {
				return [
					{
						id: 'all',
						value: 'all',
						name: <FormattedMessage id="auditGrid.allUsers" defaultMessage="All Users" />
					},
					...users.map((user) => ({ id: user.id.toString(), name: user.username, value: user.username }))
				];
			}
			case 'origin': {
				return [
					{
						id: 'all',
						value: 'all',
						name: <FormattedMessage id="auditGrid.allOrigins" defaultMessage="All Origins" />
					},
					...origins
				];
			}
			case 'operations': {
				return [
					{
						id: 'all',
						value: 'all',
						name: formatMessage(translations.allOperations)
					},
					...operations
				];
			}
		}
	}, [filterId, formatMessage, operations, origins, sites, users]);

	const onTextFieldChanges = (e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
		onSearch$.next(e.target.value);
		setKeyword(e.target.value);
	};

	const onMultipleSelectChanges = (e: React.ChangeEvent<{ value: any }>) => {
		const lastString = e.target.value[e.target.value.length - 1];
		if (lastString === 'all' || e.target.value.length === 0) {
			onFilterChange(filterId, 'all');
		} else {
			const values = e.target.value.filter((value) => value !== 'all');
			onFilterChange(filterId, values.join());
		}
	};

	const onFromDateSelected = (date: Moment) => {
		if (date.isValid()) {
			onFilterChange('dateFrom', date?.format() || 'all');
		}
		setFromDate(date);
	};

	const onToDateSelected = (date: Moment) => {
		if (date.isValid()) {
			onFilterChange('dateTo', date?.format() || 'all');
		}
		setToDate(date);
	};

	const onClearDates = () => {
		setToDate(null);
		setFromDate(null);
		onResetFilter(['dateFrom', 'dateTo']);
	};

	const onClearTextField = () => {
		onResetFilter(filterId);
		setKeyword('');
	};

	return (
		<>
			<Box sx={{ display: 'flex', justifyContent: 'end', marginBottom: '10px' }}>
				<IconButton onClick={onClose}>
					<ClearRoundedIcon fontSize="small" />
				</IconButton>
			</Box>
			{filterId === 'operationTimestamp' && (
				<LocalizationProvider dateAdapter={DateAdapter}>
					<form noValidate autoComplete="off">
						<Box
							sx={(theme) => ({
								display: 'flex',
								alignItems: 'center',
								marginBottom: theme.spacing(2),
								[`& .${textFieldClasses.root}:first-child`]: {
									marginRight: theme.spacing(1)
								}
							})}
						>
							<DateTimePicker
								label={<FormattedMessage id="words.from" defaultMessage="From" />}
								value={fromDate}
								onChange={onFromDateSelected}
							/>
							<DateTimePicker
								label={<FormattedMessage id="words.to" defaultMessage="To" />}
								value={toDate}
								onChange={onToDateSelected}
							/>
							<Button
								sx={{ ml: '20px' }}
								disabled={!toDate && !fromDate}
								variant="text"
								color="primary"
								onClick={() => onClearDates()}
							>
								<FormattedMessage id="words.clear" defaultMessage="Clear" />
							</Button>
						</Box>
						<Autocomplete
							disableClearable
							options={timezones}
							getOptionLabel={(option) => option}
							value={timezone}
							onChange={(e: React.ChangeEvent<{}>, value) => {
								onTimezoneSelected(value);
							}}
							fullWidth
							renderInput={(params) => (
								<TextField
									{...params}
									label={<FormattedMessage id="auditGrid.timezone" defaultMessage="Timezone" />}
									variant="outlined"
								/>
							)}
						/>
					</form>
				</LocalizationProvider>
			)}
			{['siteId', 'user', 'origin'].includes(filterId) && (
				<Box sx={{ display: 'flex', alignItems: 'center' }}>
					<TextField
						fullWidth
						select
						label={formatMessage(translations[filterId])}
						value={value ? value : 'all'}
						onChange={(e) => onFilterChange(filterId, e.target.value)}
						sx={{ width: 200 }}
					>
						{options.map((option) => (
							<MenuItem key={option.id} value={option.value}>
								{option.name}
							</MenuItem>
						))}
					</TextField>
					<Button
						sx={{ ml: '20px' }}
						disabled={!value}
						variant="text"
						color="primary"
						onClick={() => onResetFilter(filterId)}
					>
						<FormattedMessage id="words.clear" defaultMessage="Clear" />
					</Button>
				</Box>
			)}
			{filterId === 'operations' && (
				<Box sx={{ display: 'flex', alignItems: 'center' }}>
					<TextField
						fullWidth
						select
						label={formatMessage(translations[filterId])}
						value={value?.split(',') ?? ['all']}
						slotProps={{
							select: { multiple: true }
						}}
						onChange={onMultipleSelectChanges}
						sx={{ width: 200 }}
					>
						{options.map((option) => (
							<MenuItem key={option.id} value={option.value}>
								{option.name}
							</MenuItem>
						))}
					</TextField>
					<Button
						sx={{ ml: '20px' }}
						disabled={!value}
						variant="text"
						color="primary"
						onClick={() => onResetFilter(filterId)}
					>
						<FormattedMessage id="words.clear" defaultMessage="Clear" />
					</Button>
				</Box>
			)}
			{'target' === filterId && (
				<TextField
					value={keyword}
					label={formatMessage(translations[filterId])}
					slotProps={{
						input: {
							endAdornment: keyword && (
								<Tooltip title={<FormattedMessage id="words.clear" defaultMessage="Clear" />}>
									<IconButton size="small" sx={{ ml: '20px' }} onClick={() => onClearTextField()}>
										<ClearRoundedIcon />
									</IconButton>
								</Tooltip>
							)
						}
					}}
					fullWidth
					onChange={onTextFieldChanges}
				/>
			)}
		</>
	);
}

export default AuditGridFilterPopoverBody;
