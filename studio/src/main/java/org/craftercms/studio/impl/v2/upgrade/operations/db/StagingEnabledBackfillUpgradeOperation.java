/*
 * Copyright (C) 2007-2026 Crafter Software Corporation. All Rights Reserved.
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
package org.craftercms.studio.impl.v2.upgrade.operations.db;

import org.craftercms.commons.upgrade.exception.UpgradeException;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.service.configuration.ServicesConfig;
import org.craftercms.studio.api.v2.dal.Site;
import org.craftercms.studio.api.v2.dal.publish.ItemTargetDAO;
import org.craftercms.studio.api.v2.repository.blob.StudioBlobAwareContentRepository;
import org.craftercms.studio.api.v2.service.config.ConfigurationService;
import org.craftercms.studio.api.v2.service.site.SitesService;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import org.craftercms.studio.api.v2.utils.StudioUtils;
import org.craftercms.studio.impl.v2.upgrade.StudioUpgradeContext;
import org.craftercms.studio.impl.v2.upgrade.operations.AbstractUpgradeOperation;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.beans.ConstructorProperties;
import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.List;

import static java.lang.String.format;

/**
 * Copies the legacy {@code enable-staging-environment} flag from each site's {@code site-config.xml}
 * into {@code site.staging_enabled}. When the site is already published to live, the staging branch is
 * created from live and blob-store assets are copied into the staging environment first.
 * Runs before the site-config upgrade removes the element.
 */
public class StagingEnabledBackfillUpgradeOperation extends AbstractUpgradeOperation {

	private static final Logger logger = LoggerFactory.getLogger(StagingEnabledBackfillUpgradeOperation.class);

	protected static final String UPDATE_STAGING_ENABLED =
		"UPDATE site SET staging_enabled = 1 WHERE site_id = ? AND deleted = 0 AND staging_enabled = 0";

	private final SitesService sitesService;
	private final ConfigurationService configurationService;
	private final ServicesConfig servicesConfig;
	private final StudioBlobAwareContentRepository contentRepository;
	private final ItemTargetDAO itemTargetDao;

	@ConstructorProperties({"studioConfiguration", "sitesService", "configurationService", "servicesConfig",
		"contentRepository", "itemTargetDao"})
	public StagingEnabledBackfillUpgradeOperation(StudioConfiguration studioConfiguration, SitesService sitesService,
												  ConfigurationService configurationService, ServicesConfig servicesConfig,
												  StudioBlobAwareContentRepository contentRepository, ItemTargetDAO itemTargetDao) {
		super(studioConfiguration);
		this.sitesService = sitesService;
		this.configurationService = configurationService;
		this.servicesConfig = servicesConfig;
		this.contentRepository = contentRepository;
		this.itemTargetDao = itemTargetDao;
	}

	@Override
	public void doExecute(StudioUpgradeContext context) throws UpgradeException {
		List<Site> sites = sitesService.getAllSites();
		for (Site site : sites) {
			try {
				if (StudioUtils.isLegacyStagingEnabled(site.getSiteId(), studioConfiguration, configurationService)) {
					enableStaging(context, site);
				}
			} catch (ServiceLayerException | IOException | SQLException e) {
				throw new UpgradeException(format("Failed to backfill staging for site '%s'", site.getSiteId()), e);
			}
		}
	}

	private void enableStaging(StudioUpgradeContext context, Site site) throws SQLException, ServiceLayerException, IOException {
		String siteId = site.getSiteId();
		ensureStagingMatchesLive(site);
		try (Connection connection = context.getConnection();
			 PreparedStatement statement = connection.prepareStatement(UPDATE_STAGING_ENABLED)) {
			statement.setString(1, siteId);
			int updated = statement.executeUpdate();
			connection.commit();
			if (updated > 0) {
				logger.info("Enabled staging for site '{}' from site-config.xml", siteId);
			}
		}
	}

	/**
	 * Create the staging branch from live, copy publishing rows, and sync blob-store assets when live exists.
	 * An unpublished site only receives the database flag. The branch is created on the first publish.
	 */
	private void ensureStagingMatchesLive(Site site) throws ServiceLayerException, IOException {
		String siteId = site.getSiteId();
		String liveBranch = servicesConfig.getLiveEnvironment(siteId);
		String stagingBranch = servicesConfig.getStagingEnvironment(siteId);
		if (!contentRepository.publishedRepositoryExists(siteId) || !contentRepository.isTargetPublished(siteId, liveBranch)) {
			logger.info("Site '{}' is not published to live. The staging branch and blobs will be created on the first publish", siteId);
			return;
		}
		if (contentRepository.createStagingBranchFromLive(siteId, liveBranch, stagingBranch)) {
			logger.info("Created staging branch '{}' from '{}' for site '{}'", stagingBranch, liveBranch, siteId);
		}
		if (!itemTargetDao.targetExists(site.getId(), stagingBranch)) {
			itemTargetDao.initStaging(site.getId(), stagingBranch, liveBranch);
		}
		contentRepository.copyBlobs(siteId, liveBranch, stagingBranch);
	}
}
