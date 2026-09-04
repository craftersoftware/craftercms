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
import Paper from '@mui/material/Paper';
import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import LauncherGlobalNav from '../LauncherGlobalNav';
import ResizeableDrawer from '../ResizeableDrawer/ResizeableDrawer';
import {
	createHashRouter,
	createRoutesFromElements,
	Navigate,
	Outlet,
	Route,
	RouterProvider,
	useLocation
} from 'react-router';
import SiteManagement from '../SiteManagement';
import { getLauncherSectionLink, urlMapping } from '../LauncherSection/utils';
import EmptyState from '../EmptyState/EmptyState';
import { FormattedMessage, useIntl } from 'react-intl';
import { useGlobalAppState } from './GlobalAppContext';
import Typography from '@mui/material/Typography';
import CrafterCMSLogo from '../../icons/CrafterCMSLogo';
import LoadingState from '../LoadingState/LoadingState';
import LauncherOpenerButton from '../LauncherOpenerButton';
import { useGlobalNavigation } from '../../hooks/useGlobalNavigation';
import GlobalAppToolbar from '../GlobalAppToolbar';
import Skeleton from '@mui/material/Skeleton';
import { globalMenuMessages } from '../../env/i18n-legacy';
import { GlobalRoutes } from '../../env/routes';
import useEnv from '../../hooks/useEnv';

const routeWrapper = (module) => ({ ...module, Component: module.default });

// Site management loaded normally above as it is usually where people first land.
const UserManagement = lazy(() => import('../UserManagement/UserManagement'));
const GroupManagement = () => import('../GroupManagement/GroupManagement').then(routeWrapper);
const AuditManagement = () => import('../AuditManagement/AuditManagement').then(routeWrapper);
const LogLevelManagement = () => import('../LogLevelManagement/LogLevelManagement').then(routeWrapper);
const LogConsole = () => import('../LogConsole/LogConsole').then(routeWrapper);
const GlobalConfigManagement = () => import('../GlobalConfigManagement/GlobalConfigManagement').then(routeWrapper);
const EncryptTool = () => import('../EncryptTool/EncryptTool').then(routeWrapper);
const TokenManagement = () => import('../TokenManagement/TokenManagement').then(routeWrapper);
const AboutCrafterCMSView = () => import('../AboutCrafterCMSView/AboutCrafterCMSView').then(routeWrapper);
const AccountManagement = lazy(() => import('../AccountManagement/AccountManagement'));

export interface GlobalAppProps {
	passwordRequirementsMinComplexity?: number;
	footerHtml?: string;
}

export function GlobalApp(props: GlobalAppProps = {}) {
	const { passwordRequirementsMinComplexity: passwordRequirementsMinComplexityProp, footerHtml: footerHtmlProp } =
		props;
	const { passwordRequirementsMinComplexity: envPasswordRequirementsMinComplexity, footerHtml: envFooterHtml } =
		useEnv();
	const passwordRequirementsMinComplexity =
		passwordRequirementsMinComplexityProp ?? envPasswordRequirementsMinComplexity ?? 4;
	const footerHtml = footerHtmlProp ?? envFooterHtml ?? '';
	const globalNavigation = useGlobalNavigation();

	if (!globalNavigation.items) {
		return <LoadingState sxs={{ root: { height: '100%', margin: 0 } }} />;
	}

	const router = createHashRouter(
		createRoutesFromElements(
			<Route path="/" element={<GlobalAppInternal footerHtml={footerHtml} />}>
				<Route path={GlobalRoutes.Projects} element={<SiteManagement />} />
				{/* Leaving this route for backwards compatibility. Main route is now 'projects' */}
				<Route path="/sites" element={<SiteManagement />} />
				<Route
					path={GlobalRoutes.Users}
					element={<UserManagement passwordRequirementsMinComplexity={passwordRequirementsMinComplexity} />}
				/>
				<Route path={GlobalRoutes.Groups} lazy={GroupManagement} />
				<Route path={GlobalRoutes.Audit} lazy={AuditManagement} />
				<Route path={GlobalRoutes.LogLevel} lazy={LogLevelManagement} />
				<Route path={GlobalRoutes.LogConsole} lazy={LogConsole} />
				<Route path={GlobalRoutes.GlobalConfig} lazy={GlobalConfigManagement} />
				<Route path={GlobalRoutes.EncryptTool} lazy={EncryptTool} />
				<Route path={GlobalRoutes.TokenManagement} lazy={TokenManagement} />
				<Route path={GlobalRoutes.About} lazy={AboutCrafterCMSView} />
				<Route
					path={GlobalRoutes.Settings}
					element={<AccountManagement passwordRequirementsMinComplexity={passwordRequirementsMinComplexity} />}
				/>
				<Route path="/" element={<Navigate to={`${urlMapping[globalNavigation.items[0].id].replace('#', '')}`} />} />
				<Route path="*" element={<RouteNotFound />} />
			</Route>
		)
	);

	return <RouterProvider router={router} />;
}

function RouteNotFound() {
	const { pathname } = useLocation();
	return (
		<Box display="flex" flexDirection="column" height="100%">
			<Box component="section" sx={{ margin: '10px 12px 0 auto' }}>
				<LauncherOpenerButton />
			</Box>
			<EmptyState
				sxs={{
					root: {
						height: '100%',
						margin: 0
					}
				}}
				title="404"
				subtitle={
					<FormattedMessage
						id={'globalApp.routeNotFound'}
						defaultMessage={'Route "{pathname}" not found'}
						values={{ pathname }}
					/>
				}
			/>
		</Box>
	);
}

export function GlobalAppInternal(props: Pick<GlobalAppProps, 'footerHtml'>) {
	const { footerHtml = '' } = props;
	const [width, setWidth] = useState(240);
	const [{ openSidebar }] = useGlobalAppState();
	const { items } = useGlobalNavigation();
	const { formatMessage } = useIntl();
	const location = useLocation();
	const idByPathLookup = useMemo(
		() =>
			items?.reduce((lookup, item) => {
				lookup[getLauncherSectionLink(item.id, '').replace(/^#/, '')] = item.id;
				return lookup;
			}, {}),
		[items]
	);
	useEffect(() => {
		const path = location.pathname;
		const id = idByPathLookup?.[path];
		document.title = `CrafterCMS - ${formatMessage(
			globalMenuMessages[id] ?? {
				id: 'globalApp.routeNotFound',
				defaultMessage: 'Route not found'
			}
		)}`;
	}, [formatMessage, idByPathLookup, location.pathname]);
	return (
		<Paper sx={{ height: '100vh', width: '100%' }} elevation={0}>
			<ResizeableDrawer
				sxs={{
					drawerPaper: {
						top: '0',
						padding: 2
					},
					drawerBody: {
						height: '100%',
						display: 'flex',
						flexDirection: 'column',
						justifyContent: 'space-between'
					}
				}}
				open={openSidebar}
				width={width}
				onWidthChange={setWidth}
			>
				<LauncherGlobalNav
					title=""
					sectionSxs={{
						nav: {
							maxHeight: '100%',
							overflow: 'auto'
						}
					}}
					tileSxs={{
						tile: {
							width: '100%',
							height: '35px',
							flexDirection: 'row',
							justifyContent: 'left',
							margin: '0 0 5px'
						},
						iconAvatar: {
							width: '25px',
							height: '25px',
							margin: '5px 10px'
						},
						title: {
							textAlign: 'left'
						}
					}}
				/>
				<Box component="footer" sx={{ padding: '20px 0', textAlign: 'center' }}>
					<CrafterCMSLogo width={100} sxs={{ root: { margin: '0 auto 10px auto' } }} />
					<Typography
						component="p"
						variant="caption"
						sx={(theme) => ({
							color: theme.palette.text.secondary,
							'& > a': {
								textDecoration: 'none',
								color: theme.palette.primary.main
							}
						})}
						dangerouslySetInnerHTML={{ __html: footerHtml }}
					/>
				</Box>
			</ResizeableDrawer>
			<Box
				sx={(theme) => ({
					transition: theme.transitions.create('padding-left', {
						easing: theme.transitions.easing.easeOut,
						duration: theme.transitions.duration.enteringScreen
					})
				})}
				height="100%"
				width="100%"
				paddingLeft={openSidebar ? `${width}px` : 0}
			>
				<Suspense
					fallback={
						<>
							<GlobalAppToolbar title={<Skeleton width="140px" />} />
							<Box display="flex" sx={{ height: '100%' }}>
								<LoadingState />
							</Box>
						</>
					}
				>
					<Outlet />
				</Suspense>
			</Box>
		</Paper>
	);
}

export default GlobalApp;
