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

import Grid from '@mui/material/Grid';
import React from 'react';
import { Site } from '../../models/Site';
import SiteCard from '../SiteCard/SiteCard';
import LookupTable from '../../models/LookupTable';
import { PublishingStatus } from '../../models/Publishing';
import Box from '@mui/material/Box';

interface SitesGridProps {
	sites: Site[];
	onSiteClick(site: Site): void;
	onDeleteSiteClick(site: Site): void;
	onEditSiteClick(site: Site): void;
	onPublishButtonClick(
		event: React.MouseEvent<HTMLButtonElement, MouseEvent>,
		site: Site,
		status: PublishingStatus
	): void;
	onDuplicateSiteClick(siteId: string): void;
	onConfigurationClick?(site: Site): void;
	currentView: 'grid' | 'list';
	disabledSitesLookup: LookupTable<boolean>;
}

export function SitesGrid(props: SitesGridProps) {
	const {
		sites,
		onSiteClick,
		onDeleteSiteClick,
		onEditSiteClick,
		onDuplicateSiteClick,
		onConfigurationClick,
		currentView,
		onPublishButtonClick,
		disabledSitesLookup
	} = props;
	return (
		<Box component="section" sx={{ display: 'flex', flexDirection: 'column', padding: '20px' }}>
			<Grid container spacing={3}>
				{sites.map((site) => (
					<Grid key={site.id}>
						<SiteCard
							site={site}
							onSiteClick={onSiteClick}
							onDeleteSiteClick={onDeleteSiteClick}
							onEditSiteClick={onEditSiteClick}
							onDuplicateSiteClick={onDuplicateSiteClick}
							onConfigurationClick={onConfigurationClick}
							onPublishButtonClick={onPublishButtonClick}
							compact={currentView === 'list'}
							disabled={disabledSitesLookup[site.id]}
						/>
					</Grid>
				))}
			</Grid>
		</Box>
	);
}

export default SitesGrid;
