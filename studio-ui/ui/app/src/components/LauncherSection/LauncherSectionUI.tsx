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
import { renderWidgets } from '../Widget/renderWidgets';
import { PartialSxRecord, WidgetDescriptor } from '../../models';
import React, { PropsWithChildren } from 'react';
import TranslationOrText from '../../models/TranslationOrText';
import { EnhancedUser } from '../../models/User';
import { FormatXMLElementFn, PrimitiveType } from 'intl-messageformat';
import { usePossibleTranslation } from '../../hooks/usePossibleTranslation';
import Box from '@mui/material/Box';

export type LauncherSectionUIClassKey = 'title' | 'nav';

export type LauncherSectionUIProps = PropsWithChildren<{
	title: TranslationOrText;
	user?: EnhancedUser;
	site?: string;
	widgets?: WidgetDescriptor[];
	// TODO: Fix FormatXMLElementFn generics
	translationValues?: Record<string, PrimitiveType | FormatXMLElementFn<any, any>>;
	classes?: Partial<Record<LauncherSectionUIClassKey, string>>;
	sxs?: PartialSxRecord<LauncherSectionUIClassKey>;
}>;

export function LauncherSectionUI(props: LauncherSectionUIProps) {
	const title = usePossibleTranslation(props.title, props.translationValues);
	const { children, sxs } = props;
	return (
		<>
			{title && (
				<Typography
					variant="subtitle1"
					component="h2"
					className={props.classes?.title}
					sx={{
						textTransform: 'uppercase',
						fontWeight: 600,
						margin: '0 0 10px 0',
						'& > .muted': {
							textTransform: 'none',
							marginLeft: '0.315em',
							color: (theme) => theme.palette.text.secondary
						},
						...sxs?.title
					}}
				>
					{title}
				</Typography>
			)}
			<Box
				component="nav"
				className={props.classes?.nav}
				sx={{
					display: 'flex',
					flexWrap: 'wrap',
					...sxs?.nav
				}}
			>
				{children ? children : renderWidgets(props.widgets, { userRoles: props.user.rolesBySite[props.site] })}
			</Box>
		</>
	);
}

export default LauncherSectionUI;
