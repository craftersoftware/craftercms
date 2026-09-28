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

import Typography from '@mui/material/Typography';
import React, { useCallback, useEffect, useState } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import AddIcon from '@mui/icons-material/Add';
import { PluginRecord } from '../../models/Plugin';
import { ConditionalLoadingState } from '../LoadingState/LoadingState';
import TableContainer from '@mui/material/TableContainer';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import { AsDayMonthDateTime } from '../VersionList';
import EmptyState from '../EmptyState/EmptyState';
import InstallPluginDialog from '../MarketplaceDialog';
import { MarketplacePlugin } from '../../models';
import IconButton from '@mui/material/IconButton';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import Popover from '@mui/material/Popover';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import { useDispatch } from 'react-redux';
import { fetchInstalledMarketplacePlugins } from '../../services/marketplace';
import {
	emitSystemEvent,
	pluginInstalled,
	pluginUninstalled,
	showSystemNotification
} from '../../state/actions/system';
import LookupTable from '../../models/LookupTable';
import GlobalState from '../../models/GlobalState';
import GlobalAppToolbar from '../GlobalAppToolbar';
import { useSelection } from '../../hooks/useSelection';
import { useActiveSiteId } from '../../hooks/useActiveSiteId';
import { useMount } from '../../hooks/useMount';
import { useEnhancedDialogState } from '../../hooks/useEnhancedDialogState';
import { useWithPendingChangesCloseRequest } from '../../hooks/useWithPendingChangesCloseRequest';
import { batchActions } from '../../state/actions/misc';
import Link from '@mui/material/Link';
import { createPresenceTable } from '../../utils/array';
import ListSubheader from '@mui/material/ListSubheader';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import TableBody from '@mui/material/TableBody';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import UninstallPluginDialog from '../DeletePluginDialog';
import { PluginConfigDialog } from '../PluginConfigDialog';
import { fetchMyPermissions } from '../../services/users';
import Tooltip from '@mui/material/Tooltip';
import PencilIcon from '@mui/icons-material/EditOutlined';
import { styled } from '@mui/material/styles';
import { pushErrorDialog } from '../../utils/system';

const messages = defineMessages({
	pluginInstalled: {
		id: 'pluginManagement.pluginInstalled',
		defaultMessage: 'Plugin installed successfully'
	},
	pluginConfigUpdated: {
		id: 'pluginManagement.pluginConfigUpdated',
		defaultMessage: 'Plugin configuration updated successfully'
	},
	pluginUninstalled: {
		id: 'pluginManagement.pluginUninstalled',
		defaultMessage: 'Plugin uninstalled successfully'
	}
});

const StyledTableCell = styled(TableCell)(() => ({
	padding: '5px'
}));

export interface PluginManagementProps {
	embedded?: boolean;
	showAppsButton?: boolean;
}

export const PluginManagement = (props: PluginManagementProps) => {
	const { embedded = false, showAppsButton = !embedded } = props;
	const dispatch = useDispatch();
	const siteId = useActiveSiteId();
	const { formatMessage } = useIntl();
	const [plugins, setPlugins] = useState<PluginRecord[]>(null);
	const [permissions, setPermissions] = useState<string[]>(null);
	const [openMarketPlaceDialog, setOpenMarketPlaceDialog] = useState<{ installPermission: boolean }>(null);
	const listPluginsPermission = permissions?.includes('list_plugins');
	const installPluginsPermission = permissions?.includes('install_plugins');
	const [anchorEl, setAnchorEl] = React.useState<HTMLButtonElement | null>(null);
	const [pluginFiles, setPluginFiles] = React.useState<PluginRecord>(null);
	const [installedPluginsLookup, setInstalledPluginsLookup] = useState<LookupTable<boolean>>();
	const locale = useSelection<GlobalState['uiConfig']['locale']>((state) => state.uiConfig.locale);
	const deletePluginDialogState = useEnhancedDialogState();
	const configPluginDialogState = useEnhancedDialogState();
	const onWithPendingChangesCloseRequest = useWithPendingChangesCloseRequest(configPluginDialogState.onResetState);
	const [pluginToDelete, setPluginToDelete] = useState(null);
	const [pluginToConfig, setPluginToConfig] = useState(null);

	useMount(() => {
		fetchMyPermissions(siteId).subscribe((permissions) => {
			setPermissions(permissions);
		});
	});

	const refresh = useCallback(
		() =>
			fetchInstalledMarketplacePlugins(siteId).subscribe(
				(plugins) => {
					setPlugins(plugins);
					setInstalledPluginsLookup(
						createPresenceTable(
							plugins.map((plugin) => plugin.id),
							true
						)
					);
				},
				(error) => {
					dispatch(pushErrorDialog({ props: { error } }));
				}
			),
		[dispatch, siteId]
	);

	useEffect(() => {
		if (listPluginsPermission && siteId) {
			refresh();
		}
	}, [dispatch, listPluginsPermission, refresh, siteId]);

	const onSearchPlugin = () => {
		setOpenMarketPlaceDialog({ installPermission: installPluginsPermission });
	};

	const onInstallMarketplacePlugin = (plugin: MarketplacePlugin) => {
		dispatch(
			batchActions([
				showSystemNotification({ message: formatMessage(messages.pluginInstalled) }),
				emitSystemEvent(pluginInstalled(plugin))
			])
		);
		setInstalledPluginsLookup({ ...installedPluginsLookup, [plugin.id]: true });
		refresh();
	};

	const onCloseMarketplaceDialog = () => {
		setOpenMarketPlaceDialog(null);
	};

	const showPluginFiles = (event: React.MouseEvent<HTMLButtonElement>, plugin: PluginRecord) => {
		setPluginFiles(plugin);
		setAnchorEl(event.currentTarget);
	};

	const closePluginFilesPopover = () => {
		setAnchorEl(null);
	};

	const onDeletePlugin = () => {
		dispatch(
			batchActions([
				showSystemNotification({
					message: formatMessage(messages.pluginUninstalled)
				}),
				emitSystemEvent(pluginUninstalled())
			])
		);
		deletePluginDialogState.onResetState();
		refresh();
	};

	const onSavedPluginConfig = () => {
		dispatch(
			showSystemNotification({
				message: formatMessage(messages.pluginConfigUpdated)
			})
		);
		configPluginDialogState.onResetState();
	};

	const onEditPluginConfig = (plugin: PluginRecord) => {
		setPluginToConfig(plugin.id);
		configPluginDialogState.onOpen();
	};

	return (
		<Paper elevation={0}>
			<GlobalAppToolbar
				title={
					!embedded && (
						<FormattedMessage id="globalMenu.pluginManagementEntryLabel" defaultMessage="Plugin Management" />
					)
				}
				showAppsButton={showAppsButton}
				showHamburgerMenuButton={!embedded}
				sxs={
					embedded && {
						leftContent: {
							marginLeft: 0
						}
					}
				}
				leftContent={
					<Button
						startIcon={<AddIcon />}
						variant="outlined"
						color="primary"
						onClick={onSearchPlugin}
						disabled={permissions === null || listPluginsPermission === false}
					>
						{installPluginsPermission ? (
							<FormattedMessage id="pluginManagement.searchPlugin" defaultMessage="Search & install" />
						) : (
							<FormattedMessage id="words.search" defaultMessage="Search" />
						)}
					</Button>
				}
			/>
			{permissions && listPluginsPermission === false ? (
				<EmptyState
					title={
						<FormattedMessage
							id="pluginManagement.listPluginPermission"
							defaultMessage="You don't have enough permissions to see the list of plugins"
						/>
					}
				/>
			) : (
				<ConditionalLoadingState isLoading={plugins === null}>
					<TableContainer>
						<Table sx={{ minWidth: 650 }}>
							<TableHead>
								<TableRow>
									<TableCell align="left">
										<Typography variant="subtitle2">
											<FormattedMessage id="words.id" defaultMessage="Id" />
										</Typography>
									</TableCell>
									<StyledTableCell align="left">
										<Typography variant="subtitle2">
											<FormattedMessage id="words.version" defaultMessage="Version" />
										</Typography>
									</StyledTableCell>
									<StyledTableCell align="left">
										<Typography variant="subtitle2">
											<FormattedMessage id="words.url" defaultMessage="Url" />
										</Typography>
									</StyledTableCell>
									<StyledTableCell align="left">
										<Typography variant="subtitle2">
											<FormattedMessage id="words.files" defaultMessage="Files" />
										</Typography>
									</StyledTableCell>
									<StyledTableCell align="left">
										<Typography variant="subtitle2">
											<FormattedMessage id="pluginManagement.installationDate" defaultMessage="Installation Date" />
										</Typography>
									</StyledTableCell>
									<TableCell align="center" sx={{ width: '150px', padding: '5px 20px' }} />
								</TableRow>
							</TableHead>
							<TableBody>
								{plugins?.map((plugin) => (
									<TableRow key={plugin.id}>
										<TableCell component="th" id={plugin.id} scope="row">
											{plugin.id}
										</TableCell>
										<StyledTableCell align="left">
											{plugin.version.major}.{plugin.version.minor}.{plugin.version.patch}
										</StyledTableCell>
										<StyledTableCell align="left">
											<Link href={plugin.pluginUrl} target="_blank">
												{plugin.pluginUrl}
											</Link>
										</StyledTableCell>
										<StyledTableCell align="left">
											{plugin.files.length}
											<IconButton
												onClick={(e) => showPluginFiles(e, plugin)}
												size="small"
												aria-label={formatMessage({ defaultMessage: 'View files' })}
											>
												<Tooltip title={<FormattedMessage defaultMessage="View files" />}>
													<ExpandMoreRoundedIcon />
												</Tooltip>
											</IconButton>
										</StyledTableCell>
										<StyledTableCell align="left">
											<AsDayMonthDateTime date={plugin.installationDate} locale={locale} />
										</StyledTableCell>
										<TableCell align="right" sx={{ width: '150px', padding: '5px 20px' }}>
											<Tooltip title={<FormattedMessage defaultMessage="Edit configuration" />}>
												<IconButton
													onClick={() => {
														onEditPluginConfig(plugin);
													}}
													color="primary"
													aria-label={formatMessage({ defaultMessage: 'Edit configuration' })}
												>
													<PencilIcon />
												</IconButton>
											</Tooltip>
											<Tooltip title={<FormattedMessage defaultMessage="Uninstall plugin" />}>
												<IconButton
													onClick={() => {
														setPluginToDelete(plugin.id);
														deletePluginDialogState.onOpen();
													}}
													color="primary"
													aria-label={formatMessage({ defaultMessage: 'Uninstall plugin' })}
												>
													<DeleteIcon />
												</IconButton>
											</Tooltip>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</TableContainer>
					{plugins?.length === 0 && (
						<EmptyState
							title={
								<FormattedMessage id="pluginManagement.emptyList" defaultMessage="There are no plugins installed" />
							}
						/>
					)}
				</ConditionalLoadingState>
			)}
			<InstallPluginDialog
				open={Boolean(openMarketPlaceDialog)}
				onClose={onCloseMarketplaceDialog}
				onInstall={onInstallMarketplacePlugin}
				installedPlugins={installedPluginsLookup}
				installPermission={openMarketPlaceDialog?.installPermission}
			/>
			<UninstallPluginDialog
				open={deletePluginDialogState.open}
				onClose={deletePluginDialogState.onResetState}
				isSubmitting={deletePluginDialogState.isSubmitting}
				hasPendingChanges={deletePluginDialogState.hasPendingChanges}
				isMinimized={deletePluginDialogState.isMinimized}
				updateSubmittingOrHasPendingChanges={deletePluginDialogState.onSubmittingAndOrPendingChange}
				pluginId={pluginToDelete}
				onComplete={onDeletePlugin}
			/>
			<PluginConfigDialog
				open={configPluginDialogState.open}
				onClose={configPluginDialogState.onResetState}
				isSubmitting={configPluginDialogState.isSubmitting}
				hasPendingChanges={configPluginDialogState.hasPendingChanges}
				isMinimized={configPluginDialogState.isMinimized}
				onMinimize={configPluginDialogState.onMinimize}
				onMaximize={configPluginDialogState.onMaximize}
				isFullScreen={configPluginDialogState.isFullScreen}
				onFullScreen={configPluginDialogState.onFullScreen}
				onCancelFullScreen={configPluginDialogState.onCancelFullScreen}
				updateSubmittingOrHasPendingChanges={configPluginDialogState.onSubmittingAndOrPendingChange}
				pluginId={pluginToConfig}
				onSaved={onSavedPluginConfig}
				onWithPendingChangesCloseRequest={onWithPendingChangesCloseRequest}
			/>
			<Popover
				open={Boolean(anchorEl)}
				anchorEl={anchorEl}
				onClose={closePluginFilesPopover}
				anchorOrigin={{
					vertical: 'bottom',
					horizontal: 'center'
				}}
				transformOrigin={{
					vertical: 'top',
					horizontal: 'center'
				}}
			>
				<List
					dense
					subheader={
						<ListSubheader>
							<FormattedMessage id="words.files" defaultMessage="Files" />
						</ListSubheader>
					}
				>
					{pluginFiles?.files.map((file, i) => (
						<ListItem key={i}>
							<ListItemText primary={file.path} />
						</ListItem>
					))}
				</List>
			</Popover>
		</Paper>
	);
};

export default PluginManagement;
