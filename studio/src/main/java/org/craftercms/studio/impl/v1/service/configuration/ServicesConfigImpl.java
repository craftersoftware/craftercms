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
package org.craftercms.studio.impl.v1.service.configuration;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.apache.commons.collections.CollectionUtils;
import org.apache.commons.lang3.StringUtils;
import org.craftercms.commons.validation.annotations.param.ValidateStringParam;
import org.craftercms.core.util.XmlUtils;
import static org.craftercms.studio.api.v1.constant.StudioConstants.DEFAULT_CONFIG_URL;
import static org.craftercms.studio.api.v1.constant.StudioConstants.MODULE_STUDIO;
import static org.craftercms.studio.api.v1.constant.StudioConstants.SITE_CONFIG_ELEMENT_ADMIN_EMAIL_ADDRESS;
import static org.craftercms.studio.api.v1.constant.StudioConstants.SITE_CONFIG_ELEMENT_AUTHORING_URL;
import static org.craftercms.studio.api.v1.constant.StudioConstants.SITE_CONFIG_ELEMENT_LIVE_URL;
import static org.craftercms.studio.api.v1.constant.StudioConstants.SITE_CONFIG_ELEMENT_PLUGIN_FOLDER_PATTERN;
import static org.craftercms.studio.api.v1.constant.StudioConstants.SITE_CONFIG_ELEMENT_SITE_URLS;
import static org.craftercms.studio.api.v1.constant.StudioConstants.SITE_CONFIG_XML_ELEMENT_CONTENT_MONITORING;
import static org.craftercms.studio.api.v1.constant.StudioConstants.SITE_CONFIG_XML_ELEMENT_ENABLE_STAGING_ENVIRONMENT;
import static org.craftercms.studio.api.v1.constant.StudioConstants.SITE_CONFIG_XML_ELEMENT_LIVE_ENVIRONMENT;
import static org.craftercms.studio.api.v1.constant.StudioConstants.SITE_CONFIG_XML_ELEMENT_PROTECTED_FOLDER_PATTERNS;
import static org.craftercms.studio.api.v1.constant.StudioConstants.SITE_CONFIG_XML_ELEMENT_PUBLISHED_REPOSITORY;
import static org.craftercms.studio.api.v1.constant.StudioConstants.SITE_CONFIG_XML_ELEMENT_PUBLISHER;
import static org.craftercms.studio.api.v1.constant.StudioConstants.SITE_CONFIG_XML_ELEMENT_REQUIRE_PEER_REVIEW;
import static org.craftercms.studio.api.v1.constant.StudioConstants.SITE_CONFIG_XML_ELEMENT_STAGING_ENVIRONMENT;
import static org.craftercms.studio.api.v1.constant.StudioConstants.SITE_CONFIG_XML_ELEMENT_WORKFLOW;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v1.service.configuration.ServicesConfig;
import org.craftercms.studio.api.v1.to.ContentMonitorConfigTO;
import org.craftercms.studio.api.v1.to.FacetRangeTO;
import org.craftercms.studio.api.v1.to.FacetTO;
import org.craftercms.studio.api.v1.to.RepositoryConfigTO;
import org.craftercms.studio.api.v1.to.SiteConfigTO;
import org.craftercms.studio.api.v2.service.config.ConfigurationService;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.CONFIGURATION_ENVIRONMENT_ACTIVE;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.CONFIGURATION_SITE_GENERAL_CONFIG_FILE_NAME;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.REPO_PUBLISHED_LIVE;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.REPO_PUBLISHED_STAGING;
import org.dom4j.Document;
import org.dom4j.Element;
import org.dom4j.Node;
import org.jspecify.annotations.NonNull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.dataformat.xml.XmlMapper;
import com.google.common.cache.Cache;

import jakarta.validation.Valid;

/**
 * Implementation of ServicesConfigImpl. This class requires a configuration
 * file in the repository
 */
public class ServicesConfigImpl implements ServicesConfig {

	private static final Logger LOGGER = LoggerFactory.getLogger(ServicesConfigImpl.class);


	/**
	 * pattern keys
	 **/
	protected static final String PATTERN_PAGE = "page";
	protected static final String PATTERN_COMPONENT = "component";
	protected static final String PATTERN_ASSET = "asset";
	protected static final String PATTERN_DOCUMENT = "document";
	protected static final String PATTERN_RENDERING_TEMPLATE = "rendering-template";
	protected static final String PATTERN_SCRIPTS = "scripts";
	protected static final String PATTERN_CONFIGURATION = "config";

	/**
	 * xml element names
	 **/
	protected static final String ELM_PATTERN = "pattern";

	/**
	 * xml attribute names
	 **/
	protected static final String ATTR_NAME = "@name";
	protected static final String ATTR_PATH = "@path";
	protected static final String ATTR_READ_DIRECT_CHILDREN = "@read-direct-children";
	protected static final String ATTR_ATTACH_ROOT_PREFIX = "@attach-root-prefix";

	protected StudioConfiguration studioConfiguration;
	protected ConfigurationService configurationService;
	protected Cache<String, SiteConfigTO> configurationCache;

	@Override
	@Valid
	public List<String> getAssetPatterns(@ValidateStringParam String site) throws SiteNotFoundException {
		SiteConfigTO config = loadConfiguration(site);
		if (config.getRepositoryConfig() != null) {
			return config.getRepositoryConfig().getAssetPatterns();
		}
		return null;
	}

	@Override
	@Valid
	public List<String> getComponentPatterns(@ValidateStringParam String site) throws SiteNotFoundException {
		SiteConfigTO config = loadConfiguration(site);
		if (config.getRepositoryConfig() != null) {
			return config.getRepositoryConfig().getComponentPatterns();
		}
		return null;
	}

	@Override
	@Valid
	public List<String> getPagePatterns(@ValidateStringParam String site) throws SiteNotFoundException {
		SiteConfigTO config = loadConfiguration(site);
		if (config.getRepositoryConfig() != null) {
			return config.getRepositoryConfig().getPagePatterns();
		}
		return null;
	}

	@Override
	@Valid
	public List<String> getRenderingTemplatePatterns(@ValidateStringParam String site) throws SiteNotFoundException {
		SiteConfigTO config = loadConfiguration(site);
		if (config.getRepositoryConfig() != null) {
			return config.getRepositoryConfig().getRenderingTemplatePatterns();
		}
		return null;
	}

	@Override
	@Valid
	public List<String> getScriptsPatterns(@ValidateStringParam String site) throws SiteNotFoundException {
		SiteConfigTO config = loadConfiguration(site);
		if (config.getRepositoryConfig() != null) {
			return config.getRepositoryConfig().getScriptsPatterns();
		}
		return null;
	}

	@Override
	public List<String> getConfigurationPatterns(String site) throws SiteNotFoundException {
		SiteConfigTO config = loadConfiguration(site);
		if (config.getRepositoryConfig() != null) {
			return config.getRepositoryConfig().getConfigurationPatterns();
		}
		return null;
	}

	@Override
	@Valid
	public List<String> getDocumentPatterns(@ValidateStringParam String site) throws SiteNotFoundException {
		SiteConfigTO config = loadConfiguration(site);
		if (config.getRepositoryConfig() != null) {
			return config.getRepositoryConfig().getDocumentPatterns();
		}
		return null;
	}

	@Override
	@Valid
	public String getLevelDescriptorName(@ValidateStringParam String site) throws SiteNotFoundException {
		SiteConfigTO config = loadConfiguration(site);
		if (config.getRepositoryConfig() != null) {
			return config.getRepositoryConfig().getLevelDescriptorName();
		}
		return null;
	}

	@Override
	@Valid
	public String getPluginFolderPattern(@ValidateStringParam String site) throws SiteNotFoundException {
		SiteConfigTO config = loadConfiguration(site);
		return config.getPluginFolderPattern();
	}

	/**
	 * load services configuration
	 */
	@NonNull
	protected SiteConfigTO loadConfiguration(String site) throws SiteNotFoundException {
		String environment = studioConfiguration.getProperty(CONFIGURATION_ENVIRONMENT_ACTIVE);
		String configFilename = getConfigFileName();
		String cacheKey =
			configurationService.getCacheKey(site, MODULE_STUDIO, getConfigFileName(), environment, "object");

		SiteConfigTO siteConfig = configurationCache.getIfPresent(cacheKey);
		if (siteConfig == null) {
			try {
				Document document = configurationService
					.getConfigurationAsDocument(site, MODULE_STUDIO, configFilename, environment);
				if (document != null) {
					Element root = document.getRootElement();
					Node configNode = root.selectSingleNode("/site-config");
					String name = configNode.valueOf("display-name");
					siteConfig = new SiteConfigTO();
					String stagingEnvironmentEnabledValue =
						configNode.valueOf(SITE_CONFIG_XML_ELEMENT_PUBLISHED_REPOSITORY +
							"/" + SITE_CONFIG_XML_ELEMENT_ENABLE_STAGING_ENVIRONMENT);
					if (StringUtils.isEmpty(stagingEnvironmentEnabledValue)) {
						siteConfig.setStagingEnvironmentEnabled(false);
					} else {
						siteConfig.setStagingEnvironmentEnabled(Boolean.parseBoolean(stagingEnvironmentEnabledValue));
					}

					String stagingEnvironment =
						configNode.valueOf(SITE_CONFIG_XML_ELEMENT_PUBLISHED_REPOSITORY + "/" +
							SITE_CONFIG_XML_ELEMENT_STAGING_ENVIRONMENT);
					if (StringUtils.isEmpty(stagingEnvironment)) {
						stagingEnvironment = studioConfiguration.getProperty(REPO_PUBLISHED_STAGING);
					}
					siteConfig.setStagingEnvironment(stagingEnvironment);
					String liveEnvironment =
						configNode.valueOf(SITE_CONFIG_XML_ELEMENT_PUBLISHED_REPOSITORY + "/" +
							SITE_CONFIG_XML_ELEMENT_LIVE_ENVIRONMENT);
					if (StringUtils.isEmpty(liveEnvironment)) {
						liveEnvironment = studioConfiguration.getProperty(REPO_PUBLISHED_LIVE);
					}
					siteConfig.setLiveEnvironment(liveEnvironment);

					loadSiteUrlsConfiguration(siteConfig, configNode.selectSingleNode(SITE_CONFIG_ELEMENT_SITE_URLS));

					String adminEmailAddressValue = configNode.valueOf(SITE_CONFIG_ELEMENT_ADMIN_EMAIL_ADDRESS);
					siteConfig.setAdminEmailAddress(adminEmailAddressValue);

					loadSiteRepositoryConfiguration(name, siteConfig, configNode.selectSingleNode("repository"));

					loadSearchFields(configNode, siteConfig);
					loadFacetConfiguration(configNode, siteConfig);

					siteConfig.setPluginFolderPattern(configNode.valueOf(SITE_CONFIG_ELEMENT_PLUGIN_FOLDER_PATTERN));

					String requirePeerReviewValue =
						configNode.valueOf(SITE_CONFIG_XML_ELEMENT_WORKFLOW + "/" +
							SITE_CONFIG_XML_ELEMENT_PUBLISHER + "/" +
							SITE_CONFIG_XML_ELEMENT_REQUIRE_PEER_REVIEW);
					if (StringUtils.isEmpty(requirePeerReviewValue)) {
						siteConfig.setRequirePeerReview(false);
					} else {
						siteConfig.setRequirePeerReview(Boolean.parseBoolean(requirePeerReviewValue));
					}

					List<String> protectedFolderPatterns =
						getStringList(configNode.selectNodes(SITE_CONFIG_XML_ELEMENT_PROTECTED_FOLDER_PATTERNS));
					siteConfig.setProtectedFolderPatterns(protectedFolderPatterns);

					loadMonitoringConfigs(site, configNode, siteConfig);
					configurationCache.put(cacheKey, siteConfig);
				}
			} catch (ServiceLayerException e) {
				LOGGER.error("No site configuration found for site '{}' at {}", site, getConfigFileName());
			}
		}
		return siteConfig;
	}

	/**
	 * Loads the content monitor configuration for the site
	 */
	protected void loadMonitoringConfigs(String site, Node configNode, SiteConfigTO siteConfig) {
		Node monitoringNode = configNode.selectSingleNode(SITE_CONFIG_XML_ELEMENT_CONTENT_MONITORING);
		if (monitoringNode == null) {
			LOGGER.warn("No content monitor configuration found for site '{}'", site);
			siteConfig.setContentMonitorConfig(new ContentMonitorConfigTO());
			return;
		}
		ContentMonitorConfigTO monitorConfigs = null;
		try {
			monitorConfigs = new XmlMapper().readValue(monitoringNode.asXML(), ContentMonitorConfigTO.class);
		} catch (JsonProcessingException e) {
			LOGGER.error("Error loading content monitor configuration for site '{}': '{}'", site, e.getMessage());
			LOGGER.debug("Error loading content monitor configuration for site '{}' at {}", site, getConfigFileName(), e);
		}
		if (monitorConfigs == null) {
			monitorConfigs = new ContentMonitorConfigTO();
		}
		siteConfig.setContentMonitorConfig(monitorConfigs);
	}

	protected void loadSiteUrlsConfiguration(SiteConfigTO siteConfig, Node configNode) {
		if (Objects.nonNull(configNode)) {
			String authoringUrlValue = configNode.valueOf(SITE_CONFIG_ELEMENT_AUTHORING_URL);
			siteConfig.setAuthoringUrl(authoringUrlValue);
			String liveUrlValue = configNode.valueOf(SITE_CONFIG_ELEMENT_LIVE_URL);
			siteConfig.setLiveUrl(liveUrlValue);
		}
	}

	protected void loadSearchFields(Node root, SiteConfigTO config) {
		Map<String, Float> fields = new TreeMap<>();
		List<Node> fieldsConfig = root.selectNodes("search/fields/field");
		if (CollectionUtils.isNotEmpty(fieldsConfig)) {
			fieldsConfig.forEach(fieldConfig -> {
				String name = XmlUtils.selectSingleNodeValue(fieldConfig, "name/text()");
				String boost = XmlUtils.selectSingleNodeValue(fieldConfig, "boost/text()");
				fields.put(name, StringUtils.isNotEmpty(boost) ? Float.parseFloat(boost) : 1.0f);
			});
		}
		config.setSearchFields(fields);
	}

	/**
	 * Loads the search facets configurations
	 *
	 * @param root   configuration to read
	 * @param config configuration to update
	 */
	protected void loadFacetConfiguration(Node root, SiteConfigTO config) {
		List<Node> facetsConfig = root.selectNodes("search/facets/facet");
		if (CollectionUtils.isNotEmpty(facetsConfig)) {
			Map<String, FacetTO> facets = facetsConfig.stream()
				.map(facetConfig -> {
					FacetTO facet = new FacetTO();
					facet.setName(XmlUtils.selectSingleNodeValue(facetConfig, "name/text()"));
					facet.setField(XmlUtils.selectSingleNodeValue(facetConfig, "field/text()"));
					facet.setDate(Boolean.parseBoolean(
						XmlUtils.selectSingleNodeValue(facetConfig, "date/text()")));
					facet.setMultiple(Boolean.parseBoolean(
						XmlUtils.selectSingleNodeValue(facetConfig, "multiple/text()")));
					List<Node> rangesConfig = facetConfig.selectNodes("ranges/range");
					if (CollectionUtils.isNotEmpty(rangesConfig)) {
						List<FacetRangeTO> ranges = rangesConfig.stream()
							.map(rangeConfig -> {
								FacetRangeTO range = new FacetRangeTO();
								range.setLabel(XmlUtils.selectSingleNodeValue(rangeConfig, "label/text()"));
								String from = XmlUtils.selectSingleNodeValue(rangeConfig, "from/text()");
								if (StringUtils.isNotEmpty(from)) {
									range.setFrom(from);
								}
								String to = XmlUtils.selectSingleNodeValue(rangeConfig, "to/text()");
								if (StringUtils.isNotEmpty(to)) {
									range.setTo(to);
								}
								return range;
							})
							.collect(Collectors.toList());
						facet.setRanges(ranges);
					}
					return facet;
				})
				.collect(Collectors.toMap(FacetTO::getName, Function.identity()));
			config.setFacets(facets);
		}
	}

	/**
	 * load the web-project configuration
	 */
	protected void loadSiteRepositoryConfiguration(String siteName, SiteConfigTO siteConfig, Node node) {
		if (node == null) {
			LOGGER.warn("Site '{}' does not have repository configuration.", siteName);
			return;
		}
		RepositoryConfigTO repoConfigTO = new RepositoryConfigTO();
		repoConfigTO.setLevelDescriptorName(node.valueOf("level-descriptor"));
		loadPatterns(siteName, siteConfig, repoConfigTO, node.selectNodes("patterns/pattern-group"));
		siteConfig.setRepositoryConfig(repoConfigTO);
	}


	/**
	 * Get a list of string values
	 */
	protected List<String> getStringList(List<Node> nodes) {
		List<String> items;
		if (nodes != null && !nodes.isEmpty()) {
			items = new ArrayList<>(nodes.size());
			for (Node node : nodes) {
				items.add(node.getText());
			}
		} else {
			items = new ArrayList<>(0);
		}
		return items;
	}

	/**
	 * Load page/component/assets patterns configuration
	 */
	protected void loadPatterns(String siteName, SiteConfigTO site, RepositoryConfigTO repo, List<Node> nodes) {
		if (nodes != null) {
			for (Node node : nodes) {
				String patternKey = node.valueOf(ATTR_NAME);
				if (!StringUtils.isEmpty(patternKey)) {
					List<Node> patternNodes = node.selectNodes(ELM_PATTERN);
					if (patternNodes != null) {
						List<String> patterns = new ArrayList<>(patternNodes.size());
						for (Node patternNode : patternNodes) {
							String pattern = patternNode.getText();
							if (!StringUtils.isEmpty(pattern)) {
								patterns.add(pattern);
							}
						}
						switch (patternKey) {
							case PATTERN_PAGE -> repo.setPagePatterns(patterns);
							case PATTERN_COMPONENT -> repo.setComponentPatterns(patterns);
							case PATTERN_ASSET -> repo.setAssetPatterns(patterns);
							case PATTERN_DOCUMENT -> repo.setDocumentPatterns(patterns);
							case PATTERN_RENDERING_TEMPLATE -> repo.setRenderingTemplatePatterns(patterns);
							case PATTERN_SCRIPTS -> repo.setScriptsPatterns(patterns);
							case PATTERN_CONFIGURATION -> repo.setConfigurationPatterns(patterns);
							default ->
								LOGGER.warn("Unknown pattern key: '{}' is provided in site '{}'", patternKey, siteName);
						}
					}
				} else {
					LOGGER.error("No pattern key provided in site '{}' configuration. Skipping the pattern.", siteName);
				}
			}
		} else {
			LOGGER.warn("Site '{}' does not have any pattern configuration.", siteName);
		}
	}

	public String getConfigFileName() {
		return studioConfiguration.getProperty(CONFIGURATION_SITE_GENERAL_CONFIG_FILE_NAME);
	}

	@Override
	public boolean isStagingEnvironmentEnabled(String site) throws SiteNotFoundException {
		SiteConfigTO config = loadConfiguration(site);
		return config.isStagingEnvironmentEnabled();
	}

	@Override
	public String getStagingEnvironment(String site) throws SiteNotFoundException {
		SiteConfigTO config = loadConfiguration(site);
		return config.getStagingEnvironment();
	}

	@Override
	public String getLiveEnvironment(String site) throws SiteNotFoundException {
		SiteConfigTO config = loadConfiguration(site);
		return config.getLiveEnvironment();
	}

	@Override
	public Map<String, Float> getSearchFields(String site) throws SiteNotFoundException {
		SiteConfigTO config = loadConfiguration(site);
		return config.getSearchFields();
	}

	/**
	 * {@inheritDoc}
	 */
	@Override
	public Map<String, FacetTO> getFacets(final String site) throws SiteNotFoundException {
		SiteConfigTO config = loadConfiguration(site);
		return config.getFacets();
	}

	@Override
	public String getAuthoringUrl(String siteId) throws SiteNotFoundException {
		SiteConfigTO config = loadConfiguration(siteId);
		if (StringUtils.isEmpty(config.getAuthoringUrl())) {
			return DEFAULT_CONFIG_URL;
		}
		return config.getAuthoringUrl();
	}

	@Override
	public String getLiveUrl(String siteId) throws SiteNotFoundException {
		SiteConfigTO config = loadConfiguration(siteId);
		if (StringUtils.isEmpty(config.getLiveUrl())) {
			return DEFAULT_CONFIG_URL;
		}
		return config.getLiveUrl();
	}

	@Override
	public String getAdminEmailAddress(String siteId) throws SiteNotFoundException {
		SiteConfigTO config = loadConfiguration(siteId);
		return config.getAdminEmailAddress();
	}

	@Override
	public boolean isRequirePeerReview(String siteId) throws SiteNotFoundException {
		SiteConfigTO config = loadConfiguration(siteId);
		return config.isRequirePeerReview();
	}

	@Override
	public List<String> getProtectedFolderPatterns(String siteId) throws SiteNotFoundException {
		SiteConfigTO config = loadConfiguration(siteId);
		return config.getProtectedFolderPatterns();
	}

	@Override
	public ContentMonitorConfigTO getMonitorConfig(String siteId) throws SiteNotFoundException {
		SiteConfigTO config = loadConfiguration(siteId);
		return config.getContentMonitorConfig();
	}

	public void setStudioConfiguration(StudioConfiguration studioConfiguration) {
		this.studioConfiguration = studioConfiguration;
	}

	public void setConfigurationService(ConfigurationService configurationService) {
		this.configurationService = configurationService;
	}

	@SuppressWarnings("unused")
	public void setConfigurationCache(Cache<String, SiteConfigTO> configurationCache) {
		this.configurationCache = configurationCache;
	}

}
