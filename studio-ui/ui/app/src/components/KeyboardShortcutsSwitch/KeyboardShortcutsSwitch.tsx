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

import Tooltip from '@mui/material/Tooltip';
import type { SwitchProps } from '@mui/material/Switch';
import { FormattedMessage, useIntl } from 'react-intl';
import { useDispatch } from 'react-redux';
import { setKeyboardShortcutsEnabled as setKeyboardShortcutsEnabledAction } from '../../state/actions/preview';
import useSelection from '../../hooks/useSelection';
import Switch from '@mui/material/Switch';
import { setStoredEnabledKeyboardShortcutsState } from '../../utils/state';
import useActiveUser from '../../hooks/useActiveUser';
import { ChangeEvent } from 'react';

export function KeyboardShortcutsSwitch(props: SwitchProps) {
	const dispatch = useDispatch();
	const shortcutsEnabled = useSelection((state) => state.preview.keyboardShortcutsEnabled);
	const { username } = useActiveUser();
	const { formatMessage } = useIntl();

	const onChange = (e: ChangeEvent<HTMLInputElement>) => {
		setStoredEnabledKeyboardShortcutsState(e.target.checked, username);
		dispatch(setKeyboardShortcutsEnabledAction({ enabled: e.target.checked }));
	};

	return (
		<Tooltip
			title={
				shortcutsEnabled ? (
					<FormattedMessage defaultMessage="Disable shortcuts" />
				) : (
					<FormattedMessage defaultMessage="Enable shortcuts" />
				)
			}
		>
			<Switch
				{...props}
				checked={shortcutsEnabled}
				onChange={onChange}
				slotProps={{
					input: {
						'aria-label': formatMessage({ defaultMessage: 'Toggle keyboard shortcuts' })
					}
				}}
			/>
		</Tooltip>
	);
}

export default KeyboardShortcutsSwitch;
