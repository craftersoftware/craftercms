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

import { FormHelperText, ListItem, ListItemIcon, ListItemProps, ListItemText, Switch } from '@mui/material';
import React from 'react';
import { useDispatch } from 'react-redux';
import { setEditModePadding } from '../../state/actions/preview';
import usePreviewState from '../../hooks/usePreviewState';
import { FormattedMessage } from 'react-intl';
import { SxProps } from '@mui/system';
import { Theme } from '@mui/material/styles';
import Icon from '@mui/icons-material/SpaceBarRounded';

export interface PaddingModeSwitchProps extends ListItemProps {
	/** Element the row renders as. Pass `li` when it is placed inside a `List`. Defaults to `div`, as a standalone widget. */
	component?: React.ElementType;
	sxs?: Partial<Record<'listItemIcon' | 'listItemText' | 'switch' | 'helperText', SxProps<Theme>>>;
	showHelperText?: boolean;
	showIcon?: boolean;
}

export function PaddingModeSwitchListItem(props: PaddingModeSwitchProps) {
	const { sxs, showHelperText = false, showIcon = true, component = 'div', sx, ...listItemProps } = props;
	const dispatch = useDispatch();
	const { editModePadding } = usePreviewState();
	const onEditModePaddingChange = (e) => {
		dispatch(setEditModePadding({ editModePadding: e.target.checked }));
	};
	return (
		<ListItem
			component={component}
			{...listItemProps}
			// The helper belongs to this row. A sibling `p` under a `ul` fails the list content model.
			sx={[showHelperText && { flexWrap: 'wrap', alignItems: 'center', pb: 0 }, ...(Array.isArray(sx) ? sx : [sx])]}
		>
			{showIcon && (
				<ListItemIcon sx={sxs?.listItemIcon}>
					<Icon sx={{ mr: 0.5 }} />
				</ListItemIcon>
			)}
			<ListItemText
				sx={sxs?.listItemText}
				id="paddingModeSwitchLabel"
				primary={<FormattedMessage id="settingsPanel.editModePaddingLabel" defaultMessage="Padding Mode (p)" />}
			/>
			<Switch
				sx={sxs?.switch}
				edge="end"
				checked={editModePadding}
				onChange={onEditModePaddingChange}
				slotProps={{
					input: {
						'aria-labelledby': 'paddingModeSwitchLabel',
						...(showHelperText ? { 'aria-describedby': 'paddingModeSwitchHelper' } : {})
					}
				}}
			/>
			{showHelperText && (
				<FormHelperText
					id="paddingModeSwitchHelper"
					sx={{ flexBasis: '100%', px: 0, pt: 0, pb: 0.5, mt: 1, ...sxs?.helperText }}
				>
					<FormattedMessage
						id="settingsPanel.editModePaddingHelp"
						defaultMessage="Adds padding to collections for easier interaction in edit-mode. Press `p` at any point to toggle on/off."
					/>
				</FormHelperText>
			)}
		</ListItem>
	);
}

export default PaddingModeSwitchListItem;
