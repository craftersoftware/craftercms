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
import ToolbarOverflow from '../ToolbarOverflow';
import { PREVIEW_REFLOW_STICKY_QUERY, PREVIEW_TOOLBAR_WRAP_QUERY } from '../ToolbarOverflow/previewReflow';
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
					background: theme.palette.background.default,
					minWidth: 0,
					[PREVIEW_REFLOW_STICKY_QUERY]: {
						position: 'sticky',
						top: 0,
						zIndex: theme.zIndex.appBar
					}
				},
				toolbar: {
					minWidth: 0,
					maxWidth: '100%',
					overflowX: 'clip',
					// Repeat the section flex rules. Passing this key replaces ViewToolbar's own '& > section'.
					'& > section': {
						display: 'flex',
						alignItems: 'center',
						minWidth: 0
					},
					// Side sections start at their full width and share any shortfall, so the room the
					// overflow bars get does not depend on how many actions are packed.
					'& > section:nth-of-type(1), & > section:nth-of-type(3)': {
						flex: '1 1 auto'
					},
					'& > section:nth-of-type(2)': {
						flex: '0 1 auto',
						overflow: 'hidden'
					},
					[PREVIEW_TOOLBAR_WRAP_QUERY]: {
						// 320px cannot hold the logo, both overflow buttons, three navigation buttons and the
						// address field on one line: wrap instead of crushing the address field or clipping.
						flexWrap: 'wrap',
						rowGap: 0,
						'& > section:nth-of-type(1)': { order: 1, flex: '1 1 auto' },
						'& > section:nth-of-type(3)': { order: 2, flex: '1 1 100%' },
						'& > section:nth-of-type(2)': {
							order: 3,
							flex: '1 1 100%',
							flexWrap: 'wrap',
							overflow: 'visible',
							'& > .MuiPaper-root': { order: 1, flex: '1 1 100%', marginBottom: 1 }
						}
					}
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
				<ToolbarOverflow>
					{renderWidgets(toolbar.leftSection?.widgets, { userRoles, overrideProps: { site, item } })}
				</ToolbarOverflow>
			</section>
			<section>
				<Suspense fallback="">
					{renderWidgets(toolbar.middleSection?.widgets, { userRoles, overrideProps: { site, item } })}
				</Suspense>
			</section>
			<section>
				<ToolbarOverflow align="end">
					{renderWidgets(toolbar.rightSection?.widgets, { userRoles, overrideProps: { site, item } })}
					<LauncherOpenerButton />
				</ToolbarOverflow>
			</section>
		</ViewToolbar>
	);
}

export default ToolBar;
