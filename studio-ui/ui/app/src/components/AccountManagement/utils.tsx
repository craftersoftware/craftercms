/*
 * Copyright (C) 2007-2023 Crafter Software Corporation. All Rights Reserved.
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
import { FormattedMessage } from 'react-intl';
import {
	removeStoredBrowseDialogViewMode,
	removeStoredClipboard,
	removeStoredEditModeChoice,
	removeStoredEditModePadding,
	removeStoredGlobalAppOpenSidebar,
	removeStoredGlobalMenuSiteViewPreference,
	removeStoredHighlightModeChoice,
	removeStoredICEToolsPanelPage,
	removeStoredICEToolsPanelWidth,
	removeStoredItems,
	removeStoredLegacyComponentPanel,
	removeStoredOutdatedXBValidationDate,
	removeStoredPreviewBackgroundMode,
	removeStoredPreviewToolsPanelPage,
	removeStoredPreviewToolsPanelWidth,
	removeStoredPullBranch,
	removeStoredPullMergeStrategy,
	removeStoredPushBranch,
	removeStoredShowToolsPanel,
	removeCompareVersionDialogViewModes,
	removeViewVersionDialogViewModes,
	removeTypeViewCompactMode,
	removeViewGroupedTypes,
	removeStoredShowDisabledUsers,
	removeStoredEnabledKeyboardShortcutsState
} from '../../utils/state';

export const preferencesGroups: Array<{
	label: string | React.JSX.Element;
	onClear: (props: { siteId: string; siteUuid: string; username: string }) => void;
}> = [
	{
		label: <FormattedMessage defaultMessage="Sidebars Width" />,
		onClear: (props) => {
			removeStoredPreviewToolsPanelWidth(props.siteId, props.username);
			removeStoredICEToolsPanelWidth(props.siteId, props.username);
		}
	},
	{
		label: <FormattedMessage defaultMessage="Left Sidebar Navigation State" />,
		onClear: (props) => {
			const pathNavigatorKeyRegex = new RegExp(
				`^craftercms.${props.username}.pathNavigator.${props.siteUuid}.[a-zA-Z0-9]+`
			);
			removeStoredItems((key) => pathNavigatorKeyRegex.test(key));

			const pathNavigatorTreeKeyRegex = new RegExp(
				`^craftercms.${props.username}.pathNavigatorTree.${props.siteUuid}.[a-zA-Z0-9]+`
			);
			removeStoredItems((key) => pathNavigatorTreeKeyRegex.test(key));
		}
	},
	{
		label: <FormattedMessage defaultMessage="Left Sidebar Selected Tool" />,
		onClear: (props) => {
			removeStoredPreviewToolsPanelPage(props.siteUuid, props.username);
		}
	},
	{
		label: <FormattedMessage defaultMessage="Right Sidebar Selected Tool" />,
		onClear: (props) => {
			removeStoredICEToolsPanelPage(props.siteUuid, props.username);
		}
	},
	{
		label: <FormattedMessage defaultMessage="Left Sidebar Open/Closed" />,
		onClear: (props) => {
			removeStoredShowToolsPanel(props.siteUuid, props.username);
		}
	},
	{
		label: <FormattedMessage defaultMessage="Edit Mode" />,
		onClear: (props) => {
			removeStoredEditModeChoice(props.username, props.siteUuid);
			removeStoredHighlightModeChoice(props.username, props.siteUuid);
			removeStoredEditModePadding(props.username);
			removeStoredLegacyComponentPanel(props.username);
		}
	},
	{
		label: <FormattedMessage defaultMessage="Dashboard Preferences" />,
		onClear: (props) => {
			// new dashlets
			const newDashletsKeyRegex = new RegExp(`^craftercms.${props.siteUuid}.[a-zA-Z0-9]+.dashletFilterTypeGroups`);
			removeStoredItems((key) => newDashletsKeyRegex.test(key));

			// Legacy dashlets
			const legacyDashletsKeyRegex = new RegExp(
				`^craftercms.dashboard.[a-zA-Z0-9]+.${props.siteUuid}.${props.username}`
			);
			removeStoredItems((key) => legacyDashletsKeyRegex.test(key));
		}
	},
	{
		label: <FormattedMessage defaultMessage="Git Settings" />,
		onClear: (props) => {
			removeStoredPushBranch(props.siteUuid, props.username);
			removeStoredPullBranch(props.siteUuid, props.username);
			removeStoredPullMergeStrategy(props.siteUuid, props.username);
		}
	},
	{
		label: <FormattedMessage defaultMessage="Form Settings" />,
		onClear: (props) => {
			removeStoredItems((key) => key.includes(`craftercms.${props.username}.saveButtonSubAction.`));
		}
	},
	{
		label: <FormattedMessage defaultMessage="Miscellaneous" />,
		onClear: (props) => {
			const widgetsAccordionsKeyRegex = new RegExp(
				`^craftercms.${props.username}.widgetsAccordion.${props.siteUuid}.[a-zA-Z0-9]+`
			);

			removeStoredGlobalAppOpenSidebar(props.username);
			removeStoredGlobalMenuSiteViewPreference(props.username);
			removeStoredOutdatedXBValidationDate(props.siteId, props.username);
			removeStoredClipboard(props.siteUuid, props.username);
			removeStoredPreviewBackgroundMode(props.username);
			removeStoredBrowseDialogViewMode(props.username);
			removeStoredItems((key) => widgetsAccordionsKeyRegex.test(key));
			removeCompareVersionDialogViewModes(props.username);
			removeViewVersionDialogViewModes(props.username);
			removeTypeViewCompactMode(props.username);
			removeViewGroupedTypes(props.username);
			removeStoredShowDisabledUsers(props.username);
			removeStoredEnabledKeyboardShortcutsState(props.username);
		}
	}
];
