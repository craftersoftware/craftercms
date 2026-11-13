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

import * as React from 'react';
import { useDispatch } from 'react-redux';
import { setPreviewEditMode } from '../../state/actions/preview';
import { ContentItem } from '../../models/Item';
import { usePreviewState } from '../../hooks/usePreviewState';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import { useIntl } from 'react-intl';
import IconButton from '@mui/material/IconButton';
import { UNDEFINED } from '../../utils/constants';
import PowerSettingsNewRoundedIcon from '@mui/icons-material/PowerSettingsNewRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';

export interface EditModesSwitcherProps {
	item: ContentItem;
	disabled?: boolean;
}

export function EditModesSwitcher(props: EditModesSwitcherProps) {
	const { disabled } = props;
	const { editMode, highlightMode } = usePreviewState();
	const dispatch = useDispatch();
	const { formatMessage } = useIntl();
	const onEditModeChange = (editMode, highlightMode?) => dispatch(setPreviewEditMode({ editMode, highlightMode }));
	const isAllHighlightMode = editMode && highlightMode === 'all';
	const isMoveHighlightMode = editMode && !isAllHighlightMode;
	const commonModeButtonStyle = {
		bgcolor: 'background.default',
		':hover': {
			cursor: 'default'
		}
	};
	return (
		<Box
			sx={{
				minWidth: 104,
				borderRadius: 20,
				display: 'inline-block',
				border: (theme) =>
					`1px solid ${theme.palette.mode === 'light' ? theme.palette.divider : theme.palette.grey[700]}`,
				transition: (theme) => theme.transitions.create(['background-color', 'border'])
			}}
		>
			<Tooltip
				title={formatMessage(
					{ id: 'editModesSwitcher.offButtonTooltip', defaultMessage: 'Switch off editing ({shortcutKey})' },
					{ shortcutKey: editMode ? (isAllHighlightMode ? 'e' : 'm') : 'e | m' }
				)}
			>
				<IconButton
					size="small"
					color={!editMode ? 'error' : UNDEFINED}
					disabled={disabled}
					onClick={() => onEditModeChange(false)}
					sx={{
						borderTopRightRadius: 0,
						borderBottomRightRadius: 0,
						...(!editMode && { cursor: 'default' })
					}}
					aria-label={formatMessage(
						{ id: 'editModesSwitcher.offButtonTooltip', defaultMessage: 'Switch off editing ({shortcutKey})' },
						{ shortcutKey: editMode ? (isAllHighlightMode ? 'e' : 'm') : 'e | m' }
					)}
				>
					<PowerSettingsNewRoundedIcon />
				</IconButton>
			</Tooltip>
			<Tooltip
				title={
					disabled ? '' : formatMessage({ id: 'editModesSwitcher.editModeTooltip', defaultMessage: 'Edit mode (e)' })
				}
			>
				<IconButton
					color={isAllHighlightMode ? 'success' : UNDEFINED}
					disabled={disabled}
					size="small"
					onClick={() => onEditModeChange(true, 'all')}
					sx={{
						borderRadius: 0,
						...(isAllHighlightMode && commonModeButtonStyle)
					}}
					aria-label={formatMessage({ id: 'editModesSwitcher.editModeTooltip', defaultMessage: 'Edit mode (e)' })}
				>
					<EditRoundedIcon />
				</IconButton>
			</Tooltip>
			<Tooltip
				title={
					disabled ? '' : formatMessage({ id: 'editModesSwitcher.moveModeTooltip', defaultMessage: 'Move mode (m)' })
				}
			>
				<IconButton
					color={isMoveHighlightMode ? 'primary' : UNDEFINED}
					disabled={disabled}
					size="small"
					onClick={() => onEditModeChange(true, 'move')}
					sx={{
						borderTopLeftRadius: 0,
						borderBottomLeftRadius: 0,
						...(isMoveHighlightMode && commonModeButtonStyle)
					}}
					aria-label={formatMessage({ id: 'editModesSwitcher.moveModeTooltip', defaultMessage: 'Move mode (m)' })}
				>
					<DragIndicatorRoundedIcon />
				</IconButton>
			</Tooltip>
		</Box>
	);
}

export default EditModesSwitcher;
