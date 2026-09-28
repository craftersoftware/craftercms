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

import AppBar from '@mui/material/AppBar';
import Toolbar, { ToolbarProps } from '@mui/material/Toolbar';
import React, { forwardRef, PropsWithChildren, Ref } from 'react';
import { PartialSxRecord } from '../../models';
import { Theme } from '@mui/material';
import { SystemStyleObject } from '@mui/system/styleFunctionSx';
import { consolidateSx } from '../../utils/system';

export type ViewToolbarClassKey = 'appBar' | 'toolbar';

export type ViewToolbarProps = PropsWithChildren<{
	elevation?: number;
	classes?: Partial<Record<ViewToolbarClassKey, string>>;
	sxs?: PartialSxRecord<ViewToolbarClassKey>;
	slotProps?: Partial<{ toolbar: Partial<ToolbarProps> }>;
}>;

const ViewToolbar = forwardRef<HTMLDivElement, ViewToolbarProps>(function (props, ref) {
	const { children, elevation = 0, sxs, slotProps } = props;
	return (
		<AppBar
			ref={ref}
			color="inherit"
			position="relative"
			elevation={elevation}
			className={props.classes?.appBar}
			sx={(theme) => ({
				borderBottom: `1px solid ${theme.palette.divider}`,
				background: theme.palette.background.paper,
				color: theme.palette.text.primary,
				...(sxs?.appBar as SystemStyleObject<Theme>)
			})}
		>
			<Toolbar
				{...slotProps?.toolbar}
				className={props.classes?.toolbar}
				sx={consolidateSx(
					(theme) => ({
						paddingLeft: `${theme.spacing(1.5)} !important`,
						paddingRight: `${theme.spacing(1.5)} !important`,
						placeContent: 'center space-between',
						'& > section': {
							display: 'flex',
							alignItems: 'center'
						},
						...(sxs?.toolbar as SystemStyleObject<Theme>)
					}),
					slotProps?.toolbar?.sx
				)}
			>
				{children}
			</Toolbar>
		</AppBar>
	);
});

const Memo = React.memo<ViewToolbarProps & { ref?: Ref<HTMLDivElement> }>(ViewToolbar);

export { Memo as ViewToolbar };

export default Memo;
