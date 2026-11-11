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

import React, { useState } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import ItemStateIcon from '../ItemStateIcon';
import { getItemPublishingTargetText, getItemStateText } from '../ItemDisplay/utils';
import ItemTypeIcon from '../ItemTypeIcon';
import ItemPublishingTargetIcon from '../ItemPublishingTargetIcon';
import AccordionDetails from '@mui/material/AccordionDetails';
import Accordion from '@mui/material/Accordion';
import ExpandMoreIcon from '@mui/icons-material/ExpandMoreRounded';
import { styled } from '@mui/material/styles';
import AccordionSummary, { accordionSummaryClasses } from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import { typographyClasses } from '@mui/material';
import { DisabledItemIcon } from '../DisabledItemIcon';
import { LightItem } from '../../models';

export interface IconGuideDashletProps {
	contentHeight?: number | string;
}

const messages = defineMessages({
	page: { id: 'words.page', defaultMessage: 'Page' },
	component: { id: 'words.component', defaultMessage: 'Component' },
	folder: { id: 'words.folder', defaultMessage: 'Folder' },
	levelDescriptor: { id: 'iconGuide.levelDescriptor', defaultMessage: 'Section Defaults' },
	renderingTemplate: { id: 'iconGuide.freemarker', defaultMessage: 'Freemarker Template' },
	script: { id: 'iconGuide.groovy', defaultMessage: 'Groovy Script' },
	taxonomy: { id: 'words.taxonomy', defaultMessage: 'Taxonomy' },
	image: { id: 'words.image', defaultMessage: 'Image' },
	javascript: { id: 'iconGuide.javascript', defaultMessage: 'JavaScript' },
	json: { id: 'iconGuide.json', defaultMessage: 'Json' },
	html: { id: 'iconGuide.html', defaultMessage: 'HTML' },
	css: { id: 'iconGuide.css', defaultMessage: 'CSS' },
	plainText: { id: 'iconGuide.plainText', defaultMessage: 'Plain Text' },
	xml: { id: 'iconGuide.xml', defaultMessage: 'XML' },
	font: { id: 'words.font', defaultMessage: 'Font' },
	icon: { id: 'words.icon', defaultMessage: 'Icon' },
	staged: { id: 'words.staged', defaultMessage: 'Staged' },
	live: { id: 'words.live', defaultMessage: 'Live' }
});

const states = {
	new: { stateMap: { new: true } },
	modified: { stateMap: { modified: true } },
	deleted: { stateMap: { deleted: true } },
	locked: { stateMap: { locked: true } },
	systemProcessing: { stateMap: { systemProcessing: true } },
	submittedToLive: { stateMap: { submitted: true, submittedToLive: true } },
	submittedStaging: { stateMap: { submitted: true, submittedToStaging: true } },
	scheduledToLive: { stateMap: { scheduled: true, submittedToLive: true } },
	scheduledStaging: { stateMap: { scheduled: true, submittedToStaging: true } },
	publishing: { stateMap: { publishing: true } },
	disabled: { stateMap: { disabled: true } }
};

const status = {
	staged: { stateMap: { staged: true } },
	live: { stateMap: { live: true } }
};

const types = {
	page: { systemType: 'page' },
	component: { systemType: 'component' },
	folder: { systemType: 'folder' },
	levelDescriptor: { systemType: 'levelDescriptor' },
	renderingTemplate: { systemType: 'renderingTemplate' },
	script: { systemType: 'script' },
	taxonomy: { systemType: 'taxonomy' },
	image: { systemType: 'asset', mimeType: 'image/' },
	javascript: { systemType: 'asset', mimeType: 'application/javascript' },
	json: { systemType: 'asset', mimeType: 'application/json' },
	html: { systemType: 'asset', mimeType: 'text/html' },
	css: { systemType: 'asset', mimeType: 'text/css' },
	plainText: { systemType: 'asset', mimeType: 'text/plain' },
	xml: { systemType: 'asset', mimeType: 'application/xml' },
	font: { systemType: 'asset', mimeType: 'font/ttf' },
	icon: { systemType: 'asset', mimeType: 'image/vnd.microsoft.icon' }
};

const Summary = styled(AccordionSummary)(() => {
	return {
		[`& .${accordionSummaryClasses['content']}`]: {
			alignItems: 'center'
		},
		[`&.${accordionSummaryClasses['focusVisible']}`]: {
			backgroundColor: 'inherit'
		}
	};
});

export function IconGuideDashlet(props: IconGuideDashletProps) {
	const { contentHeight } = props;
	const [expanded, setExpanded] = useState(true);
	const { formatMessage } = useIntl();
	return (
		<>
			<Accordion expanded={expanded}>
				<Summary expandIcon={<ExpandMoreIcon />} onClick={() => setExpanded(!expanded)}>
					<Typography>
						<FormattedMessage id="iconGuide.title" defaultMessage="Icon Guide" />
					</Typography>
				</Summary>
				<AccordionDetails sx={{ p: 0 }}>
					<Box
						sx={(theme) => ({
							padding: (theme) => theme.spacing(2),
							overflow: 'auto',
							height: contentHeight,
							[`& > .${typographyClasses.subtitle2}`]: {
								marginBottom: theme.spacing(1),
								'&:not(:first-child)': {
									marginTop: theme.spacing(3)
								}
							}
						})}
					>
						<Typography variant="subtitle2">
							<FormattedMessage id="iconGuide.publishingStatusTarget" defaultMessage="Publishing Status/Target" />
						</Typography>
						<Grid container spacing={2}>
							{Object.keys(status).map((key) => (
								<Grid key={key} size={{ xs: 6, sm: 4, md: 3, lg: 2 }} sx={{ display: 'flex', alignItems: 'center' }}>
									<ItemPublishingTargetIcon
										item={status[key]}
										sxs={{ root: { display: 'flex', alignItems: 'center' } }}
									/>
									<Typography variant="body2" component="span">
										{getItemPublishingTargetText(status[key].stateMap, formatMessage)}
									</Typography>
								</Grid>
							))}
						</Grid>

						<Typography variant="subtitle2">
							<FormattedMessage id="iconGuide.workflowStates" defaultMessage="Workflow States" />
						</Typography>
						<Grid container spacing={2}>
							{Object.keys(states).map((key) => (
								<Grid key={key} size={{ xs: 6, sm: 4, md: 3, lg: 2 }} sx={{ display: 'flex', alignItems: 'center' }}>
									<ItemStateIcon item={states[key]} sxs={{ root: { marginRight: (theme) => theme.spacing(1) } }} />
									<Typography variant="body2" component="span">
										{getItemStateText(states[key].stateMap, formatMessage)}
									</Typography>
								</Grid>
							))}
							<Grid size={{ xs: 6, sm: 4, md: 3, lg: 2 }} sx={{ display: 'flex', alignItems: 'center' }}>
								<DisabledItemIcon
									item={types['component'] as LightItem}
									itemTypeIconProps={{}}
									sxs={{ icon: { mr: 1 } }}
								/>
								<Typography variant="body2" component="span">
									<FormattedMessage defaultMessage="Disabled Component" />
								</Typography>
							</Grid>
							<Grid size={{ xs: 6, sm: 4, md: 3, lg: 2 }} sx={{ display: 'flex', alignItems: 'center' }}>
								<DisabledItemIcon item={types['page'] as LightItem} itemTypeIconProps={{}} sxs={{ icon: { mr: 1 } }} />
								<Typography variant="body2" component="span">
									<FormattedMessage defaultMessage="Disabled Page" />
								</Typography>
							</Grid>
						</Grid>

						<Typography variant="subtitle2">
							<FormattedMessage id="iconGuide.itemTypes" defaultMessage="Item Types" />
						</Typography>
						<Grid container spacing={2}>
							{Object.keys(types).map((key) => (
								<Grid key={key} size={{ xs: 6, sm: 4, md: 3, lg: 2 }} sx={{ display: 'flex', alignItems: 'center' }}>
									<ItemTypeIcon item={types[key]} sx={{ marginRight: (theme) => theme.spacing(1) }} />
									<Typography variant="body2" component="span">
										{formatMessage(messages[key])}
									</Typography>
								</Grid>
							))}
						</Grid>
					</Box>
				</AccordionDetails>
			</Accordion>
		</>
	);
}

export default IconGuideDashlet;
