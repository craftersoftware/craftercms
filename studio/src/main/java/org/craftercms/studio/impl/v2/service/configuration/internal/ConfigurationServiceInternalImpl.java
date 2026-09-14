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
package org.craftercms.studio.impl.v2.service.configuration.internal;

import com.google.common.cache.Cache;
import org.apache.commons.configuration2.HierarchicalConfiguration;
import org.apache.commons.configuration2.tree.ImmutableNode;
import org.apache.commons.io.IOUtils;
import org.apache.commons.text.StringSubstitutor;
import org.craftercms.commons.config.EncryptionAwareConfigurationReader;
import org.craftercms.commons.config.YamlConfiguration;
import org.craftercms.commons.lang.UrlUtils;
import org.craftercms.core.service.Context;
import org.craftercms.studio.api.v1.exception.ContentNotFoundException;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v1.exception.security.AuthenticationException;
import org.craftercms.studio.api.v1.exception.security.UserNotFoundException;
import org.craftercms.studio.api.v1.service.configuration.ServicesConfig;
import org.craftercms.studio.api.v2.annotation.logging.LogExecutionTime;
import org.craftercms.studio.api.v2.core.ContextManager;
import org.craftercms.studio.api.v2.dal.AuditLog;
import org.craftercms.studio.api.v2.dal.Site;
import org.craftercms.studio.api.v2.dal.SiteDAO;
import org.craftercms.studio.api.v2.dal.security.NormalizedGroup;
import org.craftercms.studio.api.v2.dal.security.NormalizedRole;
import org.craftercms.studio.api.v2.event.content.ConfigurationEvent;
import org.craftercms.studio.api.v2.event.content.ContentEvent;
import org.craftercms.studio.api.v2.exception.configuration.ConfigurationException;
import org.craftercms.studio.api.v2.exception.configuration.InvalidConfigurationException;
import org.craftercms.studio.api.v2.repository.GitContentRepository;
import org.craftercms.studio.api.v2.service.audit.AuditService;
import org.craftercms.studio.api.v2.service.config.ConfigurationService;
import org.craftercms.studio.api.v2.service.content.ContentService;
import org.craftercms.studio.api.v2.service.dependency.DependencyService;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import org.craftercms.studio.api.v2.utils.cache.CacheInvalidator;
import org.craftercms.studio.impl.v1.util.ContentUtils;
import org.craftercms.studio.impl.v2.utils.XsltUtils;
import org.craftercms.studio.impl.v2.utils.security.SecurityUtils;
import org.craftercms.studio.model.config.TranslationConfiguration;
import org.craftercms.studio.model.i18n.Language;
import org.craftercms.studio.model.rest.ConfigurationHistory;
import org.dom4j.*;
import org.jspecify.annotations.NonNull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.ApplicationEventPublisherAware;
import org.springframework.context.annotation.Lazy;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Paths;
import java.util.*;
import java.util.concurrent.ExecutionException;

import static java.lang.String.format;
import static java.lang.String.join;
import static java.util.Collections.emptyMap;
import static java.util.Collections.unmodifiableCollection;
import static org.apache.commons.io.FilenameUtils.getExtension;
import static org.apache.commons.io.FilenameUtils.normalize;
import static org.apache.commons.lang3.StringUtils.*;
import static org.apache.commons.lang3.Strings.CI;
import static org.apache.commons.lang3.Strings.CS;
import static org.craftercms.studio.api.v1.constant.StudioConstants.*;
import static org.craftercms.studio.api.v1.constant.StudioXmlConstants.*;
import static org.craftercms.studio.api.v2.dal.AuditLog.createAuditLogEntry;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.OPERATION_UPDATE;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.TARGET_TYPE_CONTENT_ITEM;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.*;
import static org.craftercms.studio.impl.v2.utils.security.SecurityUtils.getAuthentication;
import static org.craftercms.studio.impl.v2.utils.security.SecurityUtils.getCurrentUsername;

/**
 * Internal implementation of {@link ConfigurationService}.
 */
public class ConfigurationServiceInternalImpl implements ConfigurationService, ApplicationEventPublisherAware {

	private static final Logger logger = LoggerFactory.getLogger(ConfigurationServiceInternalImpl.class);

	public static final String PLACEHOLDER_TYPE = "type";
	public static final String PLACEHOLDER_NAME = "name";
	public static final String PLACEHOLDER_ID = "id";

	private static final String CONFIG_KEY_ID = "id";
	private static final String CONFIG_KEY_LABEL = "label";

	/* Translation Config */
	public static final String CONFIG_KEY_TRANSLATION_DEFAULT_LOCALE = "defaultLocaleCode";
	public static final String CONFIG_KEY_TRANSLATION_LOCALES = "localeCodes.localeCode";

	private static final String READ_ONLY_BLOB_STORES_TEMPLATE_LOCATION = "/crafter/studio/utils/readonly-blob-stores.xslt";

	private GitContentRepository contentRepository;
	private ContentService contentService;
	private StudioConfiguration studioConfiguration;
	private AuditService auditService;
	private SiteDAO siteDao;
	private ServicesConfig servicesConfig;
	private EncryptionAwareConfigurationReader configurationReader;
	private DependencyService dependencyService;

	private String translationConfig;
	private Cache<String, Object> configurationCache;
	private List<CacheInvalidator<String, Object>> cacheInvalidators;
	private ContextManager contextManager;
	private ApplicationEventPublisher applicationEventPublisher;

	@Override
	public Map<NormalizedGroup, List<NormalizedRole>> getRoleMappings(String siteId) throws ServiceLayerException {
		// TODO: Refactor this to use Apache's Commons Configuration
		Map<NormalizedGroup, List<NormalizedRole>> roleMappings = new HashMap<>();
		String roleMappingsConfigPath = getSiteRoleMappingsConfigFileName();
		Document document;

		try {
			document = getConfigurationAsDocument(siteId, MODULE_STUDIO, roleMappingsConfigPath,
					studioConfiguration.getProperty(CONFIGURATION_ENVIRONMENT_ACTIVE));
			if (document != null) {
				Element root = document.getRootElement();
				if (root.getName().equals(DOCUMENT_ROLE_MAPPINGS)) {
					List<Node> groupNodes = root.selectNodes(DOCUMENT_ELM_GROUPS_NODE);
					for (Node node : groupNodes) {
						String groupName = node.valueOf(DOCUMENT_ATTR_NAME);
						if (isNotEmpty(groupName)) {
							List<Node> roleNodes = node.selectNodes(DOCUMENT_ELM_PERMISSION_ROLE);
							List<NormalizedRole> roles = new ArrayList<>();

							for (Node roleNode : roleNodes) {
								roles.add(new NormalizedRole(roleNode.getText()));
							}

							roleMappings.put(new NormalizedGroup(groupName), roles);
						}
					}
				}
			}
		} catch (ServiceLayerException e) {
			if (logger.isDebugEnabled()) {
				logger.debug("Failed to load role mappings from site '{}' path '{}'", siteId, roleMappingsConfigPath, e);
			} else {
				logger.error("Failed to load role mappings from site '{}' path '{}'", siteId, roleMappingsConfigPath);
			}
			throw new ConfigurationException(format("Failed to load role mappings from site '%s' path '%s'",
					siteId, roleMappingsConfigPath), e);
		}

		return roleMappings;
	}

	@Override
	public Map<NormalizedGroup, List<NormalizedRole>> getGlobalRoleMappings() throws ServiceLayerException {
		// TODO: Refactor this to use Apache's Commons Configuration
		Map<NormalizedGroup, List<NormalizedRole>> roleMappings = new HashMap<>();
		String globalRoleMappingsConfigPath = getGlobalConfigRoot() + FILE_SEPARATOR + getGlobalRoleMappingsFileName();
		Document document;

		try {
			// The write seems to always send env = null
			document = getGlobalConfigurationAsDocument(globalRoleMappingsConfigPath);
			if (document != null) {
				Element root = document.getRootElement();
				if (root.getName().equals(DOCUMENT_ROLE_MAPPINGS)) {
					List<Node> groupNodes = root.selectNodes(DOCUMENT_ELM_GROUPS_NODE);
					for (Node node : groupNodes) {
						String groupName = node.valueOf(DOCUMENT_ATTR_NAME);
						if (isNotEmpty(groupName)) {
							List<Node> roleNodes = node.selectNodes(DOCUMENT_ELM_PERMISSION_ROLE);
							List<NormalizedRole> roles = new ArrayList<>();

							for (Node roleNode : roleNodes) {
								roles.add(new NormalizedRole(roleNode.getText()));
							}

							roleMappings.put(new NormalizedGroup(groupName), roles);
						}
					}
				}
			}
		} catch (ServiceLayerException e) {
			logger.error("Failed to load the Global Role Mappings from '{}'", globalRoleMappingsConfigPath, e);
			throw new ConfigurationException("Failed to load the Global role mappings file " +
					globalRoleMappingsConfigPath);
		}

		return roleMappings;
	}

	private String getSiteRoleMappingsConfigFileName() {
		return studioConfiguration.getProperty(CONFIGURATION_SITE_ROLE_MAPPINGS_FILE_NAME);
	}

	@Override
	@LogExecutionTime
	public String getConfigurationAsString(String siteId,
										   String module,
										   String path,
										   String environment) throws ServiceLayerException {
		String content;
		try {
			content = ContentUtils.convertStreamToString(getEnvironmentConfiguration(siteId, module, path, environment));
		} catch (IOException e) {
			throw new ServiceLayerException(format("Failed to load configuration from site '%s' module '%s' path '%s' environment '%s'",
					siteId, module, path, environment), e);
		}
		if (content == null) {
			throw new ContentNotFoundException(path, siteId,
					format("Configuration not found for site '%s', module '%s', path '%s', environment '%s'",
							siteId, module, path, environment));
		}
		return content;
	}

	@Override
	public Document getConfigurationAsDocument(String siteId, String module,
											   String path, String environment) throws ServiceLayerException {
		var normalizedPath = normalize(path);
		var cacheKey = getCacheKey(siteId, module, normalizedPath, environment);
		Document doc = (Document) configurationCache.getIfPresent(cacheKey);
		if (doc == null) {
			try {
				logger.debug("Cache miss in site '{}' module '{}' environment '{}' cache key '{}'", siteId, module, environment, cacheKey);
				InputStream content = getEnvironmentConfiguration(siteId, module, normalizedPath, environment);
				doc = ContentUtils.convertStreamToXml(content);
				configurationCache.put(cacheKey, doc);
			} catch (IOException | DocumentException e) {
				logger.error("Failed to load configuration from site '{}' module '{}' " +
						"path '{}' environment '{}'", siteId, module, path, environment, e);
				throw new ServiceLayerException(format("Failed to load configuration from site '%s' module " +
						"'%s' path '%s' environment '%s'", siteId, module, path, environment), e);
			}
		}
		return doc;
	}

	@Override
	public HierarchicalConfiguration<?> getXmlConfiguration(String siteId, String path) throws ConfigurationException {
		try {
			var cacheKey = getCacheKey(siteId, null, path, null, "commons");
			HierarchicalConfiguration<?> config = (HierarchicalConfiguration<?>) configurationCache.getIfPresent(cacheKey);
			if (config == null) {
				logger.debug("Cache miss in site '{}' cache key '{}'", siteId, cacheKey);
				if (contentService.contentExists(siteId, path)) {
					try (InputStream inputStream = contentService.getContent(siteId, path)) {
						config = configurationReader.readXmlConfiguration(inputStream, getConfigLookupVariables(siteId));
					}
					configurationCache.put(cacheKey, config);
				}
			}
			return config;
		} catch (ContentNotFoundException | org.craftercms.commons.config.ConfigurationException |
				 SiteNotFoundException | IOException e) {
			logger.error("Failed to load configuration from site '{}' path '{}'", siteId, path, e);
			throw new ConfigurationException(format("Failed to load configuration from site " +
					"'%s' path '%s'", siteId, path), e);
		}
	}

	@Override
	public HierarchicalConfiguration<?> getXmlConfiguration(String siteId, String module, String path) throws ConfigurationException {
		String environment = studioConfiguration.getProperty(CONFIGURATION_ENVIRONMENT_ACTIVE);
		try {
			String cacheKey = getCacheKey(siteId, module, path, environment);
			HierarchicalConfiguration<?> config = (HierarchicalConfiguration<?>) configurationCache.getIfPresent(cacheKey);
			if (config != null) {
				return config;
			}
			String fullConfigurationPath = getConfigurationPath(siteId, module, path, environment);
			logger.debug("Cache miss in site '{}' module '{}' cache key '{}'", siteId, module, cacheKey);
			if (contentService.contentExists(siteId, fullConfigurationPath)) {
				try (InputStream inputStream = contentService.getContent(siteId, fullConfigurationPath)) {
					config = configurationReader.readXmlConfiguration(inputStream, getConfigLookupVariables(siteId));
				}
				configurationCache.put(cacheKey, config);
			}
			return config;
		} catch (ContentNotFoundException | org.craftercms.commons.config.ConfigurationException |
				 SiteNotFoundException | IOException e) {
			logger.error("Failed to load configuration from site '{}' module '{}' env '{}' path '{}'", siteId, module, environment, path, e);
			throw new ConfigurationException(format("Failed to load configuration from site " +
					"'%s' module '%s' env '%s' path '%s'", siteId, module, environment, path), e);
		}
	}

	@Override
	public HierarchicalConfiguration<?> getGlobalXmlConfiguration(String path) throws ConfigurationException {
		var cacheKey = path + ":commons";
		HierarchicalConfiguration<?> config = (HierarchicalConfiguration<?>) configurationCache.getIfPresent(cacheKey);
		if (config == null) {
			try {
				logger.debug("Cache miss in the Global repository cache key '{}'", cacheKey);
				if (contentService.contentExists(EMPTY, path)) {
					try(InputStream inputStream = contentService.getContent(EMPTY, path)) {
						config = configurationReader.readXmlConfiguration(inputStream, emptyMap());
					}
					configurationCache.put(cacheKey, config);
				}
			} catch (ContentNotFoundException | org.craftercms.commons.config.ConfigurationException | IOException e) {
				logger.error("Failed to load configuration from the Global repository path '{}'",
						path, e);
				throw new ConfigurationException(format("Failed to load configuration from the Global " +
						"repository path '%s'", path), e);
			}
		}
		return config;
	}

	@Override
	public Document getGlobalConfigurationAsDocument(String path) throws ServiceLayerException {
		Document doc = (Document) configurationCache.getIfPresent(path);
		if (doc == null) {
			try {
				logger.debug("Cache miss in the Global repository path '{}'", path);
				doc = ContentUtils.convertStreamToXml(contentService.getContent(EMPTY, path));

				configurationCache.put(path, doc);
			} catch (DocumentException e) {
				logger.error("Failed to load the Global config at path '{}'", path, e);
				throw new ServiceLayerException(format("Failed to load the Global config at path '%s'",
						path), e);
			}
		}
		return doc;
	}

	@Override
	public String getGlobalConfigurationAsString(String path) throws ServiceLayerException {
		String content;
		try {
			content = ContentUtils.convertStreamToString(contentService.getContent(EMPTY, path));
		} catch (IOException e) {
			throw new ServiceLayerException(format("Failed to load the Global configuration at path '%s'", path), e);
		}
		if (content == null) {
			throw new ContentNotFoundException(path, CONFIGURATION_GLOBAL_SYSTEM_SITE,
					format("Configuration not found for global site '%s', path '%s'", CONFIGURATION_GLOBAL_SYSTEM_SITE, path));
		}

		return content;
	}

	private InputStream getDefaultConfiguration(String siteId, String module, String path) throws ContentNotFoundException {
		long startTime = 0;
		if (logger.isTraceEnabled()) {
			startTime = System.currentTimeMillis();
		}
		String configPath;
		if (isNotEmpty(module)) {
			String configBasePath = studioConfiguration.getProperty(CONFIGURATION_SITE_CONFIG_BASE_PATH_PATTERN)
					.replaceAll(PATTERN_MODULE, module);
			configPath = Paths.get(configBasePath, path).toString();
		} else {
			configPath = path;
		}
		InputStream result = contentService.getContent(siteId, configPath);
		if (logger.isTraceEnabled()) {
			logger.trace("getDefaultConfiguration site '{}' path '{}' took '{}' milliseconds", siteId, path, System.currentTimeMillis() - startTime);
		}
		return result;
	}

	private InputStream getEnvironmentConfiguration(String siteId, String module, String path, String environment) throws SiteNotFoundException, ContentNotFoundException, IOException {
		long startTime = 0;
		if (logger.isTraceEnabled()) {
			startTime = System.currentTimeMillis();
		}
		if (!isEmpty(environment)) {
			String configBasePath =
					studioConfiguration.getProperty(CONFIGURATION_SITE_MUTLI_ENVIRONMENT_CONFIG_BASE_PATH_PATTERN)
							.replaceAll(PATTERN_MODULE, module)
							.replaceAll(PATTERN_ENVIRONMENT, environment);
			String configPath =
					Paths.get(configBasePath, path).toString();
			if (contentService.shallowContentExists(siteId, configPath)) {
				return contentService.getContent(siteId, configPath);
			}
		}
		InputStream defaultConfiguration = getDefaultConfiguration(siteId, module, path);
		if (logger.isTraceEnabled()) {
			logger.trace("getEnvironmentConfiguration site '{}' path '{}' took '{}' milliseconds", siteId, path, System.currentTimeMillis() - startTime);
		}
		return defaultConfiguration;
	}

	@Override
	public void writeConfiguration(String siteId,
								   String module,
								   String path,
								   String environment,
								   InputStream content)
			throws ServiceLayerException, UserNotFoundException, AuthenticationException {
		writeEnvironmentConfiguration(siteId, module, path, environment, content);
		invalidateConfiguration(siteId, module, path, environment);
		applicationEventPublisher.publishEvent(
				new ConfigurationEvent(getAuthentication(), siteId,
						getConfigurationPath(siteId, module, path, environment)));
	}

	@Override
	public String getCacheKey(String siteId, String module, String path, String environment, String suffix) throws SiteNotFoundException {
		if (isNotEmpty(siteId)) {
			String fullPath = null;
			if (isNotEmpty(environment)) {
				String configBasePath =
						studioConfiguration.getProperty(CONFIGURATION_SITE_MUTLI_ENVIRONMENT_CONFIG_BASE_PATH_PATTERN)
								.replaceAll(PATTERN_MODULE, module)
								.replaceAll(PATTERN_ENVIRONMENT, environment);
				String configPath =
						Paths.get(configBasePath, path).toString();
				if (contentService.contentExists(siteId, configPath)) {
					fullPath = configPath;
				}
			}

			if (isEmpty(fullPath)) {
				if (isNotEmpty(module)) {
					String configBasePath = studioConfiguration.getProperty(CONFIGURATION_SITE_CONFIG_BASE_PATH_PATTERN)
							.replaceAll(PATTERN_MODULE, module);

					if (CI.startsWith(path, configBasePath)) {
						fullPath = path;
					} else {
						fullPath = Paths.get(configBasePath, path).toString();
					}
				} else {
					fullPath = path;
				}
			}

			fullPath = normalize(fullPath);

			if (isEmpty(suffix)) {
				return join(":", siteId, fullPath);
			} else {
				return join(":", siteId, fullPath, suffix);
			}
		} else {
			String toReturn = normalize(path);

			if (isEmpty(suffix)) {
				return toReturn;
			} else {
				return join(":", path, suffix);
			}
		}
	}

	@Override
	public Resource getPluginFile(String siteId,
								  String pluginId,
								  String type,
								  String name,
								  String filename)
			throws ContentNotFoundException, SiteNotFoundException {
		String basePath;
		if (isEmpty(pluginId)) {
			basePath = servicesConfig.getPluginFolderPattern(siteId);
		} else {
			basePath = studioConfiguration.getProperty(PLUGIN_BASE_PATTERN);
		}

		if (isEmpty(basePath)) {
			throw new IllegalStateException(
					format("Site '%s' does not have an plugin folder pattern configured", siteId));
		}
		if (!CS.contains(basePath, PLACEHOLDER_TYPE) ||
				!CS.contains(basePath, PLACEHOLDER_NAME)) {
			throw new IllegalStateException(format(
					"Plugin folder pattern for site '%s' does not contain all required placeholders", basePath));
		}

		Map<String, String> values = new HashMap<>();
		values.put(PLACEHOLDER_TYPE, type);
		values.put(PLACEHOLDER_NAME, name);
		values.put(PLACEHOLDER_ID, isEmpty(pluginId) ? pluginId : pluginId.replace('.', '/'));
		basePath = StringSubstitutor.replace(basePath, values);

		String filePath = UrlUtils.concat(basePath, filename);

		return contentService.getContentAsResource(siteId, filePath);
	}

	private void writeDefaultConfiguration(String siteId, String module, String path, InputStream content)
			throws ServiceLayerException, UserNotFoundException, AuthenticationException {
		String configBasePath = studioConfiguration.getProperty(CONFIGURATION_SITE_CONFIG_BASE_PATH_PATTERN)
				.replaceAll(PATTERN_MODULE, module);
		String configPath = Paths.get(configBasePath, path).toString();
		contentService.write(siteId, configPath, content, null);
		generateAuditLog(siteId, configPath);
		dependencyService.upsertDependencies(siteId, configPath);
	}

	protected InputStream validate(InputStream content, String filename) throws ServiceLayerException {
		// Check the filename to see if it needs to be validated
		String extension = getExtension(filename);
		if (isEmpty(extension)) {
			// without extension there is no way to know
			logger.debug("Configuration file '{}' is of unknown type, will not validate", filename);
			return content;
		}
		try {
			// Copy the contents of the stream
			byte[] bytes;
			bytes = IOUtils.toByteArray(content);

			// Perform the validation
			switch (extension.toLowerCase()) {
				case "xml":
					try {
						DocumentHelper.parseText(new String(bytes));
					} catch (Exception e) {
						logger.error("Failed to validate the configuration file '{}'", filename, e);
						throw new InvalidConfigurationException(format("Invalid XML configuration file '%s'",
								filename), e);
					}
					break;
				case "yaml":
				case "yml":
					try {
						YamlConfiguration yamlConfig = new YamlConfiguration();
						// Read in order to detect invalid files
						yamlConfig.read(new ByteArrayInputStream(bytes));
					} catch (Exception e) {
						logger.error("Failed to validate the configuration file '{}'", filename, e);
						throw new InvalidConfigurationException(format("Invalid YAML configuration file '%s'",
								filename), e);
					}
			}

			// Return a new stream
			return new ByteArrayInputStream(bytes);

		} catch (IOException e) {
			logger.error("Failed to validate the configuration file '{}'", filename, e);
			throw new ServiceLayerException(format("Failed to validate the configuration file '%s'", filename), e);
		}
	}

	private String getConfigurationPath(String siteId, String module, String path, String environment) throws SiteNotFoundException {
		String configBasePath = null;
		if (!isEmpty(environment)) {
			configBasePath =
					studioConfiguration.getProperty(CONFIGURATION_SITE_MUTLI_ENVIRONMENT_CONFIG_BASE_PATH_PATTERN)
							.replaceAll(PATTERN_MODULE, module)
							.replaceAll(PATTERN_ENVIRONMENT, environment);
			if (!contentService.contentExists(siteId, configBasePath)) {
				configBasePath = null;
			}
		}

		if (isEmpty(configBasePath)) {
			configBasePath = studioConfiguration.getProperty(CONFIGURATION_SITE_CONFIG_BASE_PATH_PATTERN)
					.replaceAll(PATTERN_MODULE, module);
		}
		return Paths.get(configBasePath, path).toString();
	}

	private void writeEnvironmentConfiguration(String siteId, String module, String path, String environment,
											   InputStream content)
			throws ServiceLayerException, UserNotFoundException, AuthenticationException {
		if (!isEmpty(environment)) {
			String configBasePath =
					studioConfiguration.getProperty(CONFIGURATION_SITE_MUTLI_ENVIRONMENT_CONFIG_BASE_PATH_PATTERN)
							.replaceAll(PATTERN_MODULE, module)
							.replaceAll(PATTERN_ENVIRONMENT, environment);
			if (contentService.contentExists(siteId, configBasePath)) {
				String configPath = Paths.get(configBasePath, path).toString();
				contentService.write(siteId, configPath, content, null);
			} else {
				writeDefaultConfiguration(siteId, module, path, content);
			}
		} else {
			writeDefaultConfiguration(siteId, module, path, content);
		}
	}

	private void generateAuditLog(String siteId, String path) {
		Site site = siteDao.getSite(siteId);
		AuditLog auditLog = createAuditLogEntry();
		auditLog.setOperation(OPERATION_UPDATE);
		auditLog.setSiteId(site.getId());
		auditLog.setActorId(getCurrentUsername());
		auditLog.setPrimaryTargetId(siteId + ":" + path);
		auditLog.setPrimaryTargetType(TARGET_TYPE_CONTENT_ITEM);
		auditLog.setPrimaryTargetValue(path);
		auditLog.setPrimaryTargetSubtype(CONTENT_TYPE_CONFIGURATION);
		auditService.insertAuditLog(auditLog);
	}

	@Override
	public ConfigurationHistory getConfigurationHistory(String siteId,
														String module,
														String path,
														String environment)
			throws ServiceLayerException, UserNotFoundException {
		String configPath;
		if (!isEmpty(environment)) {
			String configBasePath =
					studioConfiguration.getProperty(CONFIGURATION_SITE_MUTLI_ENVIRONMENT_CONFIG_BASE_PATH_PATTERN)
							.replaceAll(PATTERN_MODULE, module)
							.replaceAll(PATTERN_ENVIRONMENT, environment);
			configPath = Paths.get(configBasePath, path).toString();
			if (!contentService.contentExists(siteId, configPath)) {
				configBasePath = studioConfiguration.getProperty(CONFIGURATION_SITE_CONFIG_BASE_PATH_PATTERN)
						.replaceAll(PATTERN_MODULE, module);
				configPath = Paths.get(configBasePath, path).toString();
			}
		} else {
			String configBasePath = studioConfiguration.getProperty(CONFIGURATION_SITE_CONFIG_BASE_PATH_PATTERN)
					.replaceAll(PATTERN_MODULE, module);
			configPath = Paths.get(configBasePath, path).toString();
		}
		if (!contentService.contentExists(siteId, configPath)) {
			throw new ContentNotFoundException(path, siteId,
					"Content not found at path " + configPath + " site " + siteId);
		}
		ConfigurationHistory configurationHistory = new ConfigurationHistory();
		configurationHistory.setItem(contentService.getItemByPath(siteId, configPath, false));
		configurationHistory.setVersions(contentService.getContentVersionHistory(siteId, configPath));
		return configurationHistory;
	}

	@Override
	public void writeGlobalConfiguration(String path, InputStream content)
			throws ServiceLayerException, UserNotFoundException {
		contentRepository.writeContent(EMPTY, path, validate(content, path));
		applicationEventPublisher.publishEvent(new ContentEvent(SecurityUtils.getAuthentication(), EMPTY, path));
		generateAuditLog(studioConfiguration.getProperty(CONFIGURATION_GLOBAL_SYSTEM_SITE), path);
		invalidateCache(path);
	}

	@Override
	@SuppressWarnings("rawtypes")
	public TranslationConfiguration getTranslationConfiguration(String siteId) throws ServiceLayerException {
		TranslationConfiguration translationConfiguration = new TranslationConfiguration();
		if (contentService.contentExists(siteId, translationConfig)) {
			try (InputStream is = contentService.getContent(siteId, translationConfig)) {
				HierarchicalConfiguration config = configurationReader.readXmlConfiguration(is, getConfigLookupVariables(siteId));
				if (config != null) {
					translationConfiguration.setDefaultLocaleCode(
							config.getString(CONFIG_KEY_TRANSLATION_DEFAULT_LOCALE));
					translationConfiguration.setLocaleCodes(
							config.getList(String.class, CONFIG_KEY_TRANSLATION_LOCALES));
				}
			} catch (Exception e) {
				throw new ServiceLayerException(format("Error getting translation config for site '%s'", siteId), e);
			}
		}
		return translationConfiguration;
	}

	private Map<String, String> getConfigLookupVariables(final String siteId) {
		Context context = contextManager.getContext(siteId);
		return context.getConfigLookupVariables();
	}

	@Override
	public void invalidateConfiguration(String siteId, String path) throws SiteNotFoundException {
		invalidateConfiguration(siteId, EMPTY, path, EMPTY);
	}

	@Override
	public void invalidateConfiguration(String siteId, String module, String path, String environment) throws SiteNotFoundException {
		var cacheKey = getCacheKey(siteId, module, path, environment);
		invalidateCache(cacheKey);
	}

	@Override
	public void invalidateConfiguration(String siteId) {
		logger.debug("Invalidate configuration cache in site '{}'", siteId);
		configurationCache.asMap().keySet().stream()
				.filter(key -> CI.startsWith(key, siteId + ":"))
				.forEach(this::invalidateCache);
	}

	@Override
	public void makeBlobStoresReadOnly(final String siteId) throws ServiceLayerException {
		try {
			String environment = studioConfiguration.getProperty(CONFIGURATION_ENVIRONMENT_ACTIVE);
			String configLocation = studioConfiguration.getProperty(BLOB_STORES_CONFIG_PATH);

			InputStream blobConfigsContent = getEnvironmentConfiguration(siteId, MODULE_STUDIO, configLocation, environment);
			if (blobConfigsContent == null) {
				logger.debug("Blob stores configuration not found for site '{}'", siteId);
				return;
			}

			ByteArrayOutputStream out = new ByteArrayOutputStream();
			ClassPathResource templateResource = new ClassPathResource(READ_ONLY_BLOB_STORES_TEMPLATE_LOCATION);
			try (InputStream templateInputStream = templateResource.getInputStream()) {
				XsltUtils.executeTemplate(templateInputStream, null, null,
						blobConfigsContent, out);
			}

			writeConfiguration(siteId, MODULE_STUDIO, configLocation, environment, new ByteArrayInputStream(out.toByteArray()));
		} catch (Exception e) {
			throw new ServiceLayerException(format("Failed to make make blob stores read only for site '%s'", siteId), e);
		}
	}

	@Override
	public List<NormalizedGroup> getSiteGroups(String siteId) throws ServiceLayerException {
		try {
			return new ArrayList<>(getRoleMappings(siteId).keySet());
		} catch (ConfigurationException e) {
			throw new ServiceLayerException("Unable to get role mappings config for site '" + siteId + "'", e);
		}
	}

	protected void invalidateCache(String key) {
		logger.debug("Invalidate cache key '{}'", key);
		cacheInvalidators.forEach(invalidator -> invalidator.invalidate(configurationCache, key));
	}

	@Override
	public Collection<Language> getAvailableLanguages() throws ServiceLayerException {
		try {
			return (Collection<Language>) configurationCache.get(CONFIGURATION_AVAILABLE_LANGUAGES, this::loadAvailableLanguages);
		} catch (ExecutionException e) {
			throw new ServiceLayerException("Failed to load available languages configuration", e);
		}
	}

	/**
	 * Loads the available languages from the configuration and returns them as a collection of {@link Language} objects.
	 */
	protected Collection<Language> loadAvailableLanguages() {
		List<HierarchicalConfiguration<ImmutableNode>> languageNodes =
				studioConfiguration.getSubConfigs(CONFIGURATION_AVAILABLE_LANGUAGES);

		List<Language> languages = new ArrayList<>();
		for (HierarchicalConfiguration<ImmutableNode> languageNode : languageNodes) {
			String id = languageNode.getString(CONFIG_KEY_ID);
			String label = languageNode.getString(CONFIG_KEY_LABEL);
			languages.add(new Language(id, label));
		}
		return unmodifiableCollection(languages);
	}

	private String getGlobalConfigRoot() {
		return studioConfiguration.getProperty(CONFIGURATION_GLOBAL_CONFIG_BASE_PATH);
	}

	private String getSitesConfigPath() {
		return studioConfiguration.getProperty(CONFIGURATION_SITE_CONFIG_BASE_PATH);
	}

	private String getGlobalRoleMappingsFileName() {
		return studioConfiguration.getProperty(CONFIGURATION_GLOBAL_ROLE_MAPPINGS_FILE_NAME);
	}
	// --- end of copied code ---

	@Override
	public void setApplicationEventPublisher(@NonNull ApplicationEventPublisher applicationEventPublisher) {
		this.applicationEventPublisher = applicationEventPublisher;
	}

	public void setContentRepository(GitContentRepository contentRepository) {
		this.contentRepository = contentRepository;
	}

	@Lazy
	@Autowired
	@Qualifier("contentServiceInternal")
	public void setContentService(final ContentService contentService) {
		this.contentService = contentService;
	}

	public void setStudioConfiguration(StudioConfiguration studioConfiguration) {
		this.studioConfiguration = studioConfiguration;
	}

	public void setAuditService(AuditService auditService) {
		this.auditService = auditService;
	}

	public void setSiteDao(SiteDAO siteDao) {
		this.siteDao = siteDao;
	}

	public void setServicesConfig(ServicesConfig servicesConfig) {
		this.servicesConfig = servicesConfig;
	}

	@SuppressWarnings("unused")
	public void setConfigurationReader(EncryptionAwareConfigurationReader configurationReader) {
		this.configurationReader = configurationReader;
	}

	@SuppressWarnings("unused")
	public void setTranslationConfig(String translationConfig) {
		this.translationConfig = translationConfig;
	}

	@SuppressWarnings("unused")
	public void setConfigurationCache(Cache<String, Object> configurationCache) {
		this.configurationCache = configurationCache;
	}

	@SuppressWarnings("unused")
	public void setCacheInvalidators(List<CacheInvalidator<String, Object>> cacheInvalidators) {
		this.cacheInvalidators = cacheInvalidators;
	}

	public void setDependencyService(DependencyService dependencyService) {
		this.dependencyService = dependencyService;
	}

	@SuppressWarnings("unused")
	public void setContextManager(ContextManager contextManager) {
		this.contextManager = contextManager;
	}
}
