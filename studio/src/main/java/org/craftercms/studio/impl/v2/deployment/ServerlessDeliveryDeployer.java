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
import org.craftercms.commons.rest.RestTemplate;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v1.service.configuration.ServicesConfig;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
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
		if (isServerlessDeliveryEnabled()) {
			String environment = studioConfiguration.getProperty(SERVERLESS_DELIVERY_DEPLOYER_TARGET_ENV);
			doDeleteTarget(site, environment);
			doDeleteTarget(stagingSiteName(site), environment);
		}
	}

	@Override
	public void createStagingTarget(String site) throws RestClientException {
		if (!isServerlessDeliveryEnabled()) {
			return;
		}
		String stagingSiteName = stagingSiteName(site);
		String localRepoPath = getRepoUrl(SERVERLESS_DELIVERY_DEPLOYER_TARGET_LOCAL_REPO_PATH, stagingSiteName);
		String repoUrl = getRepoUrl(SERVERLESS_DELIVERY_DEPLOYER_TARGET_REMOTE_REPO_URL, site);
		String template = studioConfiguration.getProperty(SERVERLESS_DELIVERY_DEPLOYER_TARGET_TEMPLATE);
		boolean replace = studioConfiguration.getProperty(SERVERLESS_DELIVERY_DEPLOYER_TARGET_REPLACE,
			Boolean.class, false);
		HierarchicalConfiguration<ImmutableNode> templateParams =
			studioConfiguration.getSubConfig(SERVERLESS_DELIVERY_DEPLOYER_TARGET_TEMPLATE_PARAMS);

		doCreateTarget(stagingSiteName, studioConfiguration.getProperty(SERVERLESS_DELIVERY_DEPLOYER_TARGET_ENV),
			template, replace, false, localRepoPath, repoUrl, stagingBranch(site), templateParams);
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
