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

import React from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import {
	Divider,
	FormControl,
	FormControlLabel,
	FormHelperText,
	List,
	ListItem,
	ListItemText,
	ListSubheader,
	Radio,
	RadioGroup
} from '@mui/material';
import { setHighlightMode } from '../../state/actions/preview';
import { useDispatch } from 'react-redux';
import EditModeSwitch from '../EditModeSwitch';
import { usePreviewState } from '../../hooks/usePreviewState';
import { HighlightMode } from '../../models/GlobalState';
import PaddingModeSwitchListItem from '../PaddingModeSwitchListItem';
import { KeyboardShortcutsSwitch } from '../KeyboardShortcutsSwitch';

const translations = defineMessages({
	editMode: {
		id: 'settingsPanel.editMode',
		defaultMessage: 'Edit Mode (e | m)'
	},
	editModeHelperText: {
		id: 'settingsPanel.editModeHelperText',
		defaultMessage: 'Enable/disabled in-context editing'
	},
	highlightMode: {
		id: 'settingsPanel.highlightMode',
		defaultMessage: 'Highlight Mode'
	},
	highlightModeHelperText: {
		id: 'settingsPanel.highlightModeHelperText',
		defaultMessage:
			'When "highlight movable" is selected, only content items you can be moved or sorted highlight. Text inputs and other non-movable won\'t highlight. Press `e` and `m` at any point to toggle between modes.'
	},
	highlightAllZones: {
		id: 'settingsPanel.highlightAllTargets',
		defaultMessage: 'Highlight all targets (e)'
	},
	highlightMovable: {
		id: 'settingsPanel.highlightMovable',
		defaultMessage: 'Highlight movable (m)'
	}
});

const labelRootSx = {
	width: '100%',
	justifyContent: 'space-between',
	ml: 0
};

const formHelperTextSx = { pb: 1, pr: 2, pl: 2, pt: 0, mt: 0 };

export function PreviewSettingsPanel() {
	const { formatMessage } = useIntl();
	const { highlightMode } = usePreviewState();
	const dispatch = useDispatch();
	return (
		<List>
			<ListItem>
				<ListItemText primary={formatMessage(translations.editMode)} />
				<EditModeSwitch edge="end" />
			</ListItem>
			<FormHelperText sx={formHelperTextSx}>{formatMessage(translations.editModeHelperText)}</FormHelperText>
			<ListItem>
				<ListItemText primary={formatMessage({ defaultMessage: 'Keyboard shortcuts' })} />
				<KeyboardShortcutsSwitch edge="end" />
			</ListItem>
			<FormHelperText sx={formHelperTextSx}>
				<FormattedMessage defaultMessage="Enable/disable keyboard shortcuts" />
			</FormHelperText>
			<Divider />
			<ListSubheader id="settingsPanelHighlightModeLabel" children={formatMessage(translations.highlightMode)} />
			<FormControl sx={{ pt: 0, pb: 0, pl: 2, pr: 2 }} component="li">
				<RadioGroup
					value={highlightMode}
					onChange={(e) => {
						dispatch(
							setHighlightMode({
								highlightMode: e.target.value as HighlightMode
							})
						);
					}}
				>
					<FormControlLabel
						value="all"
						sx={labelRootSx}
						control={<Radio color="primary" edge="end" />}
						label={formatMessage(translations.highlightAllZones)}
						labelPlacement="start"
					/>
					<FormControlLabel
						value="move"
						sx={labelRootSx}
						control={<Radio color="primary" edge="end" />}
						label={formatMessage(translations.highlightMovable)}
						labelPlacement="start"
					/>
				</RadioGroup>
				<FormHelperText sx={formHelperTextSx}>{formatMessage(translations.highlightModeHelperText)}</FormHelperText>
			</FormControl>
			<Divider />
			<PaddingModeSwitchListItem showIcon={false} showHelperText />
		</List>
	);
}

export default PreviewSettingsPanel;
