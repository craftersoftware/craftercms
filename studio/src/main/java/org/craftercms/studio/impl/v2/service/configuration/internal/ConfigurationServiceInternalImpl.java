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
import org.apache.commons.io.IOUtils;
import org.apache.commons.lang3.StringUtils;
import org.apache.commons.text.StringSubstitutor;
import org.craftercms.commons.config.EncryptionAwareConfigurationReader;
import org.craftercms.commons.config.YamlConfiguration;
import org.craftercms.commons.lang.UrlUtils;
import org.craftercms.core.exception.XmlFileParseException;
import org.craftercms.core.service.Context;
import org.craftercms.studio.api.v1.dal.SiteFeed;
import org.craftercms.studio.api.v1.exception.ContentNotFoundException;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v1.exception.security.UserNotFoundException;
import org.craftercms.studio.api.v1.service.configuration.ServicesConfig;
import org.craftercms.studio.api.v1.service.content.ContentService;
import org.craftercms.studio.api.v1.service.site.SiteService;
import org.craftercms.studio.api.v2.annotation.LogExecutionTime;
import org.craftercms.studio.api.v2.core.ContextManager;
import org.craftercms.studio.api.v2.dal.AuditLog;
import org.craftercms.studio.api.v2.dal.security.NormalizedGroup;
import org.craftercms.studio.api.v2.dal.security.NormalizedRole;
import org.craftercms.studio.api.v2.event.content.ConfigurationEvent;
import org.craftercms.studio.api.v2.exception.configuration.ConfigurationException;
import org.craftercms.studio.api.v2.exception.configuration.InvalidConfigurationException;
import org.craftercms.studio.api.v2.repository.ContentRepository;
import org.craftercms.studio.api.v2.service.audit.internal.AuditServiceInternal;
import org.craftercms.studio.api.v2.service.config.ConfigurationService;
import org.craftercms.studio.api.v2.service.content.internal.ContentServiceInternal;
import org.craftercms.studio.api.v2.service.dependency.internal.DependencyServiceInternal;
import org.craftercms.studio.api.v2.service.item.internal.ItemServiceInternal;
import org.craftercms.studio.api.v2.service.security.SecurityService;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import org.craftercms.studio.api.v2.utils.cache.CacheInvalidator;
import org.craftercms.studio.impl.v2.utils.XsltUtils;
import org.craftercms.studio.model.config.TranslationConfiguration;
import org.craftercms.studio.model.rest.ConfigurationHistory;
import org.dom4j.*;
import org.dom4j.io.SAXReader;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.ApplicationEventPublisherAware;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.xml.sax.SAXException;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static java.lang.String.format;
import static java.lang.String.join;
import static java.nio.charset.StandardCharsets.UTF_8;
import static java.util.Collections.emptyMap;
import static org.apache.commons.io.FilenameUtils.getExtension;
import static org.apache.commons.io.FilenameUtils.normalize;
import static org.apache.commons.lang3.StringUtils.*;
import static org.craftercms.commons.xml.XmlSecurityUtils.createSaxReader;
import static org.craftercms.studio.api.v1.constant.StudioConstants.*;
import static org.craftercms.studio.api.v1.constant.StudioXmlConstants.*;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.OPERATION_UPDATE;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.TARGET_TYPE_CONTENT_ITEM;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.*;

/**
 * Internal implementation of {@link ConfigurationService}.
 */
public class ConfigurationServiceInternalImpl implements ConfigurationService, ApplicationEventPublisherAware {

    private static final Logger logger = LoggerFactory.getLogger(ConfigurationServiceInternalImpl.class);

    public static final String PLACEHOLDER_TYPE = "type";
    public static final String PLACEHOLDER_NAME = "name";
    public static final String PLACEHOLDER_ID = "id";

    /* Translation Config */
    public static final String CONFIG_KEY_TRANSLATION_DEFAULT_LOCALE = "defaultLocaleCode";
    public static final String CONFIG_KEY_TRANSLATION_LOCALES = "localeCodes.localeCode";

    private static final String READ_ONLY_BLOB_STORES_TEMPLATE_LOCATION = "/crafter/studio/utils/readonly-blob-stores.xslt";

    private ContentService contentService;
    private ContentServiceInternal contentServiceInternal;
    private StudioConfiguration studioConfiguration;
    private AuditServiceInternal auditServiceInternal;
    private SiteService siteService;
    private SecurityService securityService;
    private ServicesConfig servicesConfig;
    private EncryptionAwareConfigurationReader configurationReader;
    private ItemServiceInternal itemServiceInternal;
    private ContentRepository contentRepository;
    private DependencyServiceInternal dependencyService;

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
            logger.error("Failed to load role mappings from site '{}' path '{}'", siteId, roleMappingsConfigPath, e);
            throw new ConfigurationException(format("Failed to load role mappings from site '%s' path '%s'",
                    siteId, roleMappings), e);
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
                                           String environment) throws ContentNotFoundException {
        String content = getEnvironmentConfiguration(siteId, module, path, environment);
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
                logger.debug("Cache miss in site '{}' cache key '{}'", siteId, cacheKey);
                String content = getEnvironmentConfiguration(siteId, module, normalizedPath, environment);
                if (isNotEmpty(content)) {
                    SAXReader saxReader = new SAXReader();
                    try {
                        saxReader.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
                        saxReader.setFeature("http://xml.org/sax/features/external-general-entities", false);
                        saxReader.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
                    } catch (SAXException e) {
                        logger.error("Failed to turn off external entity loading, " +
                                "this could be pose a security risk.", e);
                    }
                    try (InputStream is = IOUtils.toInputStream(content, UTF_8)) {
                        doc = saxReader.read(is);
                        configurationCache.put(cacheKey, doc);
                    }
                }
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
        var cacheKey = getCacheKey(siteId, null, path, null, "commons");
        HierarchicalConfiguration<?> config = (HierarchicalConfiguration<?>) configurationCache.getIfPresent(cacheKey);
        if (config == null) {
            try {
                logger.debug("Cache miss in site '{}' cache key '{}'", siteId, cacheKey);
                if (contentServiceInternal.contentExists(siteId, path)) {
                    config = configurationReader.readXmlConfiguration(contentService.getContent(siteId, path), getConfigLookupVariables(siteId));
                    configurationCache.put(cacheKey, config);
                }
            } catch (ContentNotFoundException | org.craftercms.commons.config.ConfigurationException e) {
                logger.error("Failed to load configuration from site '{}' path '{}'", siteId, path, e);
                throw new ConfigurationException(format("Failed to load configuration from site " +
                        "'%s' path '%s'", siteId, path), e);
            }
        }
        return config;
    }

    @Override
    public HierarchicalConfiguration<?> getXmlConfiguration(String siteId, String module, String path) throws ConfigurationException {
        String environment = studioConfiguration.getProperty(CONFIGURATION_ENVIRONMENT_ACTIVE);
        String cacheKey = getCacheKey(siteId, module, path, environment);
        HierarchicalConfiguration<?> config = (HierarchicalConfiguration<?>) configurationCache.getIfPresent(cacheKey);
        if (config != null) {
            return config;
        }
        try {
            String fullConfigurationPath = getConfigurationPath(siteId, module, path, environment);
            logger.debug("Cache miss in site '{}' cache key '{}'", siteId, cacheKey);
            if (contentServiceInternal.contentExists(siteId, fullConfigurationPath)) {
                config = configurationReader.readXmlConfiguration(contentService.getContent(siteId, fullConfigurationPath), getConfigLookupVariables(siteId));
                configurationCache.put(cacheKey, config);
            }
            return config;
        } catch (ContentNotFoundException | org.craftercms.commons.config.ConfigurationException |
                 SiteNotFoundException e) {
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
                if (contentServiceInternal.contentExists(EMPTY, path)) {
                    config = configurationReader.readXmlConfiguration(contentService.getContent(EMPTY, path), emptyMap());
                    configurationCache.put(cacheKey, config);
                }
            } catch (ContentNotFoundException | org.craftercms.commons.config.ConfigurationException e) {
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
                doc = contentService.getContentAsDocument(EMPTY, path);
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
    public String getGlobalConfigurationAsString(String path) throws ContentNotFoundException {
        String content = contentService.getContentAsString(EMPTY, path);
        if (content == null) {
            throw new ContentNotFoundException(path, CONFIGURATION_GLOBAL_SYSTEM_SITE,
                    format("Configuration not found for global site '%s', path '%s'", CONFIGURATION_GLOBAL_SYSTEM_SITE, path));
        }

        return content;
    }

    private String getDefaultConfiguration(String siteId, String module, String path) {
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
        String result = contentService.shallowGetContentAsString(siteId, configPath);
        if (logger.isTraceEnabled()) {
            logger.trace("getDefaultConfiguration site '{}' path '{}' took '{}' milliseconds", siteId, path, System.currentTimeMillis() - startTime);
        }
        return result;
    }

    private String getEnvironmentConfiguration(String siteId, String module, String path, String environment) {
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
                return contentService.shallowGetContentAsString(siteId, configPath);
            }
        }
        String defaultConfiguration = getDefaultConfiguration(siteId, module, path);
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
            throws ServiceLayerException, UserNotFoundException {
		content = validate(content, path);
        writeEnvironmentConfiguration(siteId, module, path, environment, content);
        invalidateConfiguration(siteId, module, path, environment);
        applicationEventPublisher.publishEvent(
                new ConfigurationEvent(securityService.getAuthentication(), siteId,
                        getConfigurationPath(siteId, module, path, environment)));
    }

    public String getCacheKey(String siteId, String module, String path, String environment, String suffix) {
        if (isNotEmpty(siteId)) {
            String fullPath = null;
            if (isNotEmpty(environment)) {
                String configBasePath =
                        studioConfiguration.getProperty(CONFIGURATION_SITE_MUTLI_ENVIRONMENT_CONFIG_BASE_PATH_PATTERN)
                                .replaceAll(PATTERN_MODULE, module)
                                .replaceAll(PATTERN_ENVIRONMENT, environment);
                String configPath =
                        Paths.get(configBasePath, path).toString();
                if (contentServiceInternal.contentExists(siteId, configPath)) {
                    fullPath = configPath;
                }
            }

            if (isEmpty(fullPath)) {
                if (isNotEmpty(module)) {
                    String configBasePath = studioConfiguration.getProperty(CONFIGURATION_SITE_CONFIG_BASE_PATH_PATTERN)
                            .replaceAll(PATTERN_MODULE, module);

                    if (startsWithIgnoreCase(path, configBasePath)) {
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
            throws ContentNotFoundException {
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
        if (!contains(basePath, PLACEHOLDER_TYPE) ||
                !contains(basePath, PLACEHOLDER_NAME)) {
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
            throws ServiceLayerException, UserNotFoundException {
        String configBasePath = studioConfiguration.getProperty(CONFIGURATION_SITE_CONFIG_BASE_PATH_PATTERN)
                .replaceAll(PATTERN_MODULE, module);
        String configPath = Paths.get(configBasePath, path).toString();
        contentService.writeContent(siteId, configPath, content);
        String currentUser = securityService.getCurrentUser();
        try {
            itemServiceInternal.persistItemAfterWrite(siteId, configPath, currentUser,
                    contentRepository.getRepoLastCommitId(siteId), true);
            contentService.notifyContentEvent(siteId, configPath);
        } catch (XmlFileParseException e) {
            logger.error("Failed to parse updated XML file at site '{}', path '{}'", siteId, configPath, e);
        }
        generateAuditLog(siteId, configPath, currentUser);
        dependencyService.upsertDependencies(siteId, configPath);
    }

    protected InputStream validate(InputStream content, String filename) throws ServiceLayerException {
        String extension = getExtension(filename);
        try {
			byte[] bytes = IOUtils.toByteArray(content);

            switch (defaultString(extension).toLowerCase()) {
                case "xml":
                    try {
						readXml(bytes);
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
                        yamlConfig.read(new ByteArrayInputStream(bytes));
                    } catch (Exception e) {
                        logger.error("Failed to validate the configuration file '{}'", filename, e);
                        throw new InvalidConfigurationException(format("Invalid YAML configuration file '%s'",
                                filename), e);
                    }
					break;
				default:
					// Unknown names are not required to be XML, but a DOCTYPE must not be stored for a later XML read.
					rejectDoctypeInXml(bytes, filename);
					break;
            }

            return new ByteArrayInputStream(bytes);

        } catch (IOException e) {
            logger.error("Failed to validate the configuration file '{}'", filename, e);
            throw new ServiceLayerException(format("Failed to validate the configuration file '%s'", filename), e);
        }
    }

	/**
	 * Rejects XML that declares a DOCTYPE. Non-XML content is left unchanged.
	 */
	private void rejectDoctypeInXml(byte[] bytes, String filename) throws InvalidConfigurationException {
		try {
			readXml(bytes);
		} catch (Exception e) {
			if (declaresDoctype(e)) {
				logger.error("Failed to validate the configuration file '{}'", filename, e);
				throw new InvalidConfigurationException(format("Invalid XML configuration file '%s'", filename), e);
			}
			logger.debug("Configuration file '{}' is not XML, will not validate", filename);
		}
	}

	private static void readXml(byte[] bytes) throws Exception {
		createSaxReader().read(new ByteArrayInputStream(bytes));
	}

	private static boolean declaresDoctype(Throwable error) {
		Throwable current = error;
		while (current != null) {
			String message = current.getMessage();
			if (message != null && message.toLowerCase().contains("doctype")) {
				return true;
			}
			current = current.getCause();
		}
		return false;
	}

    private String getConfigurationPath(String siteId, String module, String path, String environment) throws SiteNotFoundException {
        String configBasePath = null;
        if (!isEmpty(environment)) {
            configBasePath =
                    studioConfiguration.getProperty(CONFIGURATION_SITE_MUTLI_ENVIRONMENT_CONFIG_BASE_PATH_PATTERN)
                            .replaceAll(PATTERN_MODULE, module)
                            .replaceAll(PATTERN_ENVIRONMENT, environment);
            if (!contentServiceInternal.contentExists(siteId, configBasePath)) {
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
            throws ServiceLayerException, UserNotFoundException {
        if (!isEmpty(environment)) {
            String configBasePath =
                    studioConfiguration.getProperty(CONFIGURATION_SITE_MUTLI_ENVIRONMENT_CONFIG_BASE_PATH_PATTERN)
                            .replaceAll(PATTERN_MODULE, module)
                            .replaceAll(PATTERN_ENVIRONMENT, environment);
            if (contentServiceInternal.contentExists(siteId, configBasePath)) {
                String configPath = Paths.get(configBasePath, path).toString();
                contentService.writeContent(siteId, configPath, content);
                String currentUser = securityService.getCurrentUser();
                itemServiceInternal.persistItemAfterWrite(siteId, configPath, currentUser,
                        contentRepository.getRepoLastCommitId(siteId), true);
                contentService.notifyContentEvent(siteId, configPath);
                generateAuditLog(siteId, configPath, currentUser);
                dependencyService.upsertDependencies(siteId, configPath);
            } else {
                writeDefaultConfiguration(siteId, module, path, content);
            }
        } else {
            writeDefaultConfiguration(siteId, module, path, content);
        }
    }

    private void generateAuditLog(String siteId, String path, String user) throws SiteNotFoundException {
        SiteFeed siteFeed = siteService.getSite(siteId);
        AuditLog auditLog = auditServiceInternal.createAuditLogEntry();
        auditLog.setOperation(OPERATION_UPDATE);
        auditLog.setSiteId(siteFeed.getId());
        auditLog.setActorId(user);
        auditLog.setPrimaryTargetId(siteId + ":" + path);
        auditLog.setPrimaryTargetType(TARGET_TYPE_CONTENT_ITEM);
        auditLog.setPrimaryTargetValue(path);
        auditLog.setPrimaryTargetSubtype(CONTENT_TYPE_CONFIGURATION);
        auditServiceInternal.insertAuditLog(auditLog);
    }

    @Override
    public ConfigurationHistory getConfigurationHistory(String siteId,
                                                        String module,
                                                        String path,
                                                        String environment)
            throws ServiceLayerException {
        String configPath;
        if (!isEmpty(environment)) {
            String configBasePath =
                    studioConfiguration.getProperty(CONFIGURATION_SITE_MUTLI_ENVIRONMENT_CONFIG_BASE_PATH_PATTERN)
                            .replaceAll(PATTERN_MODULE, module)
                            .replaceAll(PATTERN_ENVIRONMENT, environment);
            configPath = Paths.get(configBasePath, path).toString();
            if (!contentServiceInternal.contentExists(siteId, configPath)) {
                configBasePath = studioConfiguration.getProperty(CONFIGURATION_SITE_CONFIG_BASE_PATH_PATTERN)
                        .replaceAll(PATTERN_MODULE, module);
                configPath = Paths.get(configBasePath, path).toString();
            }
        } else {
            String configBasePath = studioConfiguration.getProperty(CONFIGURATION_SITE_CONFIG_BASE_PATH_PATTERN)
                    .replaceAll(PATTERN_MODULE, module);
            configPath = Paths.get(configBasePath, path).toString();
        }
        if (!contentServiceInternal.contentExists(siteId, configPath)) {
            throw new ContentNotFoundException(path, siteId,
                    "Content not found at path " + configPath + " site " + siteId);
        }
        ConfigurationHistory configurationHistory = new ConfigurationHistory();
        configurationHistory.setItem(contentService.getContentItem(siteId, configPath));
        configurationHistory.setVersions(contentServiceInternal.getContentVersionHistory(siteId, configPath));
        return configurationHistory;
    }

    @Override
    public void writeGlobalConfiguration(String path, InputStream content)
            throws ServiceLayerException {
        contentService.writeContent(EMPTY, path, validate(content, path));
        contentService.notifyContentEvent(EMPTY, path);
        String currentUser = securityService.getCurrentUser();
        generateAuditLog(studioConfiguration.getProperty(CONFIGURATION_GLOBAL_SYSTEM_SITE), path, currentUser);
        invalidateCache(path);
    }

    @Override
    @SuppressWarnings("rawtypes")
    public TranslationConfiguration getTranslationConfiguration(String siteId) throws ServiceLayerException {
        TranslationConfiguration translationConfiguration = new TranslationConfiguration();
        if (contentServiceInternal.contentExists(siteId, translationConfig)) {
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
    public void invalidateConfiguration(String siteId, String path) {
        invalidateConfiguration(siteId, EMPTY, path, EMPTY);
    }

    @Override
    public void invalidateConfiguration(String siteId, String module, String path, String environment) {
        var cacheKey = getCacheKey(siteId, module, path, environment);
        invalidateCache(cacheKey);
    }

    @Override
    public void invalidateConfiguration(String siteId) {
        logger.debug("Invalidate configuration cache in site '{}'", siteId);
        configurationCache.asMap().keySet().stream()
                .filter(key -> startsWithIgnoreCase(key, siteId + ":"))
                .forEach(this::invalidateCache);
    }

    @Override
    public void makeBlobStoresReadOnly(final String siteId) throws ServiceLayerException {
        try {
            String environment = studioConfiguration.getProperty(CONFIGURATION_ENVIRONMENT_ACTIVE);
            String configLocation = studioConfiguration.getProperty(BLOB_STORES_CONFIG_PATH);

            String blobConfigsContent = getEnvironmentConfiguration(siteId, MODULE_STUDIO, configLocation, environment);
            if (blobConfigsContent == null) {
                logger.debug("Blob stores configuration not found for site '{}'", siteId);
                return;
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ClassPathResource templateResource = new ClassPathResource(READ_ONLY_BLOB_STORES_TEMPLATE_LOCATION);
            try (InputStream templateInputStream = templateResource.getInputStream()) {
                XsltUtils.executeTemplate(templateInputStream, null, null,
                        IOUtils.toInputStream(blobConfigsContent), out);
            }

            writeConfiguration(siteId, MODULE_STUDIO, configLocation, environment, new ByteArrayInputStream(out.toByteArray()));
        } catch (Exception e) {
            throw new ServiceLayerException(format("Failed to make make blob stores read only for site '%s'", siteId), e);
        }
    }

    protected void invalidateCache(String key) {
        logger.debug("Invalidate cache key '{}'", key);
        cacheInvalidators.forEach(invalidator -> invalidator.invalidate(configurationCache, key));
    }

    // Moved from SiteServiceImpl to be able to properly cache the object
    // TODO: JM: Remove unused method?
    @Override
    @SuppressWarnings("unchecked")
    public Map<String, Object> legacyGetConfiguration(String site, String path) throws ServiceLayerException {
        String configPath = null;
        String xmlCacheKey;
        String env = null;
        var useContentService = true;
        if (StringUtils.isEmpty(site)) {
            configPath = getGlobalConfigRoot() + path;
            xmlCacheKey = configPath;
        } else {
            if (path.startsWith(FILE_SEPARATOR + CONTENT_TYPE_CONFIG_FOLDER + FILE_SEPARATOR)) {
                configPath = getSitesConfigPath() + path;
                // Write config received env = null so this needs to match
                xmlCacheKey = getCacheKey(site, MODULE_STUDIO, path, null);
            } else {
                useContentService = false;
                env = studioConfiguration.getProperty(CONFIGURATION_ENVIRONMENT_ACTIVE);
                xmlCacheKey = getCacheKey(site, MODULE_STUDIO, path, env);
            }
        }

        String finalConfigPath = configPath;
        String finalEnv = env;

        var objCacheKey = xmlCacheKey + ":map";
        Map<String, Object> map = (Map<String, Object>) configurationCache.getIfPresent(objCacheKey);
        if (map == null) {
            Document doc = (Document) configurationCache.getIfPresent(xmlCacheKey);
            if (doc == null) {
                try {
                    logger.debug("Cache miss in site '{}' key '{}'", site, xmlCacheKey);
                    String configContent;
                    if (useContentService) {
                        configContent = contentService.getContentAsString(site, finalConfigPath);
                    } else {
                        configContent = getConfigurationAsString(site, MODULE_STUDIO, path, finalEnv);
                    }
                    configContent = configContent.replaceAll("\"\\n([\\s]+)?+", "\" ");
                    configContent = configContent.replaceAll("\\n([\\s]+)?+", "");
                    configContent = configContent.replaceAll("<!--(.*?)-->", "");

                    doc = DocumentHelper.parseText(configContent);
                    configurationCache.put(xmlCacheKey, doc);
                } catch (DocumentException e) {
                    throw new ServiceLayerException("Failed to load configuration", e);
                }
            }
            map = createMap(doc.getRootElement());
            configurationCache.put(objCacheKey, map);
        }
        return map;
    }

    @SuppressWarnings("rawtypes,unchecked")
    private Map<String, Object> createMap(Element element) {
        Map<String, Object> map = new HashMap<>();
        for (int i = 0, size = element.nodeCount(); i < size; i++) {
            Node currentNode = element.node(i);
            if (currentNode instanceof Element) {
                Element currentElement = (Element) currentNode;
                String key = currentElement.getName();
                Object toAdd;
                if (currentElement.isTextOnly()) {
                    toAdd = currentElement.getStringValue();
                } else {
                    toAdd = createMap(currentElement);
                }
                if (map.containsKey(key)) {
                    Object value = map.get(key);
                    List listOfValues = new ArrayList<>();
                    if (value instanceof List) {
                        listOfValues = (List<Object>) value;
                    } else {
                        listOfValues.add(value);
                    }
                    listOfValues.add(toAdd);
                    map.put(key, listOfValues);
                } else {
                    map.put(key, toAdd);
                }
            }
        }
        return map;
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
    public void setApplicationEventPublisher(ApplicationEventPublisher applicationEventPublisher) {
        this.applicationEventPublisher = applicationEventPublisher;
    }

    public void setContentService(ContentService contentService) {
        this.contentService = contentService;
    }

    public void setContentServiceInternal(final ContentServiceInternal contentServiceInternal) {
        this.contentServiceInternal = contentServiceInternal;
    }

    public void setStudioConfiguration(StudioConfiguration studioConfiguration) {
        this.studioConfiguration = studioConfiguration;
    }

    public void setAuditServiceInternal(AuditServiceInternal auditServiceInternal) {
        this.auditServiceInternal = auditServiceInternal;
    }

    public void setSiteService(SiteService siteService) {
        this.siteService = siteService;
    }

    public void setSecurityService(SecurityService securityService) {
        this.securityService = securityService;
    }

    public void setServicesConfig(ServicesConfig servicesConfig) {
        this.servicesConfig = servicesConfig;
    }

    public void setConfigurationReader(EncryptionAwareConfigurationReader configurationReader) {
        this.configurationReader = configurationReader;
    }

    public void setTranslationConfig(String translationConfig) {
        this.translationConfig = translationConfig;
    }

    public void setItemServiceInternal(ItemServiceInternal itemServiceInternal) {
        this.itemServiceInternal = itemServiceInternal;
    }

    public void setConfigurationCache(Cache<String, Object> configurationCache) {
        this.configurationCache = configurationCache;
    }

    public void setContentRepository(ContentRepository contentRepository) {
        this.contentRepository = contentRepository;
    }

    public void setCacheInvalidators(List<CacheInvalidator<String, Object>> cacheInvalidators) {
        this.cacheInvalidators = cacheInvalidators;
    }

    public void setDependencyService(DependencyServiceInternal dependencyService) {
        this.dependencyService = dependencyService;
    }

    public void setContextManager(ContextManager contextManager) {
        this.contextManager = contextManager;
    }
}
