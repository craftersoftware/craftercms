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

import org.apache.commons.configuration2.HierarchicalConfiguration;
import org.craftercms.commons.entitlements.validator.DbIntegrityValidator;
import org.craftercms.commons.upgrade.exception.UpgradeException;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v1.service.configuration.ServicesConfig;
import org.craftercms.studio.api.v2.dal.Site;
import org.craftercms.studio.api.v2.exception.repository.RepositoryException;
import org.craftercms.studio.api.v2.service.site.SitesService;
import org.craftercms.studio.api.v2.utils.GitRepositoryHelper;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import org.craftercms.studio.impl.v2.upgrade.StudioUpgradeContext;
import org.eclipse.jgit.lib.ObjectId;
import org.eclipse.jgit.lib.Repository;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.beans.ConstructorProperties;
import java.io.IOException;
import java.sql.CallableStatement;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;

import static java.lang.String.format;
import static org.apache.commons.lang3.StringUtils.isNotEmpty;
import static org.craftercms.studio.api.v1.constant.GitRepositories.PUBLISHED;
import static org.craftercms.studio.api.v1.constant.GitRepositories.SANDBOX;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.DB_SCHEMA;

public class PopulateItemTargetTableUpgradeOperation extends DbScriptUpgradeOperation {
	protected static final Logger logger = LoggerFactory.getLogger(PopulateItemTargetTableUpgradeOperation.class);

	protected static final String CONFIG_KEY_STORED_PROCEDURE_NAME = "spName";
	protected static final String SITE_CONFIG_PATH = "config/studio/site-config.xml";
	protected static final Pattern STAGING_ENABLED_PATTERN =
		Pattern.compile("<enable-staging-environment>\\s*true\\s*</enable-staging-environment>");

	protected static final String QUERY_CALL_STORED_PROCEDURE =
			"call @spName(?, ?, ?)";
	protected static final String STORED_PROCEDURE_NAME = "@spName";

	protected final SitesService sitesService;
	protected final ServicesConfig servicesConfig;
	protected final GitRepositoryHelper gitRepositoryHelper;

	protected String spName;
	protected String crafterSchemaName;

	@ConstructorProperties({"studioConfiguration", "scriptFolder", "integrityValidator",
			"siteService", "servicesConfig", "gitRepositoryHelper"})
	public PopulateItemTargetTableUpgradeOperation(StudioConfiguration studioConfiguration, String scriptFolder,
												   DbIntegrityValidator integrityValidator, SitesService sitesService,
												   ServicesConfig servicesConfig, GitRepositoryHelper gitRepositoryHelper) {
		super(studioConfiguration, scriptFolder, integrityValidator);
		this.sitesService = sitesService;
		this.servicesConfig = servicesConfig;
		this.gitRepositoryHelper = gitRepositoryHelper;
	}

	@Override
	public void doInit(HierarchicalConfiguration config) {
		super.doInit(config);
		spName = config.getString(CONFIG_KEY_STORED_PROCEDURE_NAME);
		crafterSchemaName = studioConfiguration.getProperty(DB_SCHEMA);
	}

	@Override
	public void doExecute(final StudioUpgradeContext context) throws UpgradeException {
		// create stored procedure from script (if needed)
		if (isNotEmpty(fileName)) {
			super.doExecute(context);
		}

		List<Site> allSites = sitesService.getAllSites();
		for (Site site : allSites) {
			if (site.getPublishedRepoCreated()) {
				try {
					populateItemTarget(context, site.getId(), site.getSiteId());
				} catch (SiteNotFoundException | IOException | RepositoryException e) {
					throw new UpgradeException(format("Failed to populate item_target table for site '%s'", site.getSiteId()), e);
				}
			}
		}
	}

	/**
	 * Calls the 'populate item target table' stored procedure. It takes the name from
	 * the property 'spName'.
	 * The SP is meant to read the item table and populate the item_target table for the active publishing targets
	 * for the site
	 *
	 * @param context the upgrade context
	 * @param site    the site id
	 * @param siteId  the numeric site id
	 */
	private void populateItemTarget(final StudioUpgradeContext context, long siteId, String site) throws SiteNotFoundException, IOException, UpgradeException, RepositoryException {
		String liveTarget = servicesConfig.getLiveEnvironment(site);
		Repository repository = gitRepositoryHelper.getRepository(site, PUBLISHED);
		populateItemTarget(context, siteId, site, liveTarget, repository);
		// This step runs before site.staging_enabled exists. The flag still lives in site-config.xml.
		if (isStagingEnabledInSiteConfig(site)) {
			String stagingTarget = servicesConfig.getStagingEnvironment(site);
			populateItemTarget(context, siteId, site, stagingTarget, repository);
		}
	}

	/**
	 * Read the legacy site-config.xml staging flag. Used only by this upgrade, which runs before the flag is stored in the database.
	 */
	private boolean isStagingEnabledInSiteConfig(String siteId) throws RepositoryException, IOException {
		Repository sandbox = gitRepositoryHelper.getRepository(siteId, SANDBOX);
		if (sandbox == null || sandbox.getWorkTree() == null) {
			return false;
		}
		Path configPath = sandbox.getWorkTree().toPath().resolve(SITE_CONFIG_PATH);
		if (!Files.exists(configPath)) {
			return false;
		}
		return STAGING_ENABLED_PATTERN.matcher(Files.readString(configPath)).find();
	}

	private void populateItemTarget(final StudioUpgradeContext context, long siteId, String site, String target, Repository repository) throws IOException, UpgradeException {
		ObjectId lastCommitObjectId = repository.resolve(target);
		if (lastCommitObjectId == null) {
			throw new UpgradeException(format("The target '%s' does not exist in the published repository for site '%s'", target, site));
		}
		String lastCommit = lastCommitObjectId.getName();
		logger.debug("Execute the stored procedure '{}' in site '{}' target '{}' last commit '{}", spName, site, target, lastCommit);
		final String call = QUERY_CALL_STORED_PROCEDURE.replace(STORED_PROCEDURE_NAME, spName);
		try (Connection connection = context.getConnection();
			 CallableStatement stmt = connection.prepareCall(call)) {
			stmt.setLong(1, siteId);
			stmt.setString(2, target);
			stmt.setString(3, lastCommit);
			stmt.execute();
		} catch (SQLException e) {
			logger.error("Failed to populate item_target table for site '{}' target '{}'", site, target, e);
			throw new UpgradeException(format("Failed to populate item_target table for site '%s' target '%s'", site, target), e);
		}
	}
}
