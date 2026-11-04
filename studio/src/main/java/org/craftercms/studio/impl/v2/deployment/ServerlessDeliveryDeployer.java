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
package org.craftercms.studio.impl.v2.deployment;

import org.apache.commons.configuration2.HierarchicalConfiguration;
import org.apache.commons.configuration2.tree.ImmutableNode;
import org.craftercms.commons.rest.RestServiceException;
import org.craftercms.commons.rest.RestTemplate;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v1.service.configuration.ServicesConfig;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClientException;

import java.util.Map;

import static org.craftercms.studio.api.v1.constant.StudioConstants.CONFIG_SITEENV_VARIABLE;
import static org.craftercms.studio.api.v1.constant.StudioConstants.CONFIG_SITENAME_VARIABLE;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.*;

/**
 * Implementation of {@link org.craftercms.studio.api.v2.deployment.Deployer} that interacts with the Serverless
 * Delivery {@link org.craftercms.studio.api.v2.deployment.Deployer}, only if serverless delivery is enabled.
 *
 * @author avasquez
 */
public class ServerlessDeliveryDeployer extends AbstractDeployer {

	public static final String STAGING_TARGET_SUFFIX = "-staging";

	private static final Logger logger = LoggerFactory.getLogger(ServerlessDeliveryDeployer.class);

	private ServicesConfig servicesConfig;

	public ServerlessDeliveryDeployer(final StudioConfiguration studioConfiguration, final RestTemplate restTemplate) {
		super(studioConfiguration, restTemplate);
	}

	/**
	 * Injected lazily. {@code sitesServiceInternal} constructs the deployer graph, and
	 * {@code ServicesConfig} eventually needs that same bean, so eager injection loops.
	 */
	@Autowired
	public void setServicesConfig(@Lazy ServicesConfig servicesConfig) {
		this.servicesConfig = servicesConfig;
	}

	@Override
	public void createTargets(String site) throws RestClientException {
		if (isServerlessDeliveryEnabled()) {
			String localRepoPath = getRepoUrl(SERVERLESS_DELIVERY_DEPLOYER_TARGET_LOCAL_REPO_PATH, site);
			String repoUrl = getRepoUrl(SERVERLESS_DELIVERY_DEPLOYER_TARGET_REMOTE_REPO_URL, site);
			String template = studioConfiguration.getProperty(SERVERLESS_DELIVERY_DEPLOYER_TARGET_TEMPLATE);
			boolean replace = studioConfiguration.getProperty(SERVERLESS_DELIVERY_DEPLOYER_TARGET_REPLACE,
				Boolean.class, false);
			HierarchicalConfiguration<ImmutableNode> templateParams =
				studioConfiguration.getSubConfig(SERVERLESS_DELIVERY_DEPLOYER_TARGET_TEMPLATE_PARAMS);

			doCreateTarget(site, studioConfiguration.getProperty(SERVERLESS_DELIVERY_DEPLOYER_TARGET_ENV),
				template, replace, false, localRepoPath, repoUrl, templateParams);
		}
	}

	@Override
	public void deleteTargets(String site) throws RestClientException {
		if (!isServerlessDeliveryEnabled()) {
			return;
		}
		String environment = studioConfiguration.getProperty(SERVERLESS_DELIVERY_DEPLOYER_TARGET_ENV);
		doDeleteTarget(site, environment);
		if (shouldDeleteStagingTarget(site)) {
			deleteStagingTargetIfExists(site, environment);
		}
	}

	/**
	 * A staging target exists only when staging is enabled.
	 * Failed site creation rolls the site row back before cleanup, so a missing site can still have a staging
	 * target. Attempt the delete in that case. {@link #deleteStagingTargetIfExists} ignores a 404 when it was
	 * never created.
	 */
	protected boolean shouldDeleteStagingTarget(String site) {
		try {
			if (servicesConfig.isStagingEnvironmentEnabled(site)) {
				return true;
			}
			logger.debug("Skip staging deployer target delete for site '{}'. Staging is not enabled", site);
			return false;
		} catch (SiteNotFoundException e) {
			logger.debug("Site '{}' was not found while deleting deployer targets. The staging target will be removed if it exists",
				site, e);
			return true;
		}
	}

	/**
	 * Delete the staging target. A 404 means it was never created, which is expected for a failed site creation
	 * that did not get that far and must not fail site deletion or cleanup.
	 */
	protected void deleteStagingTargetIfExists(String site, String environment) {
		try {
			doDeleteTarget(stagingSiteName(site), environment);
		} catch (RestClientException e) {
			if (!isNotFound(e)) {
				throw e;
			}
			logger.debug("Staging deployer target for site '{}' does not exist", site);
		}
	}

	/**
	 * The deployer client reports HTTP errors as {@link RestServiceException}, not {@link HttpStatusCodeException}.
	 */
	protected boolean isNotFound(RestClientException exception) {
		return hasStatus(exception, HttpStatus.NOT_FOUND);
	}

	/**
	 * Deployer returns 409 when {@code replace} is false and the target is already there.
	 */
	protected boolean isConflict(RestClientException exception) {
		return hasStatus(exception, HttpStatus.CONFLICT);
	}

	/**
	 * The deployer client reports HTTP errors as {@link RestServiceException}, not {@link HttpStatusCodeException}.
	 */
	protected boolean hasStatus(RestClientException exception, HttpStatusCode expected) {
		HttpStatusCode status = null;
		if (exception instanceof RestServiceException restServiceException) {
			status = restServiceException.getResponseStatus();
		} else if (exception instanceof HttpStatusCodeException httpStatusCodeException) {
			status = httpStatusCodeException.getStatusCode();
		}
		return status != null && status.isSameCodeAs(expected);
	}

	/**
	 * Create the staging target if it is missing. {@code replace} stays false even when the live-target setting is
	 * true, so a later publish does not rebuild the target. An existing target (409) is success.
	 */
	@Override
	public void createStagingTarget(String site) throws RestClientException {
		if (!isServerlessDeliveryEnabled()) {
			return;
		}
		String stagingSiteName = stagingSiteName(site);
		String localRepoPath = getRepoUrl(SERVERLESS_DELIVERY_DEPLOYER_TARGET_LOCAL_REPO_PATH, stagingSiteName);
		String repoUrl = getRepoUrl(SERVERLESS_DELIVERY_DEPLOYER_TARGET_REMOTE_REPO_URL, site);
		String template = studioConfiguration.getProperty(SERVERLESS_DELIVERY_DEPLOYER_TARGET_TEMPLATE);
		HierarchicalConfiguration<ImmutableNode> templateParams =
			studioConfiguration.getSubConfig(SERVERLESS_DELIVERY_DEPLOYER_TARGET_TEMPLATE_PARAMS);

		try {
			doCreateTarget(stagingSiteName, studioConfiguration.getProperty(SERVERLESS_DELIVERY_DEPLOYER_TARGET_ENV),
				template, false, false, localRepoPath, repoUrl, stagingBranch(site), templateParams);
		} catch (RestClientException e) {
			if (!isConflict(e)) {
				throw e;
			}
			logger.debug("Staging deployer target for site '{}' already exists", site);
		}
	}

	@Override
	public void deleteStagingTarget(String site) throws RestClientException {
		if (isServerlessDeliveryEnabled()) {
			doDeleteTarget(stagingSiteName(site), studioConfiguration.getProperty(SERVERLESS_DELIVERY_DEPLOYER_TARGET_ENV));
		}
	}

	@Override
	public void duplicateStagingTarget(String sourceSiteId, String siteId) {
		if (!isServerlessDeliveryEnabled()) {
			return;
		}
		String stagingSiteName = stagingSiteName(siteId);
		String localRepoPath = getRepoUrl(SERVERLESS_DELIVERY_DEPLOYER_TARGET_LOCAL_REPO_PATH, stagingSiteName);
		String repoUrl = getRepoUrl(SERVERLESS_DELIVERY_DEPLOYER_TARGET_REMOTE_REPO_URL, siteId);
		String template = studioConfiguration.getProperty(SERVERLESS_DELIVERY_DEPLOYER_TARGET_TEMPLATE);
		boolean replace = studioConfiguration.getProperty(SERVERLESS_DELIVERY_DEPLOYER_TARGET_REPLACE,
			Boolean.class, false);
		HierarchicalConfiguration<ImmutableNode> templateParams =
			studioConfiguration.getSubConfig(SERVERLESS_DELIVERY_DEPLOYER_TARGET_TEMPLATE_PARAMS);
		doDuplicateTarget(stagingSiteName(sourceSiteId), stagingSiteName, studioConfiguration.getProperty(SERVERLESS_DELIVERY_DEPLOYER_TARGET_ENV),
			template, replace, false, localRepoPath, repoUrl, stagingBranch(siteId), templateParams);
	}

	protected String stagingSiteName(String site) {
		return site + STAGING_TARGET_SUFFIX;
	}

	protected String stagingBranch(String site) {
		try {
			return servicesConfig.getStagingEnvironment(site);
		} catch (SiteNotFoundException e) {
			throw new IllegalStateException("Failed to resolve the staging branch for site '" + site + "'", e);
		}
	}

	@Override
	public void duplicateTargets(String sourceSiteId, String siteId) {
		if (isServerlessDeliveryEnabled()) {
			String localRepoPath = getRepoUrl(SERVERLESS_DELIVERY_DEPLOYER_TARGET_LOCAL_REPO_PATH, siteId);
			String repoUrl = getRepoUrl(SERVERLESS_DELIVERY_DEPLOYER_TARGET_REMOTE_REPO_URL, siteId);
			String template = studioConfiguration.getProperty(SERVERLESS_DELIVERY_DEPLOYER_TARGET_TEMPLATE);
			boolean replace = studioConfiguration.getProperty(SERVERLESS_DELIVERY_DEPLOYER_TARGET_REPLACE,
				Boolean.class, false);
			HierarchicalConfiguration<ImmutableNode> templateParams =
				studioConfiguration.getSubConfig(SERVERLESS_DELIVERY_DEPLOYER_TARGET_TEMPLATE_PARAMS);
			doDuplicateTarget(sourceSiteId, siteId, studioConfiguration.getProperty(SERVERLESS_DELIVERY_DEPLOYER_TARGET_ENV),
				template, replace, false, localRepoPath, repoUrl, templateParams);
		}
	}

	@Override
	protected Map<String, Object> getSourceTemplateParams(String sourceSiteId) {
		Map<String, Object> sourceParams = super.getSourceTemplateParams(sourceSiteId);

		HierarchicalConfiguration<ImmutableNode> templateParams =
			studioConfiguration.getSubConfig(SERVERLESS_DELIVERY_DEPLOYER_TARGET_TEMPLATE_PARAMS);
		addChildParams(sourceParams, templateParams.getNodeModel().getNodeHandler().getRootNode(),
			templateParams.getInterpolator());
		String sourceLocalRepoPath = getRepoUrl(SERVERLESS_DELIVERY_DEPLOYER_TARGET_LOCAL_REPO_PATH, sourceSiteId);
		sourceParams.put(LOCAL_REPO_PATH_TEMPLATE_PARAM, sourceLocalRepoPath);

		return sourceParams;
	}

	@Override
	protected String getCreateTargetUrl() {
		return studioConfiguration.getProperty(SERVERLESS_DELIVERY_DEPLOYER_TARGET_CREATE_URL);
	}

	@Override
	protected String getDeleteTargetUrl(String site, String environment) {
		return studioConfiguration.getProperty(SERVERLESS_DELIVERY_DEPLOYER_TARGET_DELETE_URL)
			.replaceAll(CONFIG_SITENAME_VARIABLE, site)
			.replaceAll(CONFIG_SITEENV_VARIABLE, environment);
	}

	protected boolean isServerlessDeliveryEnabled() {
		return studioConfiguration.getProperty(SERVERLESS_DELIVERY_ENABLED, Boolean.class, false);
	}

}
