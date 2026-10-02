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

import React, { lazy, Suspense, useEffect } from 'react';
import StandardAction from '../../models/StandardAction';
import { useDispatch } from 'react-redux';
import { SnackbarKey, useSnackbar } from 'notistack';
import { getHostToHostBus } from '../../utils/subjects';
import { blockUI, newProjectReady, showSystemNotification, unblockUI } from '../../state/actions/system';
import Launcher from '../Launcher/Launcher';
import useSelection from '../../hooks/useSelection';
import MinimizedBar from '../MinimizedBar';
import { FormattedMessage, useIntl } from 'react-intl';
import Button from '@mui/material/Button';
import { getSystemLink } from '../../utils/system';
import useEnv from '../../hooks/useEnv';
import { filter, map, switchMap } from 'rxjs/operators';
import { ProjectLifecycleEvent } from '../../models/ProjectLifecycleEvent';
import { fetchAll as fetchSitesService } from '../../services/sites';
import IconButton from '@mui/material/IconButton';
import CloseRounded from '@mui/icons-material/CloseRounded';
import useAuth from '../../hooks/useAuth';
import useActiveSiteId from '../../hooks/useActiveSiteId';
import { EnhancedDialogProps } from '../EnhancedDialog';
import { DialogStackItem } from '../../models/GlobalState';
import DialogStackItemContainer from './DialogStackItemContainer';
import { createCallback } from './createCallback';

// region const ... = lazy(() => import('...'));
const ViewVersionDialog = lazy(() => import('../ViewVersionDialog'));
const CompareVersionsDialog = lazy(() => import('../CompareVersionsDialog'));
const HistoryDialog = lazy(() => import('../HistoryDialog'));
const ItemMenu = lazy(() => import('../ItemActionsMenu'));
const ItemMegaMenu = lazy(() => import('../ItemMegaMenu'));
const AuthMonitor = lazy(() => import('../AuthMonitor'));
const UIBlocker = lazy(() => import('../UIBlocker'));
// endregion

function GlobalDialogManager() {
	const state = useSelection((state) => state.dialogs);
	const stack = useSelection((state) => state.dialogStack);
	const contentTypesBranch = useSelection((state) => state.contentTypes);
	const versionsBranch = useSelection((state) => state.versions);
	const { enqueueSnackbar, closeSnackbar } = useSnackbar();
	const dispatch = useDispatch();
	const { authoringBase, socketConnected } = useEnv();
	const { active: authActive } = useAuth();
	const activeSiteId = useActiveSiteId();
	const { formatMessage } = useIntl();

	useEffect(() => {
		const hostToHost$ = getHostToHostBus();
		const subscription = hostToHost$.subscribe(({ type, payload }) => {
			switch (type) {
				case showSystemNotification.type:
					enqueueSnackbar(payload.message, payload.options);
					break;
			}
		});
		return () => {
			subscription.unsubscribe();
		};
	}, [enqueueSnackbar]);

	useEffect(() => {
		const subscription = getHostToHostBus()
			.pipe(
				filter((e: StandardAction<ProjectLifecycleEvent>) => e.type === newProjectReady.type),
				switchMap((e) =>
					// Not the most efficient approach to (re)fetch all sites (which already occurs when a new site is created), but it's not possible to
					// look site by uuid or to sync this even with the completion of the background fetch of the sites.
					fetchSitesService().pipe(
						map((sites) => sites.find((site) => site.uuid === e.payload.siteUuid)),
						filter((site) => Boolean(site))
					)
				)
			)
			.subscribe((site) => {
				if (!document.querySelector('[data-dialog-id="create-site-dialog"]')) {
					const siteId = site.id;
					enqueueSnackbar(
						<FormattedMessage defaultMessage={`Project "{siteId}" has been created.`} values={{ siteId }} />,
						{
							action: (
								<Button
									size="small"
									onClick={() => {
										window.location.href = getSystemLink({
											systemLinkId: 'preview',
											authoringBase,
											site: siteId,
											page: '/'
										});
									}}
								>
									<FormattedMessage id="words.view" defaultMessage="View" />
								</Button>
							)
						}
					);
				}
			});
		return () => subscription.unsubscribe();
	}, [authoringBase, enqueueSnackbar]);

	useEffect(() => {
		const isIframe = window.location !== window.parent.location;
		if (!isIframe && authActive && !socketConnected && activeSiteId !== null) {
			let key: SnackbarKey;
			const timeout = setTimeout(() => {
				fetch(`${authoringBase}/help/socket-connection-error`)
					.then((r) => {
						if (r.ok) {
							return r.text();
						} else {
							throw new Error('socket-connection-error fetch failed');
						}
					})
					.then(() => {
						key = enqueueSnackbar(<FormattedMessage defaultMessage="Studio will continue to retry the connection." />, {
							variant: 'warning',
							persist: true,
							anchorOrigin: { vertical: 'bottom', horizontal: 'center' },
							alertTitle: <FormattedMessage defaultMessage="Connection with the server interrupted" />,
							action: (key) => (
								<>
									<Button
										href={`${authoringBase}/help/socket-connection-error`}
										target="_blank"
										size="small"
										color="inherit"
									>
										<FormattedMessage defaultMessage="Learn more" />
									</Button>
									<IconButton size="small" color="inherit" onClick={() => closeSnackbar(key)}>
										<CloseRounded />
									</IconButton>
								</>
							)
						});
					})
					.catch(() => {
						dispatch(
							blockUI({
								title: formatMessage({ defaultMessage: 'Connection with the server interrupted' }),
								message: formatMessage({
									defaultMessage:
										'Studio servers might be down, being restarted or your network connection dropped. Check your connection or ask the administrator to validate server status.'
								})
							})
						);
					});
			}, 5000);
			return () => {
				clearTimeout(timeout);
				if (key) {
					closeSnackbar(key);
				} else {
					dispatch(unblockUI());
				}
			};
		}
	}, [
		authoringBase,
		authActive,
		closeSnackbar,
		enqueueSnackbar,
		socketConnected,
		dispatch,
		formatMessage,
		activeSiteId
	]);

	return (
		<>
			{stack.ids.map((id) => (
				<Suspense key={id} fallback={<UIBlocker open />}>
					<DialogStackItemContainer {...(stack.byId[id] as DialogStackItem<EnhancedDialogProps>)} />
				</Suspense>
			))}
			<Suspense fallback="">
				{/* region History */}
				<HistoryDialog
					{...state.history}
					versionsBranch={versionsBranch}
					onClose={createCallback(state.history.onClose, dispatch)}
					onClosed={createCallback(state.history.onClosed, dispatch)}
				/>
				{/* endregion */}

				{/* region View Versions */}
				<ViewVersionDialog
					{...state.viewVersion}
					rightActions={state.viewVersion.rightActions?.map((action) => ({
						...action,
						onClick: createCallback(action.onClick, dispatch)
					}))}
					leftActions={state.viewVersion.leftActions?.map((action) => ({
						...action,
						onClick: createCallback(action.onClick, dispatch)
					}))}
					contentTypesBranch={contentTypesBranch}
					onClose={createCallback(state.viewVersion.onClose, dispatch)}
					onClosed={createCallback(state.viewVersion.onClosed, dispatch)}
				/>
				{/* endregion */}

				{/* region Compare Versions */}
				<CompareVersionsDialog
					{...state.compareVersions}
					leftActions={state.compareVersions.leftActions?.map((action) => ({
						...action,
						onClick: createCallback(action.onClick, dispatch)
					}))}
					rightActions={state.compareVersions.rightActions?.map((action) => ({
						...action,
						onClick: createCallback(action.onClick, dispatch)
					}))}
					contentTypesBranch={contentTypesBranch}
					selectedA={versionsBranch?.selected[0] ? versionsBranch.byId[versionsBranch.selected[0]] : null}
					selectedB={versionsBranch?.selected[1] ? versionsBranch.byId[versionsBranch.selected[1]] : null}
					versionsBranch={versionsBranch}
					onClose={createCallback(state.compareVersions.onClose, dispatch)}
					onClosed={createCallback(state.compareVersions.onClosed, dispatch)}
				/>
				{/* endregion */}

				{/* region Auth Monitor */}
				<AuthMonitor />
				{/* endregion */}

				{/* region Item Menu */}
				<ItemMenu {...state.itemMenu} onClose={createCallback(state.itemMenu.onClose, dispatch)} />
				{/* endregion */}

				{/* region Item Mega Menu */}
				<ItemMegaMenu
					{...state.itemMegaMenu}
					onClose={createCallback(state.itemMegaMenu.onClose, dispatch)}
					onClosed={createCallback(state.itemMegaMenu.onClosed, dispatch)}
				/>
				{/* endregion */}

				{/* region Launcher */}
				<Launcher {...state.launcher} />
				{/* endregion */}

				{/* region Minimized Tabs */}
				{Object.values(state.minimizedTabs).map((tab) => (
					<MinimizedBar
						key={tab.id}
						open={tab.minimized}
						title={tab.title}
						subtitle={tab.subtitle}
						status={tab.status}
						onMaximize={createCallback(tab.onMaximized, dispatch)}
					/>
				))}
				{/* endregion */}

				{/* region UIBlocker */}
				<UIBlocker {...state.uiBlocker} />
				{/* endregion */}
			</Suspense>
		</>
	);
}

export default React.memo(GlobalDialogManager);
