/*
 * Copyright (C) 2007-2025 Crafter Software Corporation. All Rights Reserved.
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

import AccordionSummary, { AccordionSummaryProps } from '@mui/material/AccordionSummary';
import Typography from '@mui/material/Typography';
import AccordionDetails, { AccordionDetailsProps } from '@mui/material/AccordionDetails';
import type { AccordionProps } from '@mui/material/Accordion';
import Accordion from '@mui/material/Accordion';
import type { TransitionProps } from '@mui/material/transitions';
import React, { ReactNode, useContext } from 'react';
import { ContentTypeSection } from '../../../models';
import { useTheme } from '@mui/material/styles';
import { StableFormContext } from '../lib/formsEngineContext';
import { useAtom } from 'jotai';
import { consolidateSx } from '../../../utils/system';
import { isDarkModeTheme } from '../../../hooks/useIsDarkModeTheme';

export interface SectionAccordionProps extends Omit<AccordionProps, 'slotProps' | 'children'> {
	children?: ReactNode;
	colorize?: boolean;
	section: ContentTypeSection;
	renderControl(fieldId: string, fieldIndex: number): ReactNode;
	slotProps?: Partial<{
		accordionSummary: Partial<AccordionSummaryProps>;
		accordionDetails: Partial<AccordionDetailsProps>;
		transition: Partial<TransitionProps>;
	}>;
}

export function SectionAccordion({
	section,
	renderControl,
	children,
	slotProps,
	colorize = true,
	...accordionProps
}: SectionAccordionProps) {
	const theme = useTheme();
	const isDarkMode = isDarkModeTheme(theme);
	const [isExpanded, setExpanded] = useAtom(useContext(StableFormContext).atoms.expandedStateBySectionId[section.id]);
	return (
		<Accordion
			elevation={isDarkMode ? 2 : undefined}
			{...accordionProps}
			expanded={isExpanded}
			onChange={(e, expanded) => setExpanded(expanded)}
			slotProps={slotProps?.transition ? { transition: slotProps.transition } : undefined}
			sx={consolidateSx(
				colorize &&
					section.color && {
						position: 'relative',
						borderLeftColor: section.color,
						borderLeftWidth: 5,
						borderLeftStyle: 'solid',
						borderTopLeftRadius: theme.shape.borderRadius,
						borderBottomLeftRadius: theme.shape.borderRadius,
						borderTopRightRadius: theme.shape.borderRadius,
						borderBottomRightRadius: theme.shape.borderRadius
					},
				accordionProps.sx
			)}
		>
			<AccordionSummary {...slotProps?.accordionSummary} data-section-id={section.id}>
				<Typography>{section.title}</Typography>
				{slotProps?.accordionSummary?.children}
			</AccordionSummary>
			<AccordionDetails className="space-y-2" {...slotProps?.accordionDetails}>
				{section.fields.map(renderControl)}
				{slotProps?.accordionDetails?.children}
			</AccordionDetails>
			{children}
		</Accordion>
	);
}

export default SectionAccordion;
