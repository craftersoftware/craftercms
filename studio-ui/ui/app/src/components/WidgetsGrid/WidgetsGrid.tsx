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

import Grid, { GridProps } from '@mui/material/Grid';
import React from 'react';
import { renderWidgets } from '../Widget/renderWidgets';
import { WidgetDescriptor } from '../../models';
import useActiveSiteId from '../../hooks/useActiveSiteId';
import useActiveUser from '../../hooks/useActiveUser';

export interface WidgetsGridProps extends GridProps {
	widgets: WidgetDescriptor[];
}

export function WidgetsGrid(props: WidgetsGridProps) {
	const { widgets, ...gridProps } = props;
	const site = useActiveSiteId();
	const user = useActiveUser();
	const userRoles = user.rolesBySite[site];
	return <Grid {...gridProps}>{renderWidgets(widgets, { userRoles })}</Grid>;
}

export default WidgetsGrid;
