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

import React, { ReactNode } from 'react';
import LanguageRounded from '@mui/icons-material/LanguageRounded';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import MoreVertIcon from '@mui/icons-material/MoreVertRounded';
import AccordionSummary, { accordionSummaryClasses } from '@mui/material/AccordionSummary';
import SystemIcon, { SystemIconDescriptor } from '../SystemIcon';
import { SxProps } from '@mui/system';
import { Theme } from '@mui/material';
import { PartialSxRecord } from '../../models';
import Box from '@mui/material/Box';
import { SystemStyleObject } from '@mui/system/styleFunctionSx';

export type PathNavigatorHeaderClassKey = 'root' | 'content';

export interface PathNavigatorHeaderProps {
	locale: string;
	title: ReactNode;
	icon?: SystemIconDescriptor & Partial<{ expandedStyle: {}; collapsedStyle: {} }>;
	collapsed: boolean;
	onLanguageMenu?(anchor: Element): void;
	onMenuButtonClick?(anchor: Element): void;
	menuButtonIcon?: ReactNode;
	className?: string;
	classes?: Partial<Record<PathNavigatorHeaderClassKey, string>>;
	sx?: SxProps<Theme>;
	sxs?: PartialSxRecord<PathNavigatorHeaderClassKey>;
}

// PathNavigatorHeader
export function PathNavigatorHeader(props: PathNavigatorHeaderProps) {
	const {
		title,
		icon,
		locale,
		onLanguageMenu,
		onMenuButtonClick,
		menuButtonIcon = <MoreVertIcon />,
		collapsed = false,
		className,
		sx,
		sxs
	} = props;
	const currentFlag = (locale: string) => <LanguageRounded />;
	return (
		<AccordionSummary
			className={className}
			classes={{
				root: props.classes?.root,
				content: props.classes?.content
			}}
			sx={{
				...(sx as SystemStyleObject<Theme>),
				...sxs?.root,
				[`& .${accordionSummaryClasses.content}`]: {
					alignItems: 'center',
					placeContent: 'center space-between',
					'&, &.Mui-expanded': {
						margin: 0
					},
					...sxs?.content
				}
			}}
		>
			<Box sx={{ display: 'flex', alignItems: 'center' }}>
				{icon && (
					<SystemIcon
						icon={icon}
						sx={{ color: (theme) => theme.palette.action.active, marginRight: '10px' }}
						style={icon[collapsed ? 'collapsedStyle' : 'expandedStyle']}
					/>
				)}
				<Typography variant="body1" component="h6" sx={{ flexGrow: 1 }} children={title} />
			</Box>
			<Box>
				{onLanguageMenu && (
					<IconButton
						aria-label="language select"
						onClick={(e) => {
							e.stopPropagation();
							onLanguageMenu(e.currentTarget);
						}}
						size="small"
					>
						{currentFlag(locale)}
					</IconButton>
				)}
				{onMenuButtonClick && (
					<IconButton
						aria-label="options"
						onClick={(e) => {
							e.stopPropagation();
							onMenuButtonClick(e.currentTarget);
						}}
						size="small"
					>
						{menuButtonIcon}
					</IconButton>
				)}
			</Box>
		</AccordionSummary>
	);
}

export default PathNavigatorHeader;
