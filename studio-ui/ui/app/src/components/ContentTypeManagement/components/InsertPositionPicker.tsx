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

import { ReactNode, useId } from 'react';
import { FormattedMessage } from 'react-intl';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import ListItemText from '@mui/material/ListItemText';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

export interface InsertPositionPickerItem {
	id: string;
	label: string;
}

export type InsertPositionPickerEmptyMode = 'hide' | 'firstOnly';

export interface InsertPositionPickerProps {
	items: InsertPositionPickerItem[];
	/** Splice index: 0 = first, `items.length` = last, `i + 1` = after item i. */
	value: number;
	onChange: (position: number) => void;
	disabled?: boolean;
	/** Accessible name for the "insert after" select. */
	afterSelectLabel: ReactNode;
	/** How to render when `items` is empty. Defaults to `hide`. */
	emptyMode?: InsertPositionPickerEmptyMode;
}

type PositionMode = 'first' | 'after' | 'last';

const radioSx = { mr: 0, maxWidth: '100%' };

function PositionOption({
	id,
	value,
	label,
	disabled
}: {
	id?: string;
	value: PositionMode;
	label: ReactNode;
	disabled?: boolean;
}) {
	return (
		<FormControlLabel
			id={id}
			value={value}
			disabled={disabled}
			control={<Radio />}
			sx={radioSx}
			slotProps={{ typography: { variant: 'body2' } }}
			label={label}
		/>
	);
}

/**
 * Compact insert-position control: Insert first / Insert after [select] / Insert last.
 * The select lists every item except the last; "Insert last" covers that case.
 */
export function InsertPositionPicker(props: InsertPositionPickerProps) {
	const { items, value, onChange, disabled = false, afterSelectLabel, emptyMode = 'hide' } = props;
	const length = items.length;
	const groupLabelId = useId();
	const afterRadioId = useId();
	const afterSelectLabelId = useId();

	if (length === 0 && emptyMode === 'hide') {
		return null;
	}

	// Select options exclude the last item. Index 0 is the default shown value.
	const afterOptions = items.slice(0, -1);
	const mode: PositionMode = value <= 0 ? 'first' : value >= length ? 'last' : 'after';
	// Which option the "Insert after" select should show. `value` is a splice index, so subtract 1
	// to get the item being inserted after. When first/last is selected, fall back to the first option.
	const afterIndex = mode === 'after' ? value - 1 : 0;
	const selectedAfterId = afterOptions[afterIndex]?.id ?? '';

	const selectMode = (next: PositionMode) => {
		if (next === 'first') onChange(0);
		else if (next === 'last') onChange(length);
		else onChange(afterIndex + 1);
	};

	const selectAfter = (event: SelectChangeEvent<string>) => {
		const index = afterOptions.findIndex((item) => item.id === event.target.value);
		if (index >= 0) onChange(index + 1);
	};

	return (
		<FormControl disabled={disabled} sx={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
			<FormLabel id={groupLabelId}>
				<FormattedMessage defaultMessage="Position" />
			</FormLabel>
			<RadioGroup
				aria-labelledby={groupLabelId}
				name="insertPosition"
				value={length === 0 ? 'first' : mode}
				onChange={(_, next) => selectMode(next as PositionMode)}
				sx={{ gap: 0.5, mt: 0.5, maxWidth: '100%' }}
			>
				<PositionOption value="first" label={<FormattedMessage defaultMessage="Insert first" />} />
				{length > 0 && (
					<>
						<Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, maxWidth: '100%', minWidth: 0 }}>
							<PositionOption
								id={afterRadioId}
								value="after"
								disabled={disabled || afterOptions.length === 0}
								label={<FormattedMessage defaultMessage="Insert after" />}
							/>
							{afterOptions.length > 0 && (
								<Box sx={{ pl: 3.5, width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
									<Typography id={afterSelectLabelId} component="span" sx={{ display: 'none' }}>
										{afterSelectLabel}
									</Typography>
									<Select
										fullWidth
										size="small"
										disabled={disabled}
										value={selectedAfterId}
										onChange={selectAfter}
										inputProps={{ 'aria-labelledby': `${afterRadioId} ${afterSelectLabelId}` }}
										sx={{ maxWidth: '100%', '& .MuiSelect-select': { overflow: 'hidden', textOverflow: 'ellipsis' } }}
										renderValue={(id) => afterOptions.find((item) => item.id === id)?.label ?? ''}
									>
										{afterOptions.map((item) => (
											<MenuItem key={item.id} value={item.id}>
												<ListItemText
													primary={item.label}
													secondary={item.id}
													slotProps={{ primary: { noWrap: true }, secondary: { noWrap: true } }}
												/>
											</MenuItem>
										))}
									</Select>
								</Box>
							)}
						</Box>
						<PositionOption value="last" label={<FormattedMessage defaultMessage="Insert last" />} />
					</>
				)}
			</RadioGroup>
		</FormControl>
	);
}

export default InsertPositionPicker;
