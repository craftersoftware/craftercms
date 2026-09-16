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

import ResizeableDrawer from '../ResizeableDrawer/ResizeableDrawer';
import React from 'react';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { FormattedMessage, useIntl } from 'react-intl';
import SystemIcon, { SystemIconDescriptor } from '../SystemIcon';
import EmptyState from '../EmptyState/EmptyState';
import CrafterCMSLogo from '../../icons/CrafterCMSLogo';
import { getPossibleTranslation } from '../../utils/i18n';
import Widget from '../Widget';
import { PartialSxRecord, WidgetDescriptor } from '../../models';
import IconButton from '@mui/material/IconButton';
import KeyboardArrowLeftRoundedIcon from '@mui/icons-material/KeyboardArrowLeftRounded';
import SiteSwitcherSelect from '../SiteSwitcherSelect';
import Tooltip from '@mui/material/Tooltip';
import Paper from '@mui/material/Paper';
import TranslationOrText from '../../models/TranslationOrText';
import Suspencified from '../Suspencified/Suspencified';
import LauncherOpenerButton from '../LauncherOpenerButton';
import { onSubmittingAndOrPendingChangeProps } from '../../hooks/useEnhancedDialogState';
import useSelection from '../../hooks/useSelection';
import { SxProps } from '@mui/system';
import { Theme } from '@mui/material';

export interface Tool {
	title: TranslationOrText;
	icon: SystemIconDescriptor;
	url: string;
	widget: WidgetDescriptor;
}

export interface SiteToolsProps {
	site: string;
	activeToolId: string;
	footerHtml?: string;
	openSidebar: boolean;
	sidebarWidth: number;
	tools: Tool[];
	sidebarBelowToolbar?: boolean;
	hideSidebarLogo?: boolean;
	hideSidebarSiteSwitcher?: boolean;
	showAppsButton?: boolean;
	classes?: Partial<Record<'root', string>>;
	sx?: SxProps<Theme>;
	sxs?: PartialSxRecord<'root'>;
	// Whether the component is mounted on a dialog or it's the main app on a page (i.e. `/studio/site-tools`)
	mountMode?: 'dialog' | 'page';
	onBackClick?(): void;
	onWidthChange(width: number): void;
	onNavItemClick(url: string): void;
	onSubmittingAndOrPendingChange?(value: onSubmittingAndOrPendingChangeProps): void;
	onMinimize?: () => void;
}

export function SiteTools(props: SiteToolsProps) {
	const {
		site,
		activeToolId,
		hideSidebarSiteSwitcher = false,
		hideSidebarLogo = false,
		sidebarBelowToolbar = false,
		mountMode = 'dialog',
		footerHtml,
		onBackClick,
		openSidebar,
		sidebarWidth,
		onWidthChange,
		tools,
		onNavItemClick,
		showAppsButton,
		onSubmittingAndOrPendingChange,
		onMinimize,
		sx
	} = props;
	const { formatMessage } = useIntl();
	const baseUrl = useSelection<string>((state) => state.env.authoringBase);
	const tool = tools?.find((tool) => tool.url === activeToolId)?.widget;
	return (
        <Paper
			className={props.classes?.root}
			sx={{
				height: '100vh',
				width: '100%',
				...sx
			}}
			elevation={0}
		>
            <ResizeableDrawer
				sxs={{
					drawerPaper: {
						position: 'absolute'
					},
					drawerBody: {
						display: 'flex',
						flexDirection: 'column',
						justifyContent: 'space-between',
						padding: (theme) => theme.spacing(2)
					}
				}}
				open={openSidebar}
				width={sidebarWidth}
				belowToolbar={sidebarBelowToolbar}
				onWidthChange={onWidthChange}
			>
				<section>
					<Box
                        sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: "10px"
                        }}>
						{onBackClick && (
							<Tooltip title={<FormattedMessage id="words.preview" defaultMessage="Preview" />}>
								<IconButton
									onClick={onBackClick}
									size="large"
									aria-label={formatMessage({ id: 'words.preview', defaultMessage: 'Preview' })}
								>
									<KeyboardArrowLeftRoundedIcon />
								</IconButton>
							</Tooltip>
						)}
						{!hideSidebarSiteSwitcher && <SiteSwitcherSelect site={site} fullWidth />}
					</Box>
					<MenuList disablePadding sx={{ overflow: 'auto' }}>
						{tools ? (
							tools.map((tool) => (
								<MenuItem
									onClick={() => onNavItemClick(tool.url)}
									key={tool.url}
									selected={`/${tool.url}` === activeToolId}
								>
									<SystemIcon
										sx={{ marginRight: '10px' }}
										icon={tool.icon}
										svgIconProps={{ fontSize: 'small', color: 'action' }}
									/>
									<Typography>{getPossibleTranslation(tool.title, formatMessage)}</Typography>
								</MenuItem>
							))
						) : (
							<EmptyState
								title={
									<FormattedMessage
										id="siteTools.toolListingNotConfigured"
										defaultMessage="The project tools list has not been set"
									/>
								}
								subtitle={
									<FormattedMessage
										id="siteTools.toolListingNotConfiguredSubtitle"
										defaultMessage="Please set the craftercms.siteTools reference on the ui.xml"
									/>
								}
							/>
						)}
					</MenuList>
				</section>
				<Box component="footer" sx={{ padding: '20px 0', textAlign: 'center' }}>
					{!hideSidebarLogo && <CrafterCMSLogo width={100} sxs={{ root: { margin: '0 auto 10px auto' } }} />}
					{footerHtml && (
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
					)}
				</Box>
			</ResizeableDrawer>
            <Box
                sx={[{
                    height: "100%",
                    width: "100%",
                    paddingLeft: openSidebar ? `${sidebarWidth}px` : 0
                }, (theme) => ({
					transition: theme.transitions.create('padding-left', {
						easing: theme.transitions.easing.easeOut,
						duration: theme.transitions.duration.enteringScreen
					})
				})]}>
				{activeToolId ? (
					tool ? (
						<Suspencified>
							<Widget
								{...tool}
								overrideProps={{
									embedded: false,
									mountMode,
									showAppsButton,
									onSubmittingAndOrPendingChange,
									onMinimize
								}}
							/>
						</Suspencified>
					) : (
						<Box
                            sx={{
                                display: "flex",
                                flexDirection: "column",
                                height: "100%"
                            }}>
							<Box component="section" sx={{ margin: '10px 12px 0 auto' }}>
								<LauncherOpenerButton />
							</Box>
							<EmptyState
								sxs={{ root: { height: '100%', margin: 0 } }}
								title="404"
								subtitle={<FormattedMessage id="siteTools.toolNotFound" defaultMessage="Tool not found" />}
							/>
						</Box>
					)
				) : (
					<EmptyState
						sxs={{ root: { height: '100%', margin: 0 } }}
						title={<FormattedMessage id="siteTools.selectTool" defaultMessage="Please choose a tool from the left." />}
						image={`${baseUrl}/static-assets/images/choose_option.svg`}
					/>
				)}
			</Box>
        </Paper>
    );
}

export default SiteTools;
