/*
 * Copyright (C) 2007-2024 Crafter Software Corporation. All Rights Reserved.
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

import React, { RefObject, useEffect, useState } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionSummary, { accordionSummaryClasses } from '@mui/material/AccordionSummary';
import ExpandMoreIcon from '@mui/icons-material/ExpandMoreRounded';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import AccordionDetails from '@mui/material/AccordionDetails';
import { ContentTypeField } from '../../models';

export interface CompareFieldPanelAccordionProps {
	field: ContentTypeField;
	details: React.ReactNode;
	selected: boolean;
	fieldRef: RefObject<HTMLDivElement>;
	summary?: React.ReactNode;
}

export function FieldAccordionPanel(props: CompareFieldPanelAccordionProps) {
	const { fieldRef, selected, summary, details } = props;
	const [expanded, setExpanded] = useState<boolean>(true);

	useEffect(() => {
		if (selected) {
			setExpanded(true);
		}
	}, [selected]);

	return (
		<Accordion
			ref={fieldRef}
			expanded={expanded}
			onChange={() => setExpanded(!expanded)}
			slotProps={{ transition: { mountOnEnter: true } }}
			sx={{
				margin: 0,
				border: 0,
				boxShadow: 'none',
				background: 'none',
				'&.Mui-expanded': {
					margin: 0,
					borderBottom: (theme) => `1px solid ${theme.palette.divider}`
				}
			}}
		>
			<AccordionSummary
				expandIcon={<ExpandMoreIcon />}
				sx={{ [`.${accordionSummaryClasses.content}`]: { justifyContent: 'space-between', alignItems: 'center' } }}
			>
				{summary ? (
					<Box
						sx={{
							width: '100%'
						}}
					>
						{summary}
					</Box>
				) : (
					<Typography>
						<Box component="span" sx={{ fontWeight: 600 }}>
							{props.field.name}{' '}
						</Box>
						({props.field.id})
					</Typography>
				)}
			</AccordionSummary>
			<AccordionDetails sx={{ py: 2 }}>{details}</AccordionDetails>
		</Accordion>
	);
}
