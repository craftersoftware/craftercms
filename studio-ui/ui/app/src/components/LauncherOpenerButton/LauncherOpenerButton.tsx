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

import React, { useMemo } from 'react';
import IconButton from '@mui/material/IconButton';
import CrafterCMSIcon from '../../icons/CrafterCMSIcon';
import { defineMessages, useIntl } from 'react-intl';
import Tooltip from '@mui/material/Tooltip';
import { useDispatch } from 'react-redux';
import { showLauncher } from '../../state/actions/dialogs';
import { LauncherStateProps } from '../Launcher/Launcher';
import AppsRounded from '@mui/icons-material/AppsRounded';

const messages = defineMessages({
	menu: {
		id: 'launcherOpenerButton.menuTooltip',
		defaultMessage: 'Navigation Menu'
	},
	openDrawer: {
		id: 'launcherOpenerButton.openMenuButtonText',
		defaultMessage: 'Open Menu'
	}
});

let instanceCount = 0;

interface LauncherOpenerButtonProps {
	icon?: 'logo' | 'apps';
	sitesRailPosition?: LauncherStateProps['sitesRailPosition'];
	closeButtonPosition?: LauncherStateProps['closeButtonPosition'];
}

export function LauncherOpenerButton(props: LauncherOpenerButtonProps) {
	const { icon = 'apps', ...launcherProps } = props;
	const { formatMessage } = useIntl();
	const id = useMemo(() => `toolbarLauncherButton${instanceCount++}`, []);
	const dispatch = useDispatch();
	const onMenuClick = () => dispatch(showLauncher({ anchor: `#${id}`, ...launcherProps }));
	return (
		<Tooltip title={formatMessage(messages.menu)} describeChild>
			<IconButton
				id={id}
				aria-label={formatMessage(messages.openDrawer)}
				onClick={onMenuClick}
				sx={icon === 'logo' ? { padding: '7px' } : void 0}
				size="large"
			>
				{icon === 'logo' ? <CrafterCMSIcon sxs={{ root: { fontSize: '1.4em' } }} /> : <AppsRounded />}
			</IconButton>
		</Tooltip>
	);
}

export default LauncherOpenerButton;
