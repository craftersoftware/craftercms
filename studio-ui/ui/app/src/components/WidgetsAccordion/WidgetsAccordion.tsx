/*
 * Copyright (C) 2007-2023 Crafter Software Corporation. All Rights Reserved.
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
import { useEffect, useState } from 'react';
import ExpandMore from '@mui/icons-material/ExpandMoreOutlined';
import Accordion, { accordionClasses } from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary, { accordionSummaryClasses } from '@mui/material/AccordionSummary';
import Typography from '@mui/material/Typography';
import { SxProps, Theme, useTheme } from '@mui/material/styles';
import WidgetDescriptor from '../../models/WidgetDescriptor';
import { SystemIcon, SystemIconDescriptor } from '../SystemIcon';
import WidgetsGrid from '../WidgetsGrid';
import { getStoredWidgetsAccordion, setStoredWidgetsAccordion } from '../../utils/state';
import useActiveSite from '../../hooks/useActiveSite';
import useActiveUser from '../../hooks/useActiveUser';

export interface WidgetsAccordionProps {
	id?: string;
	title: string;
	initialExpanded?: boolean;
	widgets: WidgetDescriptor[];
	icon?: SystemIconDescriptor;
	sxs?: Partial<
		Record<
			'accordion' | 'accordionSummary' | 'accordionDetails' | 'widgetsGrid' | 'typography' | 'icon',
			SxProps<Theme>
		>
	>;
}

export function WidgetsAccordion(props: WidgetsAccordionProps) {
	const {
		title,
		id = `WidgetsAccordion:${props.title.replace(/\s/g, '')}`,
		icon,
		sxs,
		initialExpanded = false
	} = props;
	const { uuid } = useActiveSite();
	const user = useActiveUser();
	const [open, setOpen] = useState(() => getStoredWidgetsAccordion(uuid, user.username, id)?.open ?? initialExpanded);
	const theme = useTheme();
	const expandedClass = accordionClasses.expanded;
	const contentClass = accordionSummaryClasses.content;
	useEffect(() => {
		if (id) {
			setStoredWidgetsAccordion(uuid, user.username, id, { open });
		}
	}, [id, open, user.username, uuid]);
	return (
		<Accordion
			square
			disableGutters
			elevation={0}
			expanded={open}
			onChange={(e, isExpanded) => setOpen(isExpanded)}
			sx={{
				boxShadow: 0,
				backgroundColor: 'inherit',
				[`&.${expandedClass}`]: { margin: 'inherit' },
				...sxs?.accordion
			}}
		>
			<AccordionSummary
				expandIcon={<ExpandMore />}
				sx={{
					alignItems: 'center',
					[`&, &.${expandedClass}`]: { minHeight: '48px' },
					[`.${contentClass}, .${contentClass}.${expandedClass}`]: { margin: 0 },
					...sxs?.accordionSummary
				}}
			>
				{icon && (
					<SystemIcon icon={icon} sx={{ marginRight: '10px', color: theme.palette.action.active, ...sxs?.icon }} />
				)}
				<Typography sx={sxs?.typography}>{title}</Typography>
			</AccordionSummary>
			<AccordionDetails sx={{ padding: 0, ...sxs?.accordionDetails }}>
				<WidgetsGrid
					container
					spacing={0}
					widgets={props.widgets}
					sx={{ flexDirection: 'column', ...sxs?.widgetsGrid }}
				/>
			</AccordionDetails>
		</Accordion>
	);
}

export default WidgetsAccordion;
