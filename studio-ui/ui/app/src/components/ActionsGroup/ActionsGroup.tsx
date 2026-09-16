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

import * as React from 'react';
import { forwardRef, useState } from 'react';
import { MenuItem, StandardProps } from '@mui/material';
import Fab from '@mui/material/Fab';
import Menu from '@mui/material/Menu';
import Button from '@mui/material/Button';

import { ContextMenuOption } from '../ContextMenu';
import { PartialSxRecord } from '../../models';
import Box from '@mui/material/Box';

export type ActionsGroupPropsClassKey = 'root' | 'action' | 'more';

export interface ActionsGroupProps extends StandardProps<
	React.HTMLAttributes<HTMLDivElement>,
	ActionsGroupPropsClassKey
> {
	max?: number;
	spacing?: 'small' | 'medium' | number;
	onActionClicked(id: string, event: React.MouseEvent<Element, MouseEvent>): void;
	actions: Array<ContextMenuOption>;
	sxs?: PartialSxRecord<'root' | 'action'>;
}

const SPACINGS = {
	small: 5,
	medium: 10
};

const ActionsGroup = forwardRef<HTMLDivElement, ActionsGroupProps>(function ActionsGroup(props, ref) {
	const { actions, classes: propClasses, className, max = 5, spacing, onActionClicked, sxs, ...other } = props;
	const clampedMax = max < 2 ? 2 : max;
	const extraActions = actions.length > clampedMax ? actions.length - clampedMax + 1 : 0;
	const marginLeft = spacing && SPACINGS[spacing] !== undefined ? SPACINGS[spacing] : spacing;
	const [showMenu, setShowMenu] = useState<any>();
	return (
		<Box className={[className, propClasses?.root].filter(Boolean).join(' ')} sx={sxs?.root} {...other} ref={ref}>
			{actions.slice(0, actions.length - extraActions).map((child, index) => (
				<Button
					key={child.id}
					onClick={(e) => onActionClicked?.(child.id, e)}
					style={{ marginLeft: index === 0 ? undefined : marginLeft }}
					className={propClasses?.action}
					sx={{
						minWidth: '40px',
						...sxs?.action
					}}
					color="primary"
					variant="text"
					size="small"
				>
					{child.label}
				</Button>
			))}
			{extraActions ? (
				<Fab
					onClick={(e) => {
						setShowMenu(e.target);
					}}
					size="small"
					variant="extended"
					color="inherit"
					className={propClasses?.more}
					style={{
						marginLeft
					}}
				>
					+{extraActions}
				</Fab>
			) : null}
			<Menu open={Boolean(showMenu)} anchorEl={showMenu} onClose={() => setShowMenu(void 0)}>
				{actions.slice(actions.length - extraActions).map((child) => (
					<MenuItem
						key={child.id}
						onClick={(e) => {
							setShowMenu(void 0);
							onActionClicked?.(child.id, e);
						}}
					>
						{child.label}
					</MenuItem>
				))}
			</Menu>
		</Box>
	);
});

export default ActionsGroup;
