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

import React, { useEffect } from 'react';
import { defineMessages, FormattedMessage } from 'react-intl';
import { initToolsPanelConfig, updateToolsPanelWidth } from '../../state/actions/preview';
import { useDispatch } from 'react-redux';
import ResizeableDrawer from '../ResizeableDrawer/ResizeableDrawer';
import { renderWidgets } from '../Widget/renderWidgets';
import { WidgetDescriptor } from '../../models';
import { Suspencified } from '../Suspencified/Suspencified';
import { useSelection } from '../../hooks/useSelection';
import { usePreviewState } from '../../hooks/usePreviewState';
import { useActiveUser } from '../../hooks/useActiveUser';
import { useSiteUIConfig } from '../../hooks/useSiteUIConfig';
import { nnou } from '../../utils/object';
import { getStoredPreviewToolsPanelPage, getStoredPreviewToolsPanelWidth } from '../../utils/state';
import { useActiveSite } from '../../hooks/useActiveSite';
import { blockPreviewIframePointerEvents } from '../Preview/utils';
import { ApiResponseErrorState } from '../ApiResponseErrorState';
import { LoadingState, LoadingStateProps } from '../LoadingState';
import { EmptyState } from '../EmptyState';

defineMessages({
	previewSiteExplorerPanelTitle: {
		id: 'previewSiteExplorerPanel.title',
		defaultMessage: 'Project Explorer'
	}
});

export function ToolsPanel() {
	const dispatch = useDispatch();
	const { id: siteId, uuid } = useActiveSite();
	const { showToolsPanel, toolsPanel, toolsPanelWidth, windowSize } = usePreviewState();
	const toolsPanelPageStack = useSelection<WidgetDescriptor[]>((state) => state.preview.toolsPanelPageStack);
	const uiConfig = useSiteUIConfig();
	const { username } = useActiveUser();
	const { rolesBySite } = useActiveUser();
	const isLoading = uiConfig.isFetching;
	const isEmpty = toolsPanel?.widgets == null || toolsPanel.widgets.length === 0;
	const onWidthChange = (width: number) => dispatch(updateToolsPanelWidth({ width }));
	const loadingStateProps: LoadingStateProps = { sxs: { graphic: { width: '90px' } } };

	useEffect(() => {
		if (nnou(uiConfig.xml) && !toolsPanel) {
			const storedPage = getStoredPreviewToolsPanelPage(uuid, username);
			const toolsPanelWidth = getStoredPreviewToolsPanelWidth(siteId, username);
			dispatch(initToolsPanelConfig({ configXml: uiConfig.xml, storedPage, toolsPanelWidth }));
		}
	}, [uiConfig.xml, toolsPanel, dispatch, uuid, username, siteId]);

	return (
		<ResizeableDrawer
			belowToolbar
			open={showToolsPanel}
			width={toolsPanelWidth}
			maxWidth={windowSize}
			sxs={{
				drawerBody: {
					paddingBottom: '50px'
				},
				resizeHandle: { backgroundColor: 'transparent' },
				drawerPaperBelowToolbar: { top: '64px' }
			}}
			onWidthChange={onWidthChange}
			onResizeStart={() => blockPreviewIframePointerEvents(true)}
			onResizeStop={() => blockPreviewIframePointerEvents(false)}
		>
			{uiConfig.error ? (
				<ApiResponseErrorState error={uiConfig.error} />
			) : isLoading ? (
				<LoadingState {...loadingStateProps} />
			) : isEmpty ? (
				<EmptyState
					sxs={{ title: { textAlign: 'center' } }}
					title={<FormattedMessage defaultMessage="No widgets configured" />}
					subtitle={
						<FormattedMessage defaultMessage="Add configuration > widgets to `craftercms.components.ToolsPanel` on `ui.xml`" />
					}
				/>
			) : (
				<Suspencified loadingStateProps={loadingStateProps}>
					{renderWidgets(
						toolsPanelPageStack.length ? toolsPanelPageStack.slice(toolsPanelPageStack.length - 1) : toolsPanel.widgets,
						{ userRoles: rolesBySite[siteId] }
					)}
				</Suspencified>
			)}
		</ResizeableDrawer>
	);
}

export default ToolsPanel;
