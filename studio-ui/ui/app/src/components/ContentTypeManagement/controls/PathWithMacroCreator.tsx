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

import OutlinedInput, { OutlinedInputProps } from '@mui/material/OutlinedInput';
import React, { useEffect, useId, useRef } from 'react';
import FormsEngineField from '../../FormsEngine/components/FormsEngineField';
import { TypeBuilderControl } from '../utils';
import { defineMessage, FormattedMessage, useIntl } from 'react-intl';
import IconButton from '@mui/material/IconButton';
import AddCircleOutlineOutlinedIcon from '@mui/icons-material/AddCircleOutlineOutlined';
import Tooltip from '@mui/material/Tooltip';
import Popover from '@mui/material/Popover';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';
import { EnhancedDialog } from '../../EnhancedDialog';
import { DialogBody } from '../../DialogBody';
import useEnhancedDialogState from '../../../hooks/useEnhancedDialogState';
import { useStableFormContext } from '../../FormsEngine/lib/formsEngineContext';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { nanoid } from 'nanoid';
import { popDialog, pushDialog } from '../../../state/actions/dialogStack';
import { useDispatch } from 'react-redux';

export interface PathWithMacroCreatorProps extends TypeBuilderControl {
	value: string;
}

export const macroCreatorLookupTable = {
	objectId: {
		macro: '{objectId}',
		description: defineMessage({ defaultMessage: 'Inserts a GUID.' })
	},
	year: {
		macro: '{year}',
		description: defineMessage({ defaultMessage: 'Inserts the current year (4-digit year).' })
	},
	yyyy: {
		macro: '{yyyy}',
		description: defineMessage({ defaultMessage: 'Inserts the current year (4-digit year).' })
	},
	month: {
		macro: '{month}',
		description: defineMessage({ defaultMessage: 'Inserts the current month (2-digit month of the year).' })
	},
	mm: {
		macro: '{mm}',
		description: defineMessage({ defaultMessage: 'Inserts the current month (2-digit month of the year).' })
	},
	dd: {
		macro: '{dd}',
		description: defineMessage({ defaultMessage: 'Inserts the current day (2-digit day of the month).' })
	}
};

export function PathWithMacroCreator(props: PathWithMacroCreatorProps) {
	const { field, value, setValue, readonly, autoFocus } = props;
	const { originalValues } = useStableFormContext();
	const type = originalValues.type;
	const defaultPath = type === 'page' ? '/site/website/' : '/site/components/';
	const htmlId = useId();
	const maxLength = field.validations.maxLength?.value;
	const [anchorEl, setAnchorEl] = React.useState<HTMLButtonElement>(undefined);
	const { formatMessage } = useIntl();
	const dispatch = useDispatch();
	const dialogState = useEnhancedDialogState();
	const inputRef = useRef<HTMLInputElement>(undefined);
	const addMacroRef = useRef<{
		triggered: boolean;
		selectionRangeValue: number;
	}>({
		triggered: false,
		selectionRangeValue: null
	});

	const handleChange: OutlinedInputProps['onChange'] = (e) => setValue(e.currentTarget.value);

	const onAddMacro = (macro: string) => {
		dialogState.onClose();
		if (inputRef.current) {
			const input = inputRef.current;
			const start = input.selectionStart ?? 0;
			const end = input.selectionEnd ?? 0;
			const newValue = value.slice(0, start) + macro + value.slice(end);
			addMacroRef.current = {
				triggered: true,
				selectionRangeValue: start + macro.length
			};
			setValue(newValue);
		}
	};

	const onOpenPathSelectionDialog = () => {
		const id = nanoid();
		dispatch(
			pushDialog({
				id,
				component: 'craftercms.components.PathSelectionDialog',
				props: {
					rootPath: '/site',
					allowSwitchingRootPath: false,
					initialPath: '/site',
					onClose: () => dispatch(popDialog({ id })),
					onOk: ({ path }) => {
						setValue(path);
						dispatch(popDialog({ id }));
					}
				}
			})
		);
	};

	useEffect(() => {
		// Focus the input when it has been updated after adding a macro.
		if (addMacroRef.current.triggered) {
			const selectionRangeValue = addMacroRef.current.selectionRangeValue;
			inputRef.current.setSelectionRange(selectionRangeValue, selectionRangeValue);
			inputRef.current.focus();
			addMacroRef.current = { triggered: false, selectionRangeValue: null };
		}
	}, [value]);

	return (
		<>
			<FormsEngineField htmlFor={htmlId} field={field} max={maxLength} length={value?.length}>
				<OutlinedInput
					autoFocus={autoFocus}
					id={htmlId}
					inputRef={inputRef}
					fullWidth
					inputProps={{ maxLength }}
					value={value}
					onChange={handleChange}
					placeholder={defaultPath}
					onFocus={() => {
						if (!value) {
							setValue(defaultPath);
						}
					}}
					disabled={readonly}
					spellCheck={false}
					endAdornment={
						<>
							<Tooltip title={<FormattedMessage defaultMessage="Select path" />}>
								<IconButton
									aria-label={formatMessage({ defaultMessage: 'Select path' })}
									onClick={() => onOpenPathSelectionDialog()}
								>
									<SearchRoundedIcon />
								</IconButton>
							</Tooltip>
							<Tooltip title={<FormattedMessage defaultMessage="Add macro" />}>
								<IconButton
									aria-label={formatMessage({ defaultMessage: 'Add macro' })}
									onClick={() => dialogState.onOpen()}
								>
									<AddCircleOutlineOutlinedIcon />
								</IconButton>
							</Tooltip>
						</>
					}
				/>
			</FormsEngineField>
			<EnhancedDialog
				open={dialogState.open}
				maxWidth="sm"
				title={<FormattedMessage defaultMessage="Add Macro" />}
				onClose={dialogState.onClose}
			>
				<DialogBody>
					<List>
						{Object.values(macroCreatorLookupTable).map((macro) => (
							<ListItem key={macro.macro}>
								<ListItemText
									sx={{ flexGrow: 'unset', width: '100px' }}
									slotProps={{ primary: { sx: { fontWeight: 600 } } }}
								>
									{macro.macro}
								</ListItemText>
								<ListItemText sx={{ flexGrow: 1 }}>{formatMessage(macro.description)}</ListItemText>
								<ListItemButton sx={{ flexGrow: 'unset' }} onClick={() => onAddMacro(macro.macro)}>
									<AddCircleOutlineOutlinedIcon />
								</ListItemButton>
							</ListItem>
						))}
					</List>
				</DialogBody>
			</EnhancedDialog>
			<Popover
				open={Boolean(anchorEl)}
				anchorEl={anchorEl}
				onClose={() => setAnchorEl(undefined)}
				anchorOrigin={{
					vertical: 'top',
					horizontal: 'left'
				}}
			></Popover>
		</>
	);
}

export default PathWithMacroCreator;
