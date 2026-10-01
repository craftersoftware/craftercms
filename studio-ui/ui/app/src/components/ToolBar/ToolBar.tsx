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

import React, { Suspense, useEffect } from 'react';
import ViewToolbar from '../ViewToolbar';
import LauncherOpenerButton from '../LauncherOpenerButton';
import { closeToolsPanel, initToolbarConfig, openToolsPanel } from '../../state/actions/preview';
import { useDispatch } from 'react-redux';
import { defineMessages, useIntl } from 'react-intl';
import Tooltip from '@mui/material/Tooltip';
import LogoAndMenuBundleButton from '../LogoAndMenuBundleButton';
import { renderWidgets } from '../Widget/renderWidgets';
import { useActiveSiteId } from '../../hooks/useActiveSiteId';
import { usePreviewState } from '../../hooks/usePreviewState';
import { useActiveUser } from '../../hooks/useActiveUser';
import { useSiteUIConfig } from '../../hooks/useSiteUIConfig';
import useCurrentPreviewItem from '../../hooks/useCurrentPreviewItem';
import { useTheme } from '@mui/material';

const translations = defineMessages({
	openToolsPanel: {
		id: 'openToolsPanel.label',
		defaultMessage: 'Open tools panel'
	},
	toggleSidebarTooltip: {
		id: 'common.toggleSidebarTooltip',
		defaultMessage: 'Toggle sidebar'
	},
	itemMenu: {
		id: 'previewToolbar.itemMenu',
		defaultMessage: 'Item menu'
	}
});

export function ToolBar() {
	const { formatMessage } = useIntl();
	const dispatch = useDispatch();
	const site = useActiveSiteId();
	const user = useActiveUser();
	const userRoles = user.rolesBySite[site];
	const { showToolsPanel, toolbar } = usePreviewState();
	const item = useCurrentPreviewItem();
	const uiConfig = useSiteUIConfig();
	const theme = useTheme();

	useEffect(() => {
		if (uiConfig.xml && !toolbar.leftSection && !toolbar.middleSection && !toolbar.rightSection) {
			dispatch(initToolbarConfig({ configXml: uiConfig.xml }));
		}
	}, [uiConfig.xml, toolbar, dispatch]);

	return (
		<ViewToolbar
			sxs={{
				appBar: {
					borderBottom: '5px',
					background: theme.palette.background.default
				}
			}}
		>
			<section>
				<Tooltip title={formatMessage(translations.toggleSidebarTooltip)}>
					<LogoAndMenuBundleButton
						aria-label={formatMessage(translations.openToolsPanel)}
						onClick={() => dispatch(showToolsPanel ? closeToolsPanel() : openToolsPanel())}
					/>
				</Tooltip>
				<Suspense fallback="">
					{renderWidgets(toolbar.leftSection?.widgets, { userRoles, overrideProps: { site, item } })}
				</Suspense>
			</section>
			<section>
				<Suspense fallback="">
					{renderWidgets(toolbar.middleSection?.widgets, { userRoles, overrideProps: { site, item } })}
				</Suspense>
			</section>
			<section>
				<Suspense fallback="">
					{renderWidgets(toolbar.rightSection?.widgets, { userRoles, overrideProps: { site, item } })}
				</Suspense>
				<LauncherOpenerButton />
			</section>
		</ViewToolbar>
	);
}

export default ToolBar;
