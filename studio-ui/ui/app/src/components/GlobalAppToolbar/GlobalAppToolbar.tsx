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

import React from 'react';
import Typography from '@mui/material/Typography';
import LauncherOpenerButton from '../LauncherOpenerButton';
import LogoAndMenuBundleButton from '../LogoAndMenuBundleButton';
import { defineMessages, useIntl } from 'react-intl';
import ViewToolbar, { ViewToolbarClassKey } from '../ViewToolbar/ViewToolbar';
import { useGlobalAppState } from '../GlobalApp';
import { PartialSxRecord } from '../../models';
import Box from '@mui/material/Box';
import { typographyClasses } from '@mui/material';

export type GlobalAppToolbarClassKey =
	ViewToolbarClassKey | 'headings' | 'subtitle' | 'leftContent' | 'rightContent' | 'ellipsis';

export interface GlobalAppToolbarProps {
	elevation?: number;
	title?: React.ReactNode;
	subtitle?: React.ReactNode;
	leftContent?: React.ReactNode;
	rightContent?: React.ReactNode;
	classes?: Partial<Record<GlobalAppToolbarClassKey, string>>;
	sxs?: PartialSxRecord<GlobalAppToolbarClassKey>;
	startContent?: React.ReactNode;
	showHamburgerMenuButton?: boolean;
	showAppsButton?: boolean;
}

const translations = defineMessages({
	toggleSidebar: {
		id: 'globalAppToolbar.toggleSidebar',
		defaultMessage: 'Toggle Sidebar'
	}
});

export const GlobalAppToolbar = React.memo<GlobalAppToolbarProps>(function (props) {
	const {
		title,
		subtitle,
		leftContent,
		rightContent,
		showHamburgerMenuButton = true,
		showAppsButton = true,
		startContent,
		sxs
	} = props;
	const { formatMessage } = useIntl();
	const [{ openSidebar }, setState] = useGlobalAppState();

	return (
		<ViewToolbar
			elevation={props.elevation}
			classes={props.classes}
			sxs={{
				appBar: sxs?.appBar,
				toolbar: sxs?.toolbar
			}}
		>
			{showHamburgerMenuButton && Boolean(setState) && (
				<LogoAndMenuBundleButton
					showCrafterIcon={showAppsButton}
					aria-label={formatMessage(translations.toggleSidebar)}
					onClick={() => setState({ openSidebar: !openSidebar })}
				/>
			)}
			{startContent}
			{Boolean(title || subtitle) && (
				<Box
					component="section"
					className={props.classes?.headings}
					sx={{
						marginLeft: '10px',
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'flex-start!important',
						overflow: 'hidden',
						[`& .${typographyClasses.root}`]: {
							overflow: 'hidden',
							textOverflow: 'ellipsis',
							whiteSpace: 'nowrap'
						},
						...sxs?.headings
					}}
				>
					{title && (
						<Typography
							variant="h5"
							component="h1"
							className={props.classes?.ellipsis}
							sx={{
								overflow: 'hidden',
								textOverflow: 'ellipsis',
								whiteSpace: 'nowrap',
								...sxs?.ellipsis
							}}
						>
							{title}
						</Typography>
					)}
					{subtitle && (
						<Typography
							variant="body2"
							component="h2"
							color="textSecondary"
							className={props.classes?.subtitle}
							sx={sxs?.subtitle}
						>
							{subtitle}
						</Typography>
					)}
				</Box>
			)}
			<Box
				component="section"
				className={props.classes?.leftContent}
				sx={{
					marginLeft: '25px',
					display: 'flex',
					alignItems: 'center',
					whiteSpace: 'nowrap',
					...sxs?.leftContent
				}}
			>
				{leftContent}
			</Box>
			<Box
				component="section"
				className={props.classes?.rightContent}
				sx={{
					marginLeft: 'auto',
					display: 'flex',
					alignItems: 'center',
					whiteSpace: 'nowrap',
					...sxs?.rightContent
				}}
			>
				{rightContent}
			</Box>
			{showAppsButton && <LauncherOpenerButton />}
		</ViewToolbar>
	);
});

export default GlobalAppToolbar;
