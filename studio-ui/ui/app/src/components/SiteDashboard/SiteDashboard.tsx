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

import Box from '@mui/material/Box';
import React, { useMemo, useState } from 'react';
import { useEffect, Suspense } from 'react';
import useSiteUIConfig from '../../hooks/useSiteUIConfig';
import useDashboardState from '../../hooks/useDashboardState';
import useActiveUser from '../../hooks/useActiveUser';
import useActiveSiteId from '../../hooks/useActiveSiteId';
import { useDispatch } from 'react-redux';
import { initDashboardConfig } from '../../state/actions/dashboard';
import { renderWidgets } from '../Widget/renderWidgets';
import EmptyState from '../EmptyState';
import { FormattedMessage, useIntl } from 'react-intl';
import Typography from '@mui/material/Typography';
import { visuallyHidden } from '@mui/utils';
import { messages as launcherMessages } from '../LauncherSection/utils';
import { studioDocumentTitle } from '../../utils/studioDocumentTitle';
import Skeleton from '@mui/material/Skeleton';
import { useTheme } from '@mui/material/styles';
import Grid from '@mui/material/Grid';
import ActivityDashlet from '../ActivityDashlet/ActivityDashlet';
import DevContentOpsDashlet from '../DevContentOpsDashlet/DevContentOpsDashlet';
import useMediaQuery from '@mui/material/useMediaQuery';
import { IconGuideDashlet } from '../IconGuideDashlet';
import { SiteDashboardContext } from './useSiteDashboardContext';
import { ErrorBoundary } from '../ErrorBoundary';
import DocumentationLink from '../DocumentationLink';

export interface DashboardProps {
	mountMode?: string;
	onMinimize?(): void;
	/** The legacy dashboard page already places help in its toolbar. */
	showHelpLink?: boolean;
}

export function Dashboard(props: DashboardProps) {
	const { mountMode, onMinimize, showHelpLink = true } = props;

	const {
		palette: { mode }
	} = useTheme();
	const desktopScreen = useMediaQuery('(min-width: 1100px)');
	const site = useActiveSiteId();
	const user = useActiveUser();
	const userRoles = user.rolesBySite[site];
	const uiConfig = useSiteUIConfig();
	const dashboard = useDashboardState();
	const dispatch = useDispatch();
	const [showActivityFeed, setShowActivityFeed] = useState(true);
	const [freezeScroll, setFreezeScroll] = useState(false);
	const context = useMemo(
		() => ({
			onDashletMaximize: () => {
				setShowActivityFeed(false);
				setFreezeScroll(true);
			},
			onDashletMinimize: () => {
				setShowActivityFeed(true);
				setFreezeScroll(false);
			}
		}),
		[]
	);

	const { formatMessage } = useIntl();
	const dashboardLabel = formatMessage(launcherMessages.dashboard);
	useEffect(() => {
		if (uiConfig.xml && !dashboard) {
			dispatch(initDashboardConfig({ configXml: uiConfig.xml }));
		}
	}, [uiConfig.xml, dashboard, dispatch]);
	useEffect(() => {
		if (mountMode === 'dialog') {
			return;
		}
		document.title = studioDocumentTitle(dashboardLabel);
	}, [dashboardLabel, mountMode]);
	const height = 400;
	return (
		<SiteDashboardContext.Provider value={context}>
			{mountMode !== 'dialog' && (
				<Typography component="h1" sx={visuallyHidden}>
					{dashboardLabel}
				</Typography>
			)}
			{showHelpLink && mountMode !== 'dialog' && (
				<Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
					<DocumentationLink />
				</Box>
			)}
			<Box
				sx={{
					position: 'relative',
					bgcolor: 'background.default',
					...(desktopScreen
						? {
								height: mountMode === 'dialog' ? '100%' : showHelpLink ? 'calc(100% - 48px)' : 'calc(100% - 65px)',
								overflow: 'hidden'
							}
						: {
								height: freezeScroll ? '100%' : 'auto',
								overflowY: freezeScroll ? 'hidden' : 'auto'
							})
				}}
			>
				<Grid
					container
					spacing={2}
					sx={{
						alignItems: 'baseline',
						alignContent: 'baseline',
						p: 2,
						...(desktopScreen
							? {
									width: showActivityFeed ? '70%' : '100%',
									height: '100%',
									position: 'absolute',
									overflowY: freezeScroll ? 'hide' : 'auto',
									pb: 2,
									pr: 2
								}
							: {})
					}}
				>
					<Grid
						size={12}
						sx={{
							display: 'flex',
							flexWrap: 'wrap'
						}}
					>
						<DevContentOpsDashlet
							sxs={{
								card: {
									width: '100%'
								}
							}}
						/>
					</Grid>

					<Suspense fallback={<DashboardSkeleton />}>
						{dashboard ? (
							Boolean(dashboard?.mainSection?.widgets?.length) ? (
								renderWidgets(dashboard.mainSection.widgets, {
									userRoles,
									defaultProps: { contentHeight: height, onMinimize, maximizable: true },
									createMapperFn: (mapper) => (widget, index) => (
										<Grid size={{ xs: 12, md: 6 }} key={index}>
											<ErrorBoundary>{mapper(widget, index)}</ErrorBoundary>
										</Grid>
									)
								})
							) : (
								<Grid size={12}>
									<EmptyState
										titleComponent="h2"
										title={
											<FormattedMessage
												id="siteDashboard.emptyStateMessageTitle"
												defaultMessage="No widgets to display"
											/>
										}
										subtitle={
											<FormattedMessage
												id="siteDashboard.emptyStateMessageSubtitle"
												defaultMessage="Add widgets at your project's User Interface Configuration"
											/>
										}
									/>
								</Grid>
							)
						) : (
							<DashboardSkeleton />
						)}
					</Suspense>
					{/* Displays on desktop - inside grid, below the last rendered dashlet */}
					{desktopScreen && (
						<Grid size={12} sx={{ flexWrap: 'wrap' }}>
							<IconGuideDashlet />
						</Grid>
					)}
				</Grid>
				{/* region ActivityDashlet */}
				<ActivityDashlet
					sxs={{
						card: {
							// Using display prop to hide Dashlet to avoid unmounting component
							display: showActivityFeed ? 'flex' : 'none',
							flexDirection: 'column',
							...(desktopScreen
								? {
										width: '30%',
										position: 'absolute',
										right: 0,
										top: 0,
										bottom: 0,
										borderRadius: 0
									}
								: {
										mt: 2
									})
						}
					}}
					contentHeight={desktopScreen ? null : height}
					onMinimize={onMinimize}
					collapsible={!desktopScreen}
				/>
				{/* endregion */}
				{/* Displays on mobile - below Activity Dashlet */}
				{!desktopScreen && (
					<Box sx={{ mt: 2 }}>
						<IconGuideDashlet />
					</Box>
				)}
			</Box>
		</SiteDashboardContext.Provider>
	);
}

function DashboardSkeleton() {
	return (
		<>
			{new Array(3).fill(null).map((nothing, index) => (
				<Grid size={{ xs: 12, md: 6 }} key={index}>
					<Skeleton variant="rectangular" sx={{ height: 350 }} />
				</Grid>
			))}
		</>
	);
}

export default Dashboard;
